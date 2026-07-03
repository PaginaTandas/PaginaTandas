import {
  formatDate, formatMoney, uid, $, $$
} from './utils.js';
import {
  getPaymentStatus, getTurnForDate, getDateStats,
  getTandaProgress, getMembersLabel,
  getTandaTotalPot, getPotForDate, getMemberAmount,
  getCollectedAmount, getCobraShare, countAllMembers,
  suggestNextDate
} from './tanda.js';

export function showView(id) {
  $$('.view').forEach(v => v.classList.remove('active'));
  $(`#${id}`).classList.add('active');
}

export function openModal(title, bodyHTML, footerHTML = '') {
  $('#modal-title').textContent = title;
  $('#modal-body').innerHTML = bodyHTML;
  $('#modal-footer').innerHTML = footerHTML;
  $('#modal').classList.remove('hidden');
}

export function closeModal() {
  $('#modal').classList.add('hidden');
}

export function renderDashboard(tandas, onOpen, onDownloadPDF, lastSavedAt = null) {
  const list = $('#tandas-list');
  const status = $('#save-status');

  if (status) {
    if (lastSavedAt) {
      const when = new Date(lastSavedAt);
      const label = when.toLocaleString('es-MX', {
        day: 'numeric', month: 'short', hour: '2-digit', minute: '2-digit'
      });
      status.innerHTML = `<iconify-icon icon="solar:shield-check-bold" width="16"></iconify-icon> Guardado en este dispositivo · ${label}`;
      status.classList.remove('hidden');
    } else {
      status.classList.add('hidden');
    }
  }

  if (!tandas.length) {
    list.innerHTML = `
      <div class="empty-state panel">
        <iconify-icon icon="solar:wallet-linear" width="56"></iconify-icon>
        <p>No hay tandas todavía.<br>Toca <strong>Cargar tanda de ejemplo</strong> o crea una nueva.</p>
      </div>`;
    return;
  }

  list.innerHTML = tandas.map(t => {
    const progress = getTandaProgress(t);
    const total = getTandaTotalPot(t);
    const freq = t.frequencyDays || 15;
    return `
      <div class="tanda-card panel" data-id="${t.id}">
        <div class="tanda-card-open" data-id="${t.id}">
          <div class="tanda-card-top">
            <div>
              <h3>${esc(t.name)}</h3>
              <div class="info">${formatMoney(total)} cada ${freq} días · ${t.participants.length} fechas</div>
            </div>
            <iconify-icon icon="solar:alt-arrow-right-linear" class="card-icon" width="22"></iconify-icon>
          </div>
          <div class="progress-bar"><div class="progress-fill" style="width:${progress}%"></div></div>
          <div class="progress-label"><span>${progress}% completado</span></div>
        </div>
        <button type="button" class="btn btn-secondary btn-block btn-pdf" data-pdf="${t.id}">
          <iconify-icon icon="solar:file-download-bold" width="20"></iconify-icon> Descargar PDF
        </button>
      </div>`;
  }).join('');

  $$('.tanda-card-open', list).forEach(el => {
    el.addEventListener('click', () => onOpen(el.dataset.id));
  });

  $$('.btn-pdf', list).forEach(btn => {
    btn.addEventListener('click', e => {
      e.stopPropagation();
      onDownloadPDF(btn.dataset.pdf);
    });
  });
}

export function renderTandaHeader(tanda) {
  const total = getTandaTotalPot(tanda);
  $('#tanda-title').textContent = tanda.name;
  $('#tanda-meta').textContent = `${formatMoney(total)} · cada ${tanda.frequencyDays} días`;
}

