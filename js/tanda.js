import { uid } from './utils.js';

export function generateDates(startDate, count, frequencyDays = 15) {
  const dates = [];
  let current = new Date(startDate + 'T12:00:00');
  for (let i = 0; i < count; i++) {
    dates.push(current.toISOString().slice(0, 10));
    current = addDays(current, frequencyDays);
  }
  return dates;
}

function addDays(date, days) {
  const d = new Date(date);
  d.setDate(d.getDate() + days);
  return d;
}

export function getTandaTotalPot(tanda) {
  if (tanda.totalPot) return tanda.totalPot;
  return tanda.participants.reduce((sum, p) =>
    sum + p.members.reduce((s, m) => s + getMemberAmount(tanda, m), 0), 0);
}

export function getMemberAmount(tanda, member) {
  if (member.amount) return member.amount;
  return tanda.amount || 0;
}

export function countAllMembers(tanda) {
  return tanda.participants.reduce((s, p) => s + p.members.length, 0);
}

export function createTanda({ name, totalPot, startDate, frequencyDays = 15, turns = [], dates = null }) {
  const participants = turns.length > 0
    ? turns.map(({ turn, members }) => ({ turn, members }))
    : [{ turn: 1, members: [{ id: uid(), name: 'Persona 1', amount: totalPot }] }];

  const sum = participants.flatMap(t => t.members).reduce((s, m) => s + (m.amount || 0), 0);
  if (sum !== totalPot) distributeAmounts(participants, totalPot);

  const memberCount = countMembersInTurns(participants);
  const dateList = dates?.length
    ? dates
    : turns.map(t => t.date).filter(Boolean).length === participants.length
      ? turns.map(t => t.date)
      : generateDates(startDate || turns[0]?.date, participants.length, frequencyDays);

  return {
    id: uid(),
    name,
    totalPot,
    amount: Math.round(totalPot / memberCount) || totalPot,
    startDate: dateList[0] || startDate,
    frequencyDays,
    participants,
    dates: dateList,
    payments: {}
  };
}

export function suggestNextDate(lastDate, days = 15) {
  if (!lastDate) return new Date().toISOString().slice(0, 10);
  const d = new Date(lastDate + 'T12:00:00');
  d.setDate(d.getDate() + days);
  return d.toISOString().slice(0, 10);
}

export function autoFillDates(turns, days = 15) {
  if (!turns.length || !turns[0].date) return turns;
  let current = turns[0].date;
  turns[0].date = current;
  for (let i = 1; i < turns.length; i++) {
    current = suggestNextDate(current, days);
    turns[i].date = current;
  }
  return turns;
}

function countMembersInTurns(turns) {
  return turns.reduce((s, t) => s + t.members.length, 0);
}

export function distributeAmounts(turns, totalPot) {
  const members = turns.flatMap(t => t.members);
  if (!members.length) return turns;

  const base = Math.floor(totalPot / members.length);
  let extra = totalPot - base * members.length;

  for (const turn of turns) {
    for (const m of turn.members) {
      m.amount = base + (extra > 0 ? 1 : 0);
      if (extra > 0) extra--;
    }
  }
  return turns;
}

export function paymentKey(date, memberId) {
  return `${date}__${memberId}`;
}

export function getPaymentStatus(tanda, date, memberId) {
  const turnIdx = tanda.dates.indexOf(date);
  const turn = tanda.participants.find(p => p.members.some(m => m.id === memberId));
  if (!turn) return 'pending';
  if (turn.turn === turnIdx + 1) return 'cobra';
  return tanda.payments[paymentKey(date, memberId)] || 'pending';
}

export function togglePayment(tanda, date, memberId) {
  if (getPaymentStatus(tanda, date, memberId) === 'cobra') return tanda;
  const key = paymentKey(date, memberId);
  const cur = tanda.payments[key] || 'pending';
  tanda.payments[key] = cur === 'paid' ? 'pending' : 'paid';
  return tanda;
}

export function getTurnForDate(tanda, date) {
  const idx = tanda.dates.indexOf(date);
  if (idx < 0) return null;
  return tanda.participants.find(p => p.turn === idx + 1);
}

export function getPotForDate(tanda, date) {
  const cobraTurn = getTurnForDate(tanda, date);
  const total = getTandaTotalPot(tanda);
  if (!cobraTurn) return total;

  const cobraAmount = cobraTurn.members.reduce((s, m) => s + getMemberAmount(tanda, m), 0);
  return total - cobraAmount;
}

export function getCollectedAmount(tanda, date) {
  const cobraTurn = getTurnForDate(tanda, date);
  let collected = 0;
  for (const p of tanda.participants) {
    if (cobraTurn && p.turn === cobraTurn.turn) continue;
    for (const m of p.members) {
      if (getPaymentStatus(tanda, date, m.id) === 'paid') {
        collected += getMemberAmount(tanda, m);
      }
    }
  }
  return collected;
}

export function getCobraShare(tanda, date, member) {
  const cobraTurn = getTurnForDate(tanda, date);
  if (!cobraTurn) return 0;
  const pot = getPotForDate(tanda, date);
  const turnTotal = cobraTurn.members.reduce((s, m) => s + getMemberAmount(tanda, m), 0);
  if (turnTotal <= 0) return Math.round(pot / cobraTurn.members.length);
  return Math.round(pot * (getMemberAmount(tanda, member) / turnTotal));
}

export function getDateStats(tanda, date) {
  const cobraTurn = getTurnForDate(tanda, date);
  let paid = 0;
  let total = 0;
  for (const p of tanda.participants) {
    for (const m of p.members) {
      if (cobraTurn && p.turn === cobraTurn.turn) continue;
      total++;
      if (getPaymentStatus(tanda, date, m.id) === 'paid') paid++;
    }
  }
  return { paid, total };
}

export function getTandaProgress(tanda) {
  let paid = 0;
  let total = 0;
  for (const date of tanda.dates) {
    const s = getDateStats(tanda, date);
    paid += s.paid;
    total += s.total;
  }
  return total === 0 ? 0 : Math.round((paid / total) * 100);
}

export function addTurn(tanda, members, date) {
  const nextTurn = tanda.participants.length + 1;
  tanda.participants.push({ turn: nextTurn, members });
  const last = tanda.dates[tanda.dates.length - 1];
  tanda.dates.push(date || suggestNextDate(last, tanda.frequencyDays || 15));
  return tanda;
}

export function removeTurn(tanda, turnNum) {
  const removedDate = tanda.dates[turnNum - 1];
  tanda.participants = tanda.participants
    .filter(p => p.turn !== turnNum)
    .map((p, i) => ({ ...p, turn: i + 1 }));
  tanda.dates.splice(turnNum - 1, 1);

  const newPayments = {};
  for (const [key, val] of Object.entries(tanda.payments)) {
    if (key.split('__')[0] !== removedDate) newPayments[key] = val;
  }
  tanda.payments = newPayments;
  return tanda;
}

export function updateTurn(tanda, turnNum, members) {
  const p = tanda.participants.find(x => x.turn === turnNum);
  if (p) p.members = members;
  return tanda;
}

export function getMembersLabel(members) {
  return members.map(m => m.name).join(' y ');
}

export function recalcDates(tanda) {
  tanda.dates = generateDates(tanda.startDate, tanda.participants.length, tanda.frequencyDays);
  return tanda;
}

export function rebalanceAmounts(tanda) {
  distributeAmounts(tanda.participants, getTandaTotalPot(tanda));
  return tanda;
}
