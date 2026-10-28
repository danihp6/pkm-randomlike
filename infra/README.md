# PokeRandomLike — Infrastructure (AWS CDK)

Hosts the built game (`dist/`) on a private S3 bucket behind CloudFront, with the
public DNS record managed in Cloudflare. The site is served at
**https://pokerandomlike.herreteam.com**.

## Two stacks, two regions

| Stack | Region | Contents |
| --- | --- | --- |
| `PokeRandomLikeCertificate` | `us-east-1` | ACM certificate only |
| `PokeRandomLikeSite` | `eu-west-1` | S3 bucket, CloudFront distribution, Cloudflare DNS record, custom-resource Lambdas, and the monthly ranking — a DynamoDB table plus one Lambda behind a function URL |

CloudFront only accepts ACM certificates issued in **`us-east-1`** — that is a
hard AWS requirement, not a preference. To keep that constraint from dragging
the rest of the site to Virginia, the certificate lives in its own stack and is
referenced across regions (`crossRegionReferences`). Everything that can be
regional (S3, CloudFront control plane, Lambdas) stays in `eu-west-1` (Ireland).

## How DNS works (Cloudflare, not Route 53)

CloudFormation's built-in DNS validation only knows Route 53, so that is not
used. Instead:

1. The certificate custom resource calls the ACM API (`RequestCertificate`), then
   writes the returned validation CNAME into Cloudflare and polls until the
   certificate is `ISSUED`.
2. The site stack writes one more Cloudflare record: the `CNAME`
   `pokerandomlike.herreteam.com` → CloudFront domain.

Both use the Cloudflare API with a token from the environment. Nothing in
Cloudflare needs to be created by hand.

## Configuration

Copy `.env.example` at the repository root to `.env` and fill in:

```
CLOUDFLARE_API_TOKEN=<token with Zone → DNS → Edit on herreteam.com>
```

`.env` is gitignored. Optional overrides: `CLOUDFLARE_ZONE_NAME` (default
`herreteam.com`), `SITE_DOMAIN` (default `pokerandomlike.herreteam.com`),
`CLOUDFLARE_PROXIED` (default `false`, i.e. DNS-only so CloudFront terminates
TLS with the ACM certificate).

The token is passed to the Lambdas as an environment variable, so it is visible
in the CloudFormation template and the Lambda console to anyone with access to
the account.

## The ranking endpoint

A finished run leaves the browser and becomes a place on the month's board. The site
finds the endpoint without a build-time variable: the deployment writes
**`ranking.json`** (`{ "endpoint": "https://…" }`) into the bucket next to `index.html`,
and the client reads it (`D56`).

Two resources carry it, both in `PokeRandomLikeSite`:

- `PokeRandomLikeRanking` — a DynamoDB table, partition key `month` (`YYYY-MM`, UTC) and
  sort key `strike` (`NNN#<endedAt>#<deviceId>`; the padded floor reads
  lexicographically, so a descending scan visits the deepest runs first). It bills
  **per request** (on demand, no capacity to provision) and every item carries an
  `expiresAt` **400 days** out, so DynamoDB's TTL retires a month's ledger by itself.
- `RankingFunction` — 256 MB, 10 s, `NODEJS_24_X`, reading the table's name from
  `RANKING_TABLE`, reachable only through its **function URL** (no auth, CORS limited
  to the site and `http://localhost:5175`).

`GET /` answers one month's board:

```
GET <endpoint>?month=2026-10&limit=10   →   { "month": "2026-10",
                                              "rows": [{ "deviceId": "…", "runs": 3,
                                                         "wins": 1, "bestFloor": 12 }] }
```

`month` defaults to the current UTC month when it is missing or not `YYYY-MM`, `limit`
is clamped to 1…10 (default 10), and the runs are folded **per device**, then sorted by
`bestFloor` descending, then `wins`, then `runs`, then `deviceId`. The scan is capped at
500 items, so a very busy month is a top-500 read, not the whole ledger.

`POST /` takes one finished run and answers `{ "ok": true }`:

```
POST <endpoint>   { "seed": "…", "mode": "finite", "deviceId": "d-…",
                    "mapReached": 12, "playtimeMs": 3600000, "won": false,
                    "species": ["pikachu"] }   →   { "ok": true }
```

`seed` must be 1…64 characters, `mode` must be `finite` or `infinite`, and `deviceId`
must match `^[A-Za-z0-9-]{8,40}$`; anything else is a `400` naming the field. The
numbers are **clamped on both sides** — the floor to 0…99 and the playtime to
0…86 400 000 ms (24 h) — with the only two copies of those numbers being
`RANKING_MAX_*` in `src/net/ranking.ts` and `MAX_*` in `lambda/ranking.mjs`. `won` is
`true` only for a literal `true`, and a `species` list that is not at most six
`^[a-z0-9-]{1,32}$` ids is stored as `[]`. Responses carry
`content-type: application/json`; `access-control-allow-origin` comes from the function
URL's CORS config, not from the handler.

**Two honest limits.** The payload is **client-authored**: a determined player can post
any figures the clamps allow, so this is a board of claims, not a proof — the clamps and
the alphabet are all the validation there is. And the burst guard (30 requests per
source per rolling minute, a `Map` in the container's memory, answering `429`) is
**best-effort**: it covers one warm container and resets when the container is recycled,
so it slows down a runaway client without being a quota.

Deploying prints the endpoint as the stack's `RankingEndpoint` output:

```
aws cloudformation describe-stacks --stack-name PokeRandomLikeSite --region eu-west-1 \
  --query "Stacks[0].Outputs[?OutputKey=='RankingEndpoint'].OutputValue" --output text
```

## Commands

From the repository root:

```
npm run infra:install   # installs infra/node_modules once
npm run build           # builds dist/ (the deploy uploads it)
npm run infra:deploy    # build + cdk deploy --all
```

Or from `infra/`:

```
npx cdk bootstrap aws://<account>/eu-west-1      # once
npx cdk bootstrap aws://<account>/us-east-1      # once
npx cdk diff
npx cdk deploy --all
npx cdk destroy --all
```

`cdk deploy --all` deploys the certificate stack first, then the site stack.
Destroy in reverse order automatically.

## Files

- `bin/infra.ts` — the CDK app: reads `.env`, defines both stacks.
- `lib/certificate.ts` / `lib/certificate-stack.ts` — ACM certificate via a
  Cloudflare-backed custom resource.
- `lib/site-stack.ts` — S3 + CloudFront + DNS record + deployment, plus the ranking
  table, its function and the function URL the deployment writes into `ranking.json`.
- `lib/cloudflare.ts` — shared custom-resource provider for DNS records.
- `lambda/certificate.mjs` — request/validate/delete the certificate.
- `lambda/cloudflare.mjs`, `lambda/cf.mjs` — upsert/delete DNS records.
- `lambda/ranking.mjs` — the monthly ranking endpoint: `POST` a finished run, `GET`
  the month's top players.
- `ranking.json` — not a file in this repo: the deployment writes it into the bucket
  next to `index.html`, and it is the site's only pointer to the endpoint.
