const API = 'https://api.cloudflare.com/client/v4';

async function request(path, init = {}) {
  const response = await fetch(API + path, {
    ...init,
    headers: {
      Authorization: `Bearer ${process.env.CLOUDFLARE_API_TOKEN}`,
      'Content-Type': 'application/json',
      ...(init.headers ?? {}),
    },
  });

  let body;
  try {
    body = await response.json();
  } catch {
    body = {};
  }

  if (!response.ok || body.success === false) {
    throw new Error(
      `Cloudflare ${init.method ?? 'GET'} ${path} -> ${response.status}: ${JSON.stringify(body.errors ?? body)}`,
    );
  }

  return body.result;
}

export async function zoneIdFor(zoneName) {
  const zones = await request(`/zones?name=${encodeURIComponent(zoneName)}`);
  if (!Array.isArray(zones) || zones.length === 0) {
    throw new Error(`Cloudflare zone not found: ${zoneName}`);
  }
  return zones[0].id;
}

export async function findRecord(zoneId, name, type) {
  const records = await request(
    `/zones/${zoneId}/dns_records?name=${encodeURIComponent(name)}&type=${encodeURIComponent(type)}`,
  );
  return Array.isArray(records) && records.length > 0 ? records[0] : null;
}

export async function upsertRecord({ zoneName, name, type, content, proxied = false, ttl = 1 }) {
  const zoneId = await zoneIdFor(zoneName);
  const existing = await findRecord(zoneId, name, type);
  const payload = { type, name, content, proxied, ttl };

  if (existing !== null) {
    const updated = await request(`/zones/${zoneId}/dns_records/${existing.id}`, {
      method: 'PUT',
      body: JSON.stringify(payload),
    });
    return updated.id;
  }

  const created = await request(`/zones/${zoneId}/dns_records`, {
    method: 'POST',
    body: JSON.stringify(payload),
  });
  return created.id;
}

export async function removeRecord({ zoneName, name, type }) {
  const zoneId = await zoneIdFor(zoneName);
  const existing = await findRecord(zoneId, name, type);
  if (existing !== null) {
    await request(`/zones/${zoneId}/dns_records/${existing.id}`, { method: 'DELETE' });
  }
}
