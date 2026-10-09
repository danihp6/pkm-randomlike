#!/usr/bin/env node
import { App } from 'aws-cdk-lib';
import { resolve } from 'path';
import { loadDotEnv } from '../lib/env';
import { CertificateStack } from '../lib/certificate-stack';
import { SiteStack } from '../lib/site-stack';

loadDotEnv(resolve(__dirname, '..', '..', '.env'));

const account = process.env.CDK_DEFAULT_ACCOUNT;
const zoneName = process.env.CLOUDFLARE_ZONE_NAME ?? 'herreteam.com';
const siteDomain = process.env.SITE_DOMAIN ?? 'pokerandomlike.herreteam.com';

const app = new App();

// CloudFront only accepts certificates issued in us-east-1, so the certificate
// is isolated there. Everything else deploys to the site region (Ireland).
const certificateStack = new CertificateStack(app, 'PokeRandomLikeCertificate', {
  env: { account, region: 'us-east-1' },
  crossRegionReferences: true,
  zoneName,
  siteDomain,
  description: 'PokeRandomLike ACM certificate (us-east-1, CloudFront requirement).',
});

const siteStack = new SiteStack(app, 'PokeRandomLikeSite', {
  env: { account, region: 'eu-west-1' },
  crossRegionReferences: true,
  zoneName,
  siteDomain,
  certificateArn: certificateStack.certificateArn,
  cloudflareProxied: process.env.CLOUDFLARE_PROXIED === 'true',
  buildDir: resolve(__dirname, '..', '..', 'dist'),
  description: 'PokeRandomLike static site: private S3 bucket behind CloudFront, DNS in Cloudflare.',
});

siteStack.addStackDependency(certificateStack, 'Site needs the issued certificate ARN');

app.synth();