export function renderFechas(tanda, onToggle, options = {}) {
  const container = $('#fechas-list');
  const scrollParent = container.closest('.container');
  const scrollTop = scrollParent?.scrollTop ?? 0;

  const cards = tanda.dates.map((date, idx) => {
    const turn = getTurnForDate(tanda, date);
    const goal = getPotForDate(tanda, date);
    const collected = getCollectedAmount(tanda, date);
    const stats = getDateStats(tanda, date);
    const allPaid = stats.paid === stats.total && stats.total > 0;
    const progress = stats.total ? Math.round((stats.paid / stats.total) * 100) : 0;
    const turnLabel = turn ? getMembersLabel(turn.members) : '—';
    const isOpen = options.openDate === date;

    const payerRows = tanda.participants.flatMap(p => {
      if (turn && p.turn === turn.turn) return [];
      return p.members.map(m => {
        const status = getPaymentStatus(tanda, date, m.id);
        const amount = getMemberAmount(tanda, m);
        const paid = status === 'paid';
        return `
          <div class="fecha-payer">
            <div class="fecha-payer-info">
              <span class="fecha-payer-name">${esc(m.name)}</span>
              <span class="fecha-payer-amount">${formatMoney(amount)}</span>
            </div>
            <button type="button" class="pay-btn ${paid ? 'pay-btn-done' : 'pay-btn-pending'}"
              data-date="${date}" data-member="${m.id}">
              ${paid ? '✓ Pagó' : 'Falta'}
            </button>
          </div>`;
      });
    }).join('');

    return `
      <article class="fecha-card panel ${isOpen ? 'open' : ''} ${allPaid ? 'fecha-complete' : ''}" data-date="${date}">
        <button type="button" class="fecha-card-head" aria-expanded="${isOpen}">
          <div class="fecha-card-top">
            <div class="fecha-num">${idx + 1}</div>
            <div class="fecha-card-titles">
              <div class="fecha-card-date">${formatDate(date)}</div>
              ${turn ? `<div class="fecha-cobra">Cobra <strong>${esc(turnLabel)}</strong></div>` : ''}
            </div>
            <span class="fecha-status ${allPaid ? 'done' : ''}">${allPaid ? '✓' : `${stats.paid}/${stats.total}`}</span>
            <iconify-icon icon="solar:alt-arrow-down-linear" class="fecha-chevron" width="22"></iconify-icon>
          </div>
          <div class="fecha-progress-wrap">
            <div class="fecha-progress-bar"><div class="fecha-progress-fill" style="width:${progress}%"></div></div>
            <div class="fecha-progress-text">${formatMoney(collected)} de ${formatMoney(goal)}</div>
          </div>
        </button>
        <div class="fecha-payers">${payerRows}</div>
      </article>`;
  }).join('');

  container.innerHTML = `
    <p class="fechas-hint">Toca una fecha para abrirla. Luego marca <strong>Pagó</strong> o <strong>Falta</strong>.</p>
    ${cards}`;

  $$('.fecha-card-head', container).forEach(head => {
    head.addEventListener('click', () => {
      const card = head.closest('.fecha-card');
      const date = card.dataset.date;
      const wasOpen = card.classList.contains('open');
      $$('.fecha-card', container).forEach(c => c.classList.remove('open'));
      if (!wasOpen) {
        card.classList.add('open');
        head.setAttribute('aria-expanded', 'true');
        options.onExpand?.(date);
      } else {
        head.setAttribute('aria-expanded', 'false');
        options.onExpand?.(null);
      }
    });
  });

  $$('.pay-btn', container).forEach(btn => {
    btn.addEventListener('click', e => {
      e.stopPropagation();
      onToggle(btn.dataset.date, btn.dataset.member);
    });
  });

  if (scrollParent) scrollParent.scrollTop = scrollTop;
}

export function renderPersonas(tanda, onEdit, onDelete) {
  const container = $('#personas-list');
  const total = getTandaTotalPot(tanda);
  const memberCount = countAllMembers(tanda);
  const fechaCount = tanda.participants.length;

  container.innerHTML = `
    <div class="personas-summary panel">
      <div class="personas-stat">
        <span class="personas-stat-label">Total</span>
        <span class="personas-stat-value">${formatMoney(total)}</span>
      </div>
      <div class="personas-stat">
        <span class="personas-stat-label">Personas</span>
        <span class="personas-stat-value">${memberCount}</span>
      </div>
      <div class="personas-stat">
        <span class="personas-stat-label">Fechas</span>
        <span class="personas-stat-value">${fechaCount}</span>
      </div>
    </div>
  ` + tanda.participants.map(p => {
    const cobraDate = tanda.dates[p.turn - 1];
    const membersHtml = p.members.map((m, mi) => {
      const share = cobraDate ? getCobraShare(tanda, cobraDate, m) : 0;
      const aporte = getMemberAmount(tanda, m);
      return `
        <div class="persona-member${mi > 0 ? ' persona-member-divider' : ''}">
          <div class="persona-member-name">${esc(m.name)}</div>
          <div class="persona-member-amounts">
            <div class="persona-amount-box">
              <span class="persona-amount-label">Aporta</span>
              <span class="persona-amount-value">${formatMoney(aporte)}</span>
            </div>
            <div class="persona-amount-box persona-amount-receive">
              <span class="persona-amount-label">Recibe</span>
              <span class="persona-amount-value">${formatMoney(share)}</span>
            </div>
          </div>
        </div>`;
    }).join('');

    const sharedLabel = p.members.length > 1
      ? `<span class="persona-shared-tag">Comparten este día</span>`
      : '';

    return `
      <article class="persona-turn panel" data-turn="${p.turn}">
        <header class="persona-turn-header">
          <div class="persona-turn-meta">
            <div class="turn-badge">${p.turn}</div>
            <div class="persona-turn-titles">
              <div class="persona-turn-label">Fecha ${p.turn}</div>
              <div class="persona-date">Cobra el ${formatDate(cobraDate)}</div>
              ${sharedLabel}
            </div>
          </div>
          <div class="persona-actions">
            <button class="btn-icon btn-edit" data-turn="${p.turn}" title="Editar">
              <iconify-icon icon="solar:pen-bold" width="20"></iconify-icon>
            </button>
            <button class="btn-icon btn-delete" data-turn="${p.turn}" title="Eliminar">
              <iconify-icon icon="solar:trash-bin-minimalistic-bold" width="20"></iconify-icon>
            </button>
          </div>
        </header>
        <div class="persona-members">${membersHtml}</div>
      </article>`;
  }).join('');

  $$('.btn-edit', container).forEach(btn => btn.addEventListener('click', () => onEdit(+btn.dataset.turn)));
  $$('.btn-delete', container).forEach(btn => btn.addEventListener('click', () => onDelete(+btn.dataset.turn)));
}

