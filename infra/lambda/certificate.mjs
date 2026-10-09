import { ACMClient, DeleteCertificateCommand, DescribeCertificateCommand, RequestCertificateCommand } from '@aws-sdk/client-acm';
import { removeRecord, upsertRecord } from './cf.mjs';

const acm = new ACMClient({ region: 'us-east-1' });
const VALIDATION_DEADLINE_MS = 13 * 60 * 1000;
const FINAL_STATUSES = ['FAILED', 'VALIDATION_TIMED_OUT', 'REVOKED'];

const sleep = (ms) => new Promise((resolve) => setTimeout(resolve, ms));
const stripDot = (value) => String(value).replace(/\.$/, '');

async function describe(certificateArn) {
  const response = await acm.send(new DescribeCertificateCommand({ CertificateArn: certificateArn }));
  return response.Certificate ?? {};
}

async function validationRecords(certificateArn) {
  const certificate = await describe(certificateArn);
  return (certificate.DomainValidationOptions ?? [])
    .filter((option) => option.ResourceRecord)
    .map((option) => option.ResourceRecord);
}

async function createRecords(zoneName, certificateArn) {
  for (let attempt = 0; attempt < 12; attempt += 1) {
    const records = await validationRecords(certificateArn);
    if (records.length > 0) {
      for (const record of records) {
        await upsertRecord({
          zoneName,
          name: stripDot(record.Name),
          type: record.Type,
          content: stripDot(record.Value),
          proxied: false,
          ttl: 60,
        });
      }
      return;
    }
    await sleep(5000);
  }
  throw new Error(`No DNS validation records returned for ${certificateArn}`);
}

async function waitUntilIssued(certificateArn) {
  const deadline = Date.now() + VALIDATION_DEADLINE_MS;
  while (Date.now() < deadline) {
    const certificate = await describe(certificateArn);
    if (certificate.Status === 'ISSUED') {
      return;
    }
    if (FINAL_STATUSES.includes(certificate.Status)) {
      throw new Error(`ACM certificate ${certificateArn} ended in status ${certificate.Status}`);
    }
    await sleep(15000);
  }
  throw new Error(`Timed out waiting for ACM certificate ${certificateArn} to be issued`);
}

export async function handler(event) {
  const props = event.ResourceProperties;

  if (event.RequestType === 'Delete') {
    const certificateArn = event.PhysicalResourceId;
    try {
      for (const record of await validationRecords(certificateArn)) {
        await removeRecord({
          zoneName: props.ZoneName,
          name: stripDot(record.Name),
          type: record.Type,
        });
      }
    } catch (error) {
      console.warn(`Validation record cleanup skipped: ${error.message}`);
    }
    try {
      await acm.send(new DeleteCertificateCommand({ CertificateArn: certificateArn }));
    } catch (error) {
      console.warn(`Certificate deletion skipped: ${error.message}`);
    }
    return {};
  }

  if (event.RequestType === 'Update') {
    const certificateArn = event.PhysicalResourceId;
    await createRecords(props.ZoneName, certificateArn);
    await waitUntilIssued(certificateArn);
    return { PhysicalResourceId: certificateArn, Data: { CertificateArn: certificateArn } };
  }

  const request = await acm.send(
    new RequestCertificateCommand({
      DomainName: props.DomainName,
      ValidationMethod: 'DNS',
    }),
  );
  const certificateArn = request.CertificateArn;

  await createRecords(props.ZoneName, certificateArn);
  await waitUntilIssued(certificateArn);

  return { PhysicalResourceId: certificateArn, Data: { CertificateArn: certificateArn } };
}
