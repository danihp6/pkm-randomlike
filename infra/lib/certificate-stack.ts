import { CfnOutput, Stack, StackProps } from 'aws-cdk-lib';
import { Construct } from 'constructs';
import { Certificate } from './certificate';

export interface CertificateStackProps extends StackProps {
  readonly zoneName: string;
  readonly siteDomain: string;
}

/**
 * Lives in us-east-1 because CloudFront only accepts certificates from that
 * region. It is kept separate from the site stack so everything else (S3,
 * CloudFront, custom-resource Lambdas) can live in the chosen site region.
 */
export class CertificateStack extends Stack {
  public readonly certificateArn: string;

  constructor(scope: Construct, id: string, props: CertificateStackProps) {
    super(scope, id, props);

    const cloudflareToken = process.env.CLOUDFLARE_API_TOKEN;
    if (cloudflareToken === undefined || cloudflareToken.length === 0) {
      throw new Error(
        'CLOUDFLARE_API_TOKEN is not set. Put it in the repository-root .env file (not committed) or export it in the shell before deploying.',
      );
    }

    const certificate = new Certificate(this, 'Certificate', {
      zoneName: props.zoneName,
      siteDomain: props.siteDomain,
      cloudflareToken,
    });

    this.certificateArn = certificate.certificateArn;

    new CfnOutput(this, 'CertificateArn', { value: certificate.certificateArn });
  }
}
