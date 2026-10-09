# PokeRandomLike — Infrastructure (AWS CDK)

Hosts the built game (`dist/`) on a private S3 bucket behind CloudFront, with the
public DNS record managed in Cloudflare. The site is served at
**https://pokerandomlike.herreteam.com**.

## Two stacks, two regions

| Stack | Region | Contents |
| --- | --- | --- |
| `PokeRandomLikeCertificate` | `us-east-1` | ACM certificate only |
| `PokeRandomLikeSite` | `eu-west-1` | S3 bucket, CloudFront distribution, Cloudflare DNS record, custom-resource Lambdas |

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
- `lib/site-stack.ts` — S3 + CloudFront + DNS record + deployment.
- `lib/cloudflare.ts` — shared custom-resource provider for DNS records.
- `lambda/certificate.mjs` — request/validate/delete the certificate.
- `lambda/cloudflare.mjs`, `lambda/cf.mjs` — upsert/delete DNS records.
