import { validateData, normalizeTanda, assertTandaTotals } from './validate.js';

const STORAGE_KEY = 'mis_tandas_data';
const BACKUP_KEY = 'mis_tandas_backup';
const META_KEY = 'mis_tandas_meta';
const SESSION_KEY = 'mis_tandas_session';
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

function writeMeta() {
  localStorage.setItem(META_KEY, JSON.stringify({
    version: DATA_VERSION,
    savedAt: new Date().toISOString()
  }));
}

export async function loadConfig() {
  if (config) return config;
  const res = await fetch('config.json');
  if (!res.ok) throw new Error('No se pudo cargar config.json');
  config = await res.json();
  if (!config.usuario || !config.contrasena) throw new Error('config.json incompleto');
  return config;
}

export function isLoggedIn() {
  return sessionStorage.getItem(SESSION_KEY) === '1';
}

export function login() {
  sessionStorage.setItem(SESSION_KEY, '1');
}

export async function verifyLogin(user, pass) {
  const cfg = await loadConfig();
  return user === cfg.usuario && pass === cfg.contrasena;
}

export function logout() {
  sessionStorage.removeItem(SESSION_KEY);
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

export function saveData(data) {
  const validated = validateData(data);
  const json = JSON.stringify(validated);
  localStorage.setItem(STORAGE_KEY, json);
  localStorage.setItem(BACKUP_KEY, json);
  writeMeta();
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

export async function initData() {
  const current = getData();
  if (current.tandas.length > 0) return current;

  try {
    const data = await fetchTandasFile();
    if (data.tandas.length) return saveData(data);
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

export function exportJSON() {
  const data = getData();
  const blob = new Blob([JSON.stringify(data, null, 2)], { type: 'application/json' });
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = `tandas-respaldo-${new Date().toISOString().slice(0, 10)}.json`;
  a.click();
  URL.revokeObjectURL(url);
  writeMeta();
}

export function importJSON(file) {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => {
      try {
        const data = validateData(JSON.parse(reader.result));
        saveData(data);
        resolve(data);
      } catch (e) {
        reject(e);
      }
    };
    reader.onerror = reject;
    reader.readAsText(file);
  });
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
