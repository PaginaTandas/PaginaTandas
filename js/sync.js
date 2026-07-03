import { validateData } from './validate.js';
import { getAccessToken } from './auth.js';

const ROW_ID = 'main';
let pushTimer = null;

export function isSyncConfigured(cfg) {
  return !!(cfg?.sync?.url && cfg?.sync?.key);
}

function headers(cfg) {
  const token = getAccessToken();
  return {
    apikey: cfg.sync.key,
    Authorization: `Bearer ${token || cfg.sync.key}`,
    'Content-Type': 'application/json'
  };
}

export async function pullCloud(cfg) {
  if (!isSyncConfigured(cfg)) return null;
  const url = `${cfg.sync.url}/rest/v1/tandas_data?id=eq.${ROW_ID}&select=payload,updated_at`;
  const res = await fetch(url, { headers: headers(cfg) });
  if (!res.ok) throw new Error('No se pudo leer la nube');
  const rows = await res.json();
  if (!rows.length) return null;
  return { payload: validateData(rows[0].payload), updated_at: rows[0].updated_at };
}

export async function pushCloud(cfg, data) {
  if (!isSyncConfigured(cfg)) return;
  const validated = validateData(data);
  const body = {
    id: ROW_ID,
    payload: validated,
    updated_at: new Date().toISOString()
  };
  const res = await fetch(`${cfg.sync.url}/rest/v1/tandas_data`, {
    method: 'POST',
    headers: {
      ...headers(cfg),
      Prefer: 'resolution=merge-duplicates'
    },
    body: JSON.stringify(body)
  });
  if (!res.ok) throw new Error('No se pudo guardar en la nube');
  return body.updated_at;
}

export function scheduleCloudPush(cfg, data) {
  if (!isSyncConfigured(cfg) || !getAccessToken()) return;
  clearTimeout(pushTimer);
  pushTimer = setTimeout(() => {
    pushCloud(cfg, data).catch(() => {});
  }, 900);
}

export async function syncFromCloud(cfg, localGetter, localSaver, getLocalUpdatedAt) {
  if (!isSyncConfigured(cfg) || !getAccessToken()) return { mode: 'local' };

  const local = localGetter();
  const localAt = getLocalUpdatedAt();
  let cloud;
  try {
    cloud = await pullCloud(cfg);
  } catch {
    return { mode: 'offline' };
  }

  if (!cloud) {
    if (local.tandas.length) {
      await pushCloud(cfg, local);
      return { mode: 'uploaded' };
    }
    return { mode: 'empty' };
  }

  const cloudAt = new Date(cloud.updated_at).getTime();
  const localTime = localAt ? new Date(localAt).getTime() : 0;

  if (!local.tandas.length || cloudAt >= localTime) {
    localSaver(cloud.payload);
    return { mode: 'downloaded' };
  }

  await pushCloud(cfg, local);
  return { mode: 'uploaded' };
}
