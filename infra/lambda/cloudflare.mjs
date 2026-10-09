import { removeRecord, upsertRecord } from './cf.mjs';

export async function handler(event) {
  const props = event.ResourceProperties;
  const record = {
    zoneName: props.ZoneName,
    name: props.Name,
    type: props.Type,
    content: props.Content,
    proxied: props.Proxied === true || props.Proxied === 'true',
    ttl: Number(props.Ttl ?? 1),
  };

  if (event.RequestType === 'Delete') {
    try {
      await removeRecord(record);
    } catch (error) {
      console.warn(`Cloudflare record cleanup skipped: ${error.message}`);
    }
    return {};
  }

  const id = await upsertRecord(record);
  return {
    PhysicalResourceId: `${record.zoneName}:${record.name}:${record.type}:${id}`,
    Data: { RecordId: id },
  };
}
