import { uid } from './utils.js';
import { suggestNextDate } from './tanda.js';

export function validateData(data) {
  if (!data || typeof data !== 'object') throw new Error('Datos inválidos');
  if (!Array.isArray(data.tandas)) throw new Error('Falta lista de tandas');
  return { tandas: data.tandas.map(normalizeTanda).filter(Boolean) };
}

export function normalizeTanda(raw) {
  if (!raw || typeof raw !== 'object') return null;

  const tanda = { ...raw };
  if (!tanda.id) tanda.id = uid();
  tanda.name = String(tanda.name || 'Sin nombre').trim().slice(0, 120);
  tanda.totalPot = Math.max(0, Math.round(+tanda.totalPot || 0));
  tanda.frequencyDays = Math.max(1, Math.round(+tanda.frequencyDays || 15));
  tanda.amount = Math.max(0, Math.round(+tanda.amount || 0));

  if (!Array.isArray(tanda.participants)) tanda.participants = [];
  if (!Array.isArray(tanda.dates)) tanda.dates = [];
  if (!tanda.payments || typeof tanda.payments !== 'object') tanda.payments = {};

  tanda.participants = tanda.participants
    .map(p => ({
      turn: +p.turn || 0,
      members: (Array.isArray(p.members) ? p.members : [])
        .map(m => ({
          id: m.id || uid(),
          name: String(m.name || '').trim().slice(0, 80),
          amount: Math.max(0, Math.round(+m.amount || 0))
        }))
        .filter(m => m.name)
    }))
    .filter(p => p.members.length > 0)
    .map((p, i) => ({ ...p, turn: i + 1 }));

  const count = tanda.participants.length;
  if (!count) return null;

  tanda.dates = tanda.dates.map(d => String(d).slice(0, 10)).filter(Boolean);
  if (tanda.dates.length > count) tanda.dates = tanda.dates.slice(0, count);

  const base = tanda.startDate || tanda.dates[0] || new Date().toISOString().slice(0, 10);
  while (tanda.dates.length < count) {
    const last = tanda.dates[tanda.dates.length - 1] || base;
    tanda.dates.push(suggestNextDate(last, tanda.frequencyDays));
  }

  tanda.startDate = tanda.dates[0];

  const validKeys = new Set();
  for (const date of tanda.dates) {
    for (const p of tanda.participants) {
      for (const m of p.members) validKeys.add(`${date}__${m.id}`);
    }
  }

  const payments = {};
  for (const [key, val] of Object.entries(tanda.payments)) {
    if (validKeys.has(key) && val === 'paid') payments[key] = 'paid';
  }
  tanda.payments = payments;

  return tanda;
}

export function assertTandaTotals(tanda) {
  const sum = tanda.participants
    .flatMap(p => p.members)
    .reduce((s, m) => s + m.amount, 0);
  if (sum !== tanda.totalPot) {
    throw new Error(`La suma de aportes (${sum}) debe ser ${tanda.totalPot}`);
  }
  if (tanda.participants.length !== tanda.dates.length) {
    throw new Error('Fechas y participantes no coinciden');
  }
}
