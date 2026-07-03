import { validateData } from './validate.js';
import { getAccessToken } from './auth.js';

const ROW_ID = 'main';
const POLL_MS = 2000;
let pushTimer = null;
let pendingPush = null;
let watchStop = null;
let lastSeenRemoteAt = 0;

export const CLOUD_SYNC_FAILED = 'mis-tandas-cloud-failed';

export function isSyncConfigured(cfg) {
  return !!(cfg?.sync?.url && cfg?.sync?.key);
}

export function markRemoteSeen(iso) {
  if (!iso) return;
  const t = new Date(iso).getTime();
  if (t > lastSeenRemoteAt) lastSeenRemoteAt = t;
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
  markRemoteSeen(body.updated_at);
  return body.updated_at;
}

function notifyPushError() {
  window.dispatchEvent(new CustomEvent(CLOUD_SYNC_FAILED));
}

export function scheduleCloudPush(cfg, data) {
  if (!isSyncConfigured(cfg) || !getAccessToken()) return;
  pendingPush = { cfg, data: validateData(data) };
  clearTimeout(pushTimer);
  pushTimer = setTimeout(() => {
    flushCloudPush().catch(() => notifyPushError());
  }, 200);
}

export async function flushCloudPush() {
  if (!pendingPush) return;
  const { cfg, data } = pendingPush;
  pendingPush = null;
  clearTimeout(pushTimer);
  return pushCloud(cfg, data);
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
    localSaver(cloud.payload, cloud.updated_at);
    markRemoteSeen(cloud.updated_at);
    return { mode: 'downloaded' };
  }

  await pushCloud(cfg, local);
  return { mode: 'uploaded' };
}

async function checkRemote(cfg, applyRemote, getLocalUpdatedAt) {
  if (!getAccessToken()) return;
  let cloud;
  try {
    cloud = await pullCloud(cfg);
  } catch {
    return;
  }
  if (!cloud) return;

  const cloudAt = new Date(cloud.updated_at).getTime();
  if (cloudAt <= lastSeenRemoteAt) return;

  const localTime = getLocalUpdatedAt()
    ? new Date(getLocalUpdatedAt()).getTime()
    : 0;

  if (cloudAt >= localTime) {
    lastSeenRemoteAt = cloudAt;
    applyRemote(cloud.payload, cloud.updated_at);
  }
}

export async function startCloudWatch(cfg, applyRemote, getLocalUpdatedAt) {
  stopCloudWatch();

  const poll = () => checkRemote(cfg, applyRemote, getLocalUpdatedAt);
  const pollId = setInterval(poll, POLL_MS);

  let realtimeCleanup = () => {};
  try {
    const { createClient } = await import('https://cdn.jsdelivr.net/npm/@supabase/supabase-js@2.49.8/+esm');
    const client = createClient(cfg.sync.url, cfg.sync.key);
    client.realtime.setAuth(getAccessToken());
    const channel = client
      .channel('tandas-main')
      .on('postgres_changes', {
        event: '*',
        schema: 'public',
        table: 'tandas_data',
        filter: `id=eq.${ROW_ID}`
      }, () => { poll(); })
      .subscribe();
    realtimeCleanup = () => { client.removeChannel(channel); };
  } catch {
    /* polling sigue activo */
  }

  watchStop = () => {
    clearInterval(pollId);
    realtimeCleanup();
    watchStop = null;
  };

  await poll();
}

export function stopCloudWatch() {
  watchStop?.();
}
