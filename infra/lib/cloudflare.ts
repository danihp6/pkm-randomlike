import { CustomResource, Duration, Stack } from 'aws-cdk-lib';
import * as lambda from 'aws-cdk-lib/aws-lambda';
import { Provider } from 'aws-cdk-lib/custom-resources';
import { Construct } from 'constructs';
import { join } from 'path';

const LAMBDA_DIR = join(__dirname, '..', 'lambda');

export interface CloudflareDnsRecordOptions {
  /** Cloudflare zone (apex domain), e.g. `herreteam.com`. */
  readonly zoneName: string;
  /** Fully qualified record name, e.g. `pokerandomlike.herreteam.com`. */
  readonly name: string;
  /** DNS record type, e.g. `CNAME`. */
  readonly type: string;
  /** Record value; may be a CDK token resolved at deploy time. */
  readonly content: string;
  /** Whether Cloudflare proxies (orange cloud) the record. Defaults to false. */
  readonly proxied?: boolean;
  /** TTL in seconds; `1` means automatic. Defaults to 1. */
  readonly ttl?: number;
}

/**
 * Single shared custom-resource provider that creates/updates/deletes DNS
 * records through the Cloudflare API. One Lambda per stack, reused by every
 * record.
 */
export class CloudflareDnsProvider extends Construct {
  private static readonly instances = new Map<string, CloudflareDnsProvider>();

  public static getOrCreate(scope: Construct, cloudflareToken: string): CloudflareDnsProvider {
    const stack = Stack.of(scope);
    const existing = CloudflareDnsProvider.instances.get(stack.node.path);
    if (existing !== undefined) {
      return existing;
    }

    const created = new CloudflareDnsProvider(stack, 'CloudflareDnsProvider', cloudflareToken);
    CloudflareDnsProvider.instances.set(stack.node.path, created);
    return created;
  }

  private readonly provider: Provider;

  private constructor(scope: Construct, id: string, cloudflareToken: string) {
    super(scope, id);

    const onEvent = new lambda.Function(this, 'Handler', {
      runtime: lambda.Runtime.NODEJS_24_X,
      handler: 'cloudflare.handler',
      code: lambda.Code.fromAsset(LAMBDA_DIR),
      timeout: Duration.minutes(1),
      environment: {
        CLOUDFLARE_API_TOKEN: cloudflareToken,
      },
    });

    this.provider = new Provider(this, 'Provider', {
      onEventHandler: onEvent,
    });
  }

  public record(id: string, options: CloudflareDnsRecordOptions): CustomResource {
    return new CustomResource(this, id, {
      serviceToken: this.provider.serviceToken,
      properties: {
        ZoneName: options.zoneName,
        Name: options.name,
        Type: options.type,
        Content: options.content,
        Proxied: options.proxied ?? false,
        Ttl: options.ttl ?? 1,
      },
    });
  }
}
