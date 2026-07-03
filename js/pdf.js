import { formatDate, formatMoney } from './utils.js';
import {
  getTandaTotalPot, getTurnForDate, getPotForDate, getCollectedAmount,
  getDateStats, getMembersLabel, getMemberAmount, getCobraShare, getPaymentStatus
} from './tanda.js';

function pdfText(str) {
  return String(str)
    .replace(/\u2014/g, '-')
    .replace(/\u00b7/g, '|')
    .replace(/[^\x20-\x7E\u00C0-\u024F\u00a1-\u00ff]/g, '');
}

function getJsPDF() {
  if (window.jspdf?.jsPDF) return window.jspdf.jsPDF;
  if (window.jsPDF) return window.jsPDF;
  throw new Error('No se cargo la libreria PDF. Recarga la pagina.');
}

function savePDF(doc, filename) {
  const blob = doc.output('blob');
  const url = URL.createObjectURL(blob);
  const link = document.createElement('a');
  link.href = url;
  link.download = filename;
  link.style.display = 'none';
  document.body.appendChild(link);
  link.click();
  setTimeout(() => {
    URL.revokeObjectURL(url);
    link.remove();
  }, 500);
}

export function downloadTandaPDF(tanda) {
  const jsPDF = getJsPDF();
  const doc = new jsPDF({ unit: 'mm', format: 'a4' });
  const margin = 14;
  const pageW = doc.internal.pageSize.getWidth();
  const maxW = pageW - margin * 2;
  let y = margin;

  const ensureSpace = (h = 8) => {
    if (y + h > 287) {
      doc.addPage();
      y = margin;
    }
  };

  const write = (text, size = 10, style = 'normal', rgb = [25, 25, 25]) => {
    doc.setFontSize(size);
    doc.setFont('helvetica', style);
    doc.setTextColor(rgb[0], rgb[1], rgb[2]);
    const lines = doc.splitTextToSize(pdfText(text), maxW);
    for (const line of lines) {
      ensureSpace(size * 0.5 + 3);
      doc.text(line, margin, y);
      y += size * 0.42 + 2.5;
    }
  };

  const gap = (n = 4) => { y += n; };

  write(tanda.name, 17, 'bold');
  write(`${formatMoney(getTandaTotalPot(tanda))} cada ${tanda.frequencyDays || 15} dias`, 11);
  write(`${tanda.participants.length} fechas`, 11);
  write(`Generado: ${new Date().toLocaleString('es-MX')}`, 9, 'normal', [90, 90, 90]);
  gap(6);

  tanda.dates.forEach((date, idx) => {
    const turn = getTurnForDate(tanda, date);
    const goal = getPotForDate(tanda, date);
    const collected = getCollectedAmount(tanda, date);
    const stats = getDateStats(tanda, date);

    ensureSpace(24);
    write(`FECHA ${idx + 1}`, 8, 'bold', [100, 100, 100]);
    write(formatDate(date), 13, 'bold', [37, 99, 235]);

    if (turn) {
      write(`Cobra: ${getMembersLabel(turn.members)}`, 10, 'bold');
      for (const m of turn.members) {
        write(`${m.name} - Aporta ${formatMoney(getMemberAmount(tanda, m))} - Recibe ${formatMoney(getCobraShare(tanda, date, m))}`, 10);
      }
    }

    write(`Juntado: ${formatMoney(collected)} de ${formatMoney(goal)} | ${stats.paid} de ${stats.total} pagaron`, 9, 'normal', [80, 80, 80]);
    gap(2);

    const payers = [];
    for (const p of tanda.participants) {
      if (turn && p.turn === turn.turn) continue;
      for (const m of p.members) {
        const paid = getPaymentStatus(tanda, date, m.id) === 'paid';
        payers.push({ name: m.name, amount: formatMoney(getMemberAmount(tanda, m)), status: paid ? 'Pago' : 'Falta' });
      }
    }

    if (payers.length) {
      write('Quien debe pagar:', 10, 'bold');
      for (const p of payers) {
        write(`${p.name} - ${p.amount} - ${p.status}`, 10);
      }
    }

    gap(8);
    doc.setDrawColor(220, 220, 220);
    ensureSpace(4);
    doc.line(margin, y, pageW - margin, y);
    gap(6);
  });

  gap(4);
  write('Resumen por persona', 12, 'bold');
  gap(2);

  for (const p of tanda.participants) {
    const cobraDate = tanda.dates[p.turn - 1];
    write(`Fecha ${p.turn} - Cobra el ${formatDate(cobraDate)}`, 10, 'bold');
    for (const m of p.members) {
      write(`${m.name} - Aporta ${formatMoney(getMemberAmount(tanda, m))} - Recibe ${formatMoney(getCobraShare(tanda, cobraDate, m))}`, 10);
    }
    gap(4);
  }

  const safeName = tanda.name.replace(/[^\w\s-]/g, '').trim().replace(/\s+/g, '-') || 'tanda';
  savePDF(doc, `${safeName}.pdf`);
}
