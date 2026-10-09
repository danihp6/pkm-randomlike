import { CfnOutput, RemovalPolicy, Stack, StackProps } from 'aws-cdk-lib';
import * as acm from 'aws-cdk-lib/aws-certificatemanager';
import * as cloudfront from 'aws-cdk-lib/aws-cloudfront';
import * as origins from 'aws-cdk-lib/aws-cloudfront-origins';
import * as s3 from 'aws-cdk-lib/aws-s3';
import * as s3deploy from 'aws-cdk-lib/aws-s3-deployment';
import { Construct } from 'constructs';
import { existsSync } from 'fs';
import { CloudflareDnsProvider } from './cloudflare';

export interface SiteStackProps extends StackProps {
  /** Cloudflare zone that owns the domain, e.g. `herreteam.com`. */
  readonly zoneName: string;
  /** Public hostname for the site, e.g. `pokerandomlike.herreteam.com`. */
  readonly siteDomain: string;
  /** ARN of the (us-east-1) certificate created by the certificate stack. */
  readonly certificateArn: string;
  /** Proxy the Cloudflare record (orange cloud). Defaults to DNS-only. */
  readonly cloudflareProxied?: boolean;
  /** Vite build output uploaded to the bucket. */
  readonly buildDir: string;
}

export class SiteStack extends Stack {
  constructor(scope: Construct, id: string, props: SiteStackProps) {
    super(scope, id, props);

    const cloudflareToken = process.env.CLOUDFLARE_API_TOKEN;
    if (cloudflareToken === undefined || cloudflareToken.length === 0) {
      throw new Error(
        'CLOUDFLARE_API_TOKEN is not set. Put it in the repository-root .env file (not committed) or export it in the shell before deploying.',
      );
    }

    if (!existsSync(props.buildDir)) {
      throw new Error(
        `Build output not found at ${props.buildDir}. Run "npm run build" at the repository root before deploying.`,
      );
    }

    const siteBucket = new s3.Bucket(this, 'SiteBucket', {
      blockPublicAccess: s3.BlockPublicAccess.BLOCK_ALL,
      encryption: s3.BucketEncryption.S3_MANAGED,
      enforceSSL: true,
      removalPolicy: RemovalPolicy.DESTROY,
      autoDeleteObjects: true,
    });

    const dns = CloudflareDnsProvider.getOrCreate(this, cloudflareToken);

    // CloudFront refuses to add an alternate domain name that already resolves
    // to *another* CloudFront distribution. The zone has a wildcard
    // `*.herreteam.com` that does exactly that, so we first pin this specific
    // name to a non-CloudFront target (an explicit record beats the wildcard),
    // which lets the distribution claim the alias. The final record below then
    // repoints it at the new distribution.
    const preflight = dns.record('PreflightDnsRecord', {
      zoneName: props.zoneName,
      name: props.siteDomain,
      type: 'CNAME',
      content: 'example.com',
      proxied: false,
      ttl: 60,
    });

    const distribution = new cloudfront.Distribution(this, 'Distribution', {
      comment: `PokeRandomLike - ${props.siteDomain}`,
      defaultRootObject: 'index.html',
      domainNames: [props.siteDomain],
      certificate: acm.Certificate.fromCertificateArn(this, 'SiteCertificate', props.certificateArn),
      priceClass: cloudfront.PriceClass.PRICE_CLASS_100,
      httpVersion: cloudfront.HttpVersion.HTTP2_AND_3,
      defaultBehavior: {
        origin: origins.S3BucketOrigin.withOriginAccessControl(siteBucket),
        viewerProtocolPolicy: cloudfront.ViewerProtocolPolicy.REDIRECT_TO_HTTPS,
        allowedMethods: cloudfront.AllowedMethods.ALLOW_GET_HEAD_OPTIONS,
        cachedMethods: cloudfront.CachedMethods.CACHE_GET_HEAD_OPTIONS,
        cachePolicy: cloudfront.CachePolicy.CACHING_OPTIMIZED,
        compress: true,
      },
    });

    distribution.node.addDependency(preflight);

    dns.record('SiteDnsRecord', {
      zoneName: props.zoneName,
      name: props.siteDomain,
      type: 'CNAME',
      content: distribution.distributionDomainName,
      proxied: props.cloudflareProxied ?? false,
      ttl: 1,
    });

    new s3deploy.BucketDeployment(this, 'DeploySite', {
      destinationBucket: siteBucket,
      distribution,
      distributionPaths: ['/*'],
      prune: true,
      sources: [s3deploy.Source.asset(props.buildDir)],
    });

    new CfnOutput(this, 'SiteUrl', {
      value: `https://${props.siteDomain}`,
      description: 'Public site URL.',
    });
    new CfnOutput(this, 'BucketName', { value: siteBucket.bucketName });
    new CfnOutput(this, 'DistributionId', { value: distribution.distributionId });
    new CfnOutput(this, 'DistributionDomainName', {
      value: distribution.distributionDomainName,
      description: 'CloudFront domain (the Cloudflare CNAME target).',
    });
  }
}
