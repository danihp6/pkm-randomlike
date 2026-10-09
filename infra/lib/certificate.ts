import { CustomResource, Duration } from 'aws-cdk-lib';
import * as iam from 'aws-cdk-lib/aws-iam';
import * as lambda from 'aws-cdk-lib/aws-lambda';
import { Provider } from 'aws-cdk-lib/custom-resources';
import { Construct } from 'constructs';
import { join } from 'path';

const LAMBDA_DIR = join(__dirname, '..', 'lambda');

export interface CertificateProps {
  /** Cloudflare zone that holds the ACM validation CNAMEs. */
  readonly zoneName: string;
  /** Public hostname to certify, e.g. `pokerandomlike.herreteam.com`. */
  readonly siteDomain: string;
  readonly cloudflareToken: string;
}

/**
 * An ACM certificate requested and validated through the ACM API from a custom
 * resource. CloudFormation's `AWS::CertificateManager::Certificate` waits for
 * DNS validation to finish and only knows Route 53, so it cannot be used with
 * Cloudflare: this construct asks ACM for the certificate, writes the
 * validation CNAMEs into Cloudflare and polls until the certificate is issued.
 */
export class Certificate extends Construct {
  /** ARN of the issued certificate. */
  public readonly certificateArn: string;

  constructor(scope: Construct, id: string, props: CertificateProps) {
    super(scope, id);

    const onEvent = new lambda.Function(this, 'Handler', {
      runtime: lambda.Runtime.NODEJS_24_X,
      handler: 'certificate.handler',
      code: lambda.Code.fromAsset(LAMBDA_DIR),
      // DNS validation is normally seconds; give it room and poll internally.
      timeout: Duration.minutes(15),
      environment: {
        CLOUDFLARE_API_TOKEN: props.cloudflareToken,
      },
    });

    onEvent.addToRolePolicy(
      new iam.PolicyStatement({
        actions: [
          'acm:RequestCertificate',
          'acm:DescribeCertificate',
          'acm:DeleteCertificate',
          'acm:ListCertificates',
          'acm:AddTagsToCertificate',
        ],
        resources: ['*'],
      }),
    );

    const provider = new Provider(this, 'Provider', {
      onEventHandler: onEvent,
    });

    const resource = new CustomResource(this, 'Resource', {
      serviceToken: provider.serviceToken,
      properties: {
        DomainName: props.siteDomain,
        ZoneName: props.zoneName,
      },
    });

    this.certificateArn = resource.getAttString('CertificateArn');
  }
}