export function renderCreateTanda(container, state, onChange) {
  const { sumOk } = getCreateSums(state);

  const turnsHtml = state.turns.map((turn, i) => `
    <div class="create-turn panel" data-idx="${i}">
      <div class="create-turn-top">
        <div class="turn-num-big">${i + 1}</div>
        <span class="create-turn-title">${i === 0 ? 'Primer cobro' : `Cobro ${i + 1}`}</span>
        ${state.turns.length > 1 ? `
          <button type="button" class="btn-icon btn-rm-turn" data-idx="${i}" title="Quitar">
            <iconify-icon icon="solar:trash-bin-minimalistic-bold" width="20"></iconify-icon>
          </button>` : ''}
      </div>

      ${i === 0 ? `
        <div class="date-readonly">
          <span class="field-label">Fecha de pago</span>
          <div class="date-display">${turn.date || state.startDate ? formatDate(turn.date || state.startDate) : '—'}</div>
        </div>
      ` : `
        <label class="field date-field">
          <span class="field-label">Fecha de pago</span>
          <div class="date-input-wrap">
            <input type="date" class="c-date" data-turn="${i}" value="${turn.date || ''}">
          </div>
        </label>
      `}

      <p class="turn-question">¿Quién cobra este día?</p>
      ${turn.members.map((m, mi) => `
        <div class="create-member-block">
          <label class="field">
            <span class="field-label">Nombre</span>
            <input type="text" class="c-name input-big" data-turn="${i}" data-member="${mi}"
              placeholder="Ej: Claudia" value="${esc(m.name)}">
          </label>
          <label class="field field-half">
            <span class="field-label">Cuánto aporta ($)</span>
            <input type="number" class="c-amount input-big" data-turn="${i}" data-member="${mi}"
              placeholder="1250" value="${m.amount || ''}" min="1" inputmode="numeric">
          </label>
          ${turn.members.length > 1 ? `<button type="button" class="btn-icon btn-rm-member" data-turn="${i}" data-member="${mi}">
            <iconify-icon icon="solar:close-circle-bold" width="22"></iconify-icon></button>` : ''}
        </div>
      `).join('')}
      <button type="button" class="btn btn-secondary btn-block btn-add-share" data-idx="${i}">
        + Compartir este día con otra persona
      </button>
    </div>
  `).join('');

  container.innerHTML = `
    <div class="step-block panel">
      <div class="step-header">
        <div class="step-badge">1</div>
        <h3 class="step-title">Datos de la tanda</h3>
      </div>
      <label class="field">
        <span class="field-label">Nombre</span>
        <input type="text" id="c-name-tanda" class="input-big" value="${esc(state.name)}" placeholder="Ej: Tanda oficina">
      </label>
      <label class="field">
        <span class="field-label">Total por fecha ($)</span>
        <input type="number" id="c-total" class="input-big" value="${state.totalPot || ''}" placeholder="30000" min="1" inputmode="numeric">
      </label>
      <label class="field">
        <span class="field-label">Fecha de inicio</span>
        <div class="date-input-wrap">
          <input type="date" id="c-start" value="${state.startDate || state.turns[0]?.date || ''}">
        </div>
      </label>
    </div>

    <div class="step-block panel">
      <div class="step-header">
        <div class="step-badge">2</div>
        <h3 class="step-title">Fechas y quién cobra</h3>
      </div>
      <p class="section-hint">Quién cobra cada día y cuánto aporta.</p>
      <div id="create-turns">${turnsHtml}</div>
      <button type="button" id="btn-add-turn" class="btn btn-secondary btn-block">
        <iconify-icon icon="solar:add-circle-bold" width="22"></iconify-icon> Agregar otra fecha (+15 días)
      </button>
    </div>

    <div class="step-block panel ${sumOk ? 'sum-ok' : ''}" id="create-summary">
      <div class="step-header">
        <div class="step-badge">3</div>
        <h3 class="step-title">Resumen</h3>
      </div>
      <div id="create-summary-body">
        ${renderSummaryHTML(state)}
      </div>
    </div>
  `;

  bindCreateEvents(container, state, onChange);
}

