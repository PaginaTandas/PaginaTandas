import { validateData, normalizeTanda, assertTandaTotals } from './validate.js';
import { isSyncConfigured, scheduleCloudPush, syncFromCloud as runCloudSync } from './sync.js';
import { isAuthenticated, signIn, signOut, refreshSession } from './auth.js';

const STORAGE_KEY = 'mis_tandas_data';
const BACKUP_KEY = 'mis_tandas_backup';
const META_KEY = 'mis_tandas_meta';
const EXAMPLE_ID = 'tanda-ejemplo-2025';
const DATA_VERSION = 1;

let config = null;

async function fetchTandasFile() {
  const res = await fetch('data/tandas.json');
  if (!res.ok) throw new Error(`No se pudo leer data/tandas.json (${res.status})`);
  const data = await res.json();
  return validateData(data);
}

function readStorage(key) {
  const raw = localStorage.getItem(key);
  if (!raw) return null;
  return validateData(JSON.parse(raw));
}

function writeMeta(savedAt = new Date().toISOString()) {
  localStorage.setItem(META_KEY, JSON.stringify({
    version: DATA_VERSION,
    savedAt
  }));
}

export async function loadConfig() {
  if (config) return config;
  const res = await fetch('config.json');
  if (!res.ok) throw new Error('No se pudo cargar config.json');
  config = await res.json();
  if (!isSyncConfigured(config)) throw new Error('Falta configurar Supabase en config.json');
  return config;
}

export function isLoggedIn() {
  return isAuthenticated();
}

export function login() {}

export async function verifyLogin(user, pass) {
  const cfg = await loadConfig();
  return signIn(cfg, user, pass);
}

export async function tryRefreshSession() {
  const cfg = await loadConfig();
  return refreshSession(cfg);
}

export function logout() {
  signOut();
}

export function getData() {
  try {
    return readStorage(STORAGE_KEY) || readStorage(BACKUP_KEY) || { tandas: [] };
  } catch {
    try {
      return readStorage(BACKUP_KEY) || { tandas: [] };
    } catch {
      return { tandas: [] };
    }
  }
}

export function saveData(data, options = {}) {
  const validated = validateData(data);
  const json = JSON.stringify(validated);
  localStorage.setItem(STORAGE_KEY, json);
  localStorage.setItem(BACKUP_KEY, json);
  writeMeta(options.savedAt);
  if (!options.skipCloud && config) scheduleCloudPush(config, validated);
  return validated;
}

export function getLastSavedAt() {
  try {
    const meta = JSON.parse(localStorage.getItem(META_KEY) || 'null');
    return meta?.savedAt || null;
  } catch {
    return null;
  }
}

export function isCloudSyncActive() {
  return isSyncConfigured(config) && isAuthenticated();
}

export async function syncFromCloud() {
  const cfg = await loadConfig();
  return runCloudSync(cfg, getData, data => saveData(data, { skipCloud: true }), getLastSavedAt);
}

export async function initData() {
  const current = getData();
  if (current.tandas.length > 0) return current;

  try {
    const data = await fetchTandasFile();
    if (data.tandas.length) return saveData(data, { skipCloud: true });
    return data;
  } catch {
    return current;
  }
}

export async function loadExampleData() {
  const data = await fetchTandasFile();
  const example = data.tandas.find(t => t.id === EXAMPLE_ID);
  if (!example) throw new Error('No hay tanda de ejemplo en el archivo');

  const current = getData();
  const idx = current.tandas.findIndex(t => t.id === EXAMPLE_ID);
  if (idx >= 0) current.tandas[idx] = example;
  else current.tandas.push(example);
  return saveData(current);
}

export function getTanda(id) {
  return getData().tandas.find(t => t.id === id) || null;
}

export function saveTanda(tanda) {
  const normalized = normalizeTanda(tanda);
  if (!normalized) throw new Error('Tanda inválida');
  assertTandaTotals(normalized);

  const data = getData();
  const idx = data.tandas.findIndex(t => t.id === normalized.id);
  if (idx >= 0) data.tandas[idx] = normalized;
  else data.tandas.push(normalized);
  return saveData(data);
}

export function deleteTanda(id) {
  const data = getData();
  data.tandas = data.tandas.filter(t => t.id !== id);
  saveData(data);
}