function getCreateSums(state) {
  const sum = state.turns.flatMap(t => t.members).reduce((s, m) => s + (+m.amount || 0), 0);
  const total = +state.totalPot || 0;
  return { sum, total, sumOk: total > 0 && sum === total };
}

function renderSummaryHTML(state) {
  const { sum, total, sumOk } = getCreateSums(state);
  return `
    <div class="sum-row"><span>Fechas:</span><strong>${state.turns.length}</strong></div>
    <div class="sum-row"><span>Suma de pagos:</span><strong>${formatMoney(sum)}</strong></div>
    <div class="sum-row total-row"><span>Total tanda:</span><strong>${formatMoney(total)}</strong></div>
    ${!sumOk && total > 0 ? '<p class="sum-warn">Los pagos deben sumar exactamente el total</p>' : ''}
    ${sumOk ? '<p class="sum-ok-msg">Todo cuadra correctamente</p>' : ''}`;
}

function updateCreateSummary(container, state) {
  const block = $('#create-summary', container);
  const body = $('#create-summary-body', container);
  if (!block || !body) return;

  const { sumOk } = getCreateSums(state);
  block.classList.toggle('sum-ok', sumOk);
  body.innerHTML = renderSummaryHTML(state);
}

function bindCreateEvents(container, state, onChange) {
  $('#c-name-tanda').oninput = e => { state.name = e.target.value; };
  $('#c-total').oninput = e => {
    state.totalPot = e.target.value;
    updateCreateSummary(container, state);
  };
  $('#c-start').oninput = e => {
    state.startDate = e.target.value;
    if (state.turns[0]) state.turns[0].date = e.target.value;
    const display = container.querySelector('.date-display');
    if (display && e.target.value) display.textContent = formatDate(e.target.value);
  };

  container.querySelectorAll('.c-date').forEach(inp => {
    inp.oninput = e => {
      const idx = +e.target.dataset.turn;
      state.turns[idx].date = e.target.value;
    };
  });
  container.querySelectorAll('.c-name').forEach(inp => {
    inp.oninput = e => {
      const { turn, member } = e.target.dataset;
      state.turns[+turn].members[+member].name = e.target.value;
    };
  });
  container.querySelectorAll('.c-amount').forEach(inp => {
    inp.oninput = e => {
      const { turn, member } = e.target.dataset;
      state.turns[+turn].members[+member].amount = e.target.value;
      updateCreateSummary(container, state);
    };
  });

  $$('.btn-rm-turn', container).forEach(btn => {
    btn.onclick = () => { state.turns.splice(+btn.dataset.idx, 1); onChange(); };
  });
  $$('.btn-rm-member', container).forEach(btn => {
    btn.onclick = () => {
      state.turns[+btn.dataset.turn].members.splice(+btn.dataset.member, 1);
      onChange();
    };
  });
  $$('.btn-add-share', container).forEach(btn => {
    btn.onclick = () => {
      state.turns[+btn.dataset.idx].members.push({ name: '', amount: '' });
      onChange();
    };
  });

  $('#btn-add-turn').onclick = () => {
    const last = state.turns[state.turns.length - 1];
    const base = last?.date || state.startDate;
    state.turns.push({ date: suggestNextDate(base, 15), members: [{ name: '', amount: '' }] });
    onChange();
  };
}

export function turnForm(tanda, turnNum, members, date) {
  const total = getTandaTotalPot(tanda);
  const list = members || [{ name: '', amount: 0 }];
  const canRemove = list.length > 1;
  const rows = list.map((m, i) => `
    <div class="member-row" data-idx="${i}" ${m.id ? `data-id="${m.id}"` : ''}>
      <input type="text" class="m-name input-big" placeholder="Nombre" value="${esc(m.name)}" required>
      <input type="number" class="m-amount input-big" placeholder="Cuánto aporta" value="${getMemberAmount(tanda, m) || ''}" min="1" inputmode="numeric">
      ${canRemove ? `<button type="button" class="btn-remove btn-rm-member"><iconify-icon icon="solar:close-circle-bold" width="20"></iconify-icon></button>` : '<div class="member-row-spacer" style="width:44px"></div>'}
    </div>`).join('');

  return `
    <label class="field">
      <span class="field-label">Fecha de pago</span>
      <div class="date-input-wrap">
        <input type="date" id="f-turn-date" value="${date || ''}" required>
      </div>
    </label>
    <p class="hint">¿Quién cobra este día?</p>
    <div id="members-container">${rows}</div>
    <button type="button" id="btn-add-member" class="btn btn-secondary btn-block" style="margin-top:8px">
      + Compartir con otra persona
    </button>
    <p class="hint" style="margin-top:8px">Total tanda: ${formatMoney(total)}</p>`;
}

export function editTandaForm(tanda) {
  return `
    <label class="field"><span class="field-label">Nombre</span>
      <input type="text" id="f-name" value="${esc(tanda.name)}" required></label>
    <label class="field"><span class="field-label">Total por fecha ($)</span>
      <input type="number" id="f-total" value="${getTandaTotalPot(tanda)}" min="1" class="input-big" required></label>
    <label class="field"><span class="field-label">Primera fecha</span>
      <div class="date-input-wrap">
        <input type="date" id="f-start" value="${tanda.startDate}" required>
      </div></label>
    <label class="field"><span class="field-label">Cada cuántos días</span>
      <input type="number" id="f-freq" value="${tanda.frequencyDays}" min="1" required></label>`;
}

export function getTurnMembersFromForm(tanda) {
  return $$('#members-container .member-row').map(row => ({
    name: $('.m-name', row).value.trim(),
    amount: +$('.m-amount', row).value || 0,
    id: row.dataset.id || uid()
  })).filter(m => m.name);
}

export function setupMemberForm(tanda, existingMembers) {
  $('#btn-add-member')?.addEventListener('click', () => {
    const container = $('#members-container');
    const div = document.createElement('div');
    div.className = 'member-row';
    div.innerHTML = `
      <input type="text" class="m-name" placeholder="Nombre" required>
      <input type="number" class="m-amount" placeholder="Cuánto paga" min="1">
      <button type="button" class="btn-remove btn-rm-member"><iconify-icon icon="solar:close-circle-bold" width="20"></iconify-icon></button>`;
    container.appendChild(div);
    syncMemberRemoveButtons();
  });
  if (existingMembers) {
    $$('#members-container .member-row').forEach((row, i) => {
      if (existingMembers[i]?.id) row.dataset.id = existingMembers[i].id;
    });
  }
  syncMemberRemoveButtons();
}

function syncMemberRemoveButtons() {
  const container = $('#members-container');
  if (!container) return;

  const rows = $$('.member-row', container);
  const canRemove = rows.length > 1;

  rows.forEach(row => {
    let btn = $('.btn-rm-member', row);
    let spacer = row.querySelector('.member-row-spacer');

    if (canRemove && !btn) {
      if (spacer) spacer.remove();
      const b = document.createElement('button');
      b.type = 'button';
      b.className = 'btn-remove btn-rm-member';
      b.innerHTML = '<iconify-icon icon="solar:close-circle-bold" width="20"></iconify-icon>';
      row.appendChild(b);
    } else if (!canRemove && btn) {
      btn.remove();
      if (!spacer) {
        const d = document.createElement('div');
        d.className = 'member-row-spacer';
        d.style.width = '44px';
        row.appendChild(d);
      }
    }
  });

  $$('.btn-rm-member', container).forEach(btn => {
    btn.onclick = () => {
      if ($$('.member-row', container).length <= 1) return;
      btn.closest('.member-row').remove();
      syncMemberRemoveButtons();
    };
  });
}

function esc(str) {
  const d = document.createElement('div');
  d.textContent = str ?? '';
  return d.innerHTML;
}
