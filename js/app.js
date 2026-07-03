import {
  isLoggedIn, verifyLogin, login, logout,
  initData, getData, saveTanda, deleteTanda, getTanda,
  loadExampleData, getLastSavedAt
} from './store.js';
import { downloadTandaPDF } from './pdf.js';
import {
  createTanda, togglePayment, addTurn, removeTurn, updateTurn,
  recalcDates, rebalanceAmounts, getTandaTotalPot, distributeAmounts, suggestNextDate
} from './tanda.js';
import { uid, showToast, $, $$ } from './utils.js';
import {
  showView, openModal, closeModal,
  renderDashboard, renderTandaHeader, renderFechas, renderPersonas,
  renderCreateTanda, editTandaForm, turnForm,
  getTurnMembersFromForm, setupMemberForm
} from './ui.js';

let currentTandaId = null;
let expandedDate = null;
let fechasInitialized = false;

let createState = {
  name: '',
  totalPot: '',
  startDate: new Date().toISOString().slice(0, 10),
  turns: [{ members: [{ name: '', amount: 0 }] }]
};

async function boot() {
  await initData();
  if (isLoggedIn()) showDashboard();
  else showView('view-login');
  bindEvents();
}

function bindEvents() {
  $('#form-login').addEventListener('submit', async e => {
    e.preventDefault();
    $('#login-error').classList.add('hidden');
    try {
      const ok = await verifyLogin($('#login-user').value.trim(), $('#login-pass').value);
      if (!ok) {
        $('#login-error').textContent = 'Usuario o contraseña incorrectos';
        $('#login-error').classList.remove('hidden');
        return;
      }
      login();
      showDashboard();
    } catch {
      $('#login-error').textContent = 'No se pudo verificar el acceso. Recarga la pagina.';
      $('#login-error').classList.remove('hidden');
    }
  });

  $('#btn-logout').addEventListener('click', () => {
    logout();
    showView('view-login');
    $('#login-pass').value = '';
  });

  $('#btn-new-tanda').addEventListener('click', showCreateView);

  $('#btn-load-example').addEventListener('click', async () => {
    try {
      await loadExampleData();
      showToast('Tanda de ejemplo cargada');
      showDashboard();
    } catch {
      showToast('No se pudo cargar el ejemplo');
    }
  });

  $('#btn-back-create').addEventListener('click', showDashboard);
  $('#btn-save-tanda').addEventListener('click', saveNewTanda);
  $('#btn-back').addEventListener('click', showDashboard);

  $('#btn-tanda-menu').addEventListener('click', e => {
    e.stopPropagation();
    $('#tanda-menu').classList.toggle('hidden');
  });

  document.addEventListener('click', () => $('#tanda-menu').classList.add('hidden'));

  $('#tanda-menu').addEventListener('click', e => {
    e.stopPropagation();
    const btn = e.target.closest('button[data-action]');
    const action = btn?.dataset.action;
    if (action === 'edit') showEditTandaModal();
    if (action === 'delete') confirmDeleteTanda();
    if (action === 'pdf') downloadTandaPDFAction(currentTandaId);
    $('#tanda-menu').classList.add('hidden');
  });

  $$('.tab').forEach(tab => {
    tab.addEventListener('click', () => {
      $$('.tab').forEach(t => t.classList.remove('active'));
      $$('.tab-panel').forEach(p => p.classList.remove('active'));
      tab.classList.add('active');
      $(`#tab-${tab.dataset.tab}`).classList.add('active');
    });
  });

  $('#btn-add-person').addEventListener('click', () => showTurnModal(null));
  $('#modal-close').addEventListener('click', closeModal);
  $('.modal-backdrop').addEventListener('click', closeModal);
}

function downloadTandaPDFAction(id) {
  const tanda = getTanda(id);
  if (!tanda) return showToast('Tanda no encontrada');
  try {
    downloadTandaPDF(tanda);
    showToast('PDF descargado');
  } catch (err) {
    showToast(err?.message || 'No se pudo crear el PDF');
  }
}

function showDashboard() {
  currentTandaId = null;
  renderDashboard(getData().tandas, openTanda, downloadTandaPDFAction, getLastSavedAt());
  showView('view-dashboard');
}

function showCreateView() {
  const today = new Date().toISOString().slice(0, 10);
  createState = {
    name: '',
    totalPot: '',
    startDate: today,
    turns: [{ date: today, members: [{ name: '', amount: '' }] }]
  };
  renderCreate();
  showView('view-create');
}

function renderCreate() {
  const container = $('#create-form');
  const refresh = () => renderCreateTanda(container, createState, refresh);
  renderCreateTanda(container, createState, refresh);
}

function saveNewTanda() {
  const name = createState.name.trim() || $('#c-name-tanda')?.value?.trim();
  const totalPot = +createState.totalPot || +$('#c-total')?.value;
  const startDate = createState.startDate || $('#c-start')?.value;

  if (!name) return showToast('Escribe el nombre');
  if (!totalPot || totalPot < 1) return showToast('Escribe el total');
  if (!startDate) return showToast('Elige la fecha de inicio');

  if (createState.turns[0]) createState.turns[0].date = startDate;

  const turns = createState.turns
    .map((t, i) => ({
      turn: i + 1,
      date: t.date,
      members: t.members
        .filter(m => m.name.trim())
        .map(m => ({ id: uid(), name: m.name.trim(), amount: +m.amount || 0 }))
    }))
    .filter(t => t.members.length > 0);

  if (!turns.length) return showToast('Agrega al menos una persona');
  if (turns.some(t => !t.date)) return showToast('Falta poner una fecha');

  const sum = turns.flatMap(t => t.members).reduce((s, m) => s + m.amount, 0);
  if (sum !== totalPot) {
    const allZero = turns.flatMap(t => t.members).every(m => !m.amount);
    if (allZero) distributeAmounts(turns, totalPot);
    else return showToast(`Suma ${sum}, debe ser ${totalPot}`);
  }

  try {
    const tanda = createTanda({
      name,
      totalPot,
      startDate: turns[0].date,
      frequencyDays: 15,
      turns,
      dates: turns.map(t => t.date)
    });
    saveTanda(tanda);
    showToast('Tanda creada y guardada');
    openTanda(tanda.id);
  } catch {
    showToast('No se pudo guardar la tanda');
  }
}

function openTanda(id) {
  currentTandaId = id;
  expandedDate = null;
  fechasInitialized = false;
  refreshTandaView();
  showView('view-tanda');
}

function refreshTandaView() {
  const tanda = getTanda(currentTandaId);
  if (!tanda) return showDashboard();

  const resetScroll = !fechasInitialized;

  renderTandaHeader(tanda);
  renderFechas(tanda, handleToggle, {
    openDate: expandedDate,
    onExpand: date => { expandedDate = date; fechasInitialized = true; }
  });
  fechasInitialized = true;
  renderPersonas(tanda, showTurnModal, confirmDeleteTurn);

  if (resetScroll) {
    const scrollParent = $('#fechas-list')?.closest('.container');
    if (scrollParent) scrollParent.scrollTop = 0;
  }
}

function handleToggle(date, memberId) {
  expandedDate = date;
  try {
    let tanda = getTanda(currentTandaId);
    tanda = togglePayment(tanda, date, memberId);
    saveTanda(tanda);
    refreshTandaView();
  } catch {
    showToast('No se pudo guardar el pago');
  }
}

function showEditTandaModal() {
  const tanda = getTanda(currentTandaId);
  openModal('Editar tanda', editTandaForm(tanda),
    `<button class="btn btn-secondary" id="modal-cancel">Cancelar</button>
     <button class="btn btn-primary" id="modal-save">Guardar</button>`);

  $('#modal-cancel').onclick = closeModal;
  $('#modal-save').onclick = () => {
    const name = $('#f-name').value.trim();
    const totalPot = +$('#f-total').value;
    const freq = +$('#f-freq').value;
    const start = $('#f-start').value;
    if (!name) return showToast('Escribe el nombre');
    if (!totalPot || totalPot < 1) return showToast('Total inválido');
    if (!freq || freq < 1) return showToast('Días inválidos');
    if (!start) return showToast('Elige la fecha');

    tanda.name = name;
    tanda.totalPot = totalPot;
    tanda.frequencyDays = freq;
    tanda.startDate = start;
    rebalanceAmounts(tanda);
    recalcDates(tanda);

    try {
      saveTanda(tanda);
      closeModal();
      refreshTandaView();
      showToast('Guardado');
    } catch {
      showToast('No se pudo guardar');
    }
  };
}

function showTurnModal(turnNum) {
  const tanda = getTanda(currentTandaId);
  const existing = turnNum ? tanda.participants.find(p => p.turn === turnNum) : null;
  const isNew = !turnNum;
  const turnDate = turnNum
    ? tanda.dates[turnNum - 1]
    : suggestNextDate(tanda.dates[tanda.dates.length - 1], tanda.frequencyDays || 15);

  openModal(isNew ? 'Nueva fecha' : `Editar fecha ${turnNum}`,
    turnForm(tanda, turnNum, existing?.members, turnDate),
    `<button class="btn btn-secondary" id="modal-cancel">Cancelar</button>
     <button class="btn btn-primary" id="modal-save">Guardar</button>`);

  setupMemberForm(tanda, existing?.members);
  $('#modal-cancel').onclick = closeModal;
  $('#modal-save').onclick = () => {
    const members = getTurnMembersFromForm(tanda);
    const newDate = $('#f-turn-date').value;
    if (!members.length) return showToast('Escribe al menos un nombre');
    if (!newDate) return showToast('Elige la fecha');

    const sum = members.reduce((s, m) => s + m.amount, 0);
    const total = getTandaTotalPot(tanda);
    const othersSum = tanda.participants
      .filter(p => p.turn !== turnNum)
      .flatMap(p => p.members)
      .reduce((s, m) => s + (m.amount || 0), 0);
    if (othersSum + sum !== total) return showToast(`La suma debe ser ${total}`);

    if (isNew) addTurn(tanda, members, newDate);
    else {
      updateTurn(tanda, turnNum, members);
      tanda.dates[turnNum - 1] = newDate;
    }

    try {
      saveTanda(tanda);
      closeModal();
      refreshTandaView();
      showToast('Guardado');
    } catch {
      showToast('No se pudo guardar');
    }
  };
}

function confirmDeleteTurn(turnNum) {
  openModal('Eliminar fecha', `<p class="modal-text">¿Eliminar la fecha ${turnNum}?</p>`,
    `<button class="btn btn-secondary" id="modal-cancel">No</button>
     <button class="btn btn-danger" id="modal-confirm">Sí, eliminar</button>`);

  $('#modal-cancel').onclick = closeModal;
  $('#modal-confirm').onclick = () => {
    try {
      const tanda = getTanda(currentTandaId);
      removeTurn(tanda, turnNum);
      saveTanda(tanda);
      closeModal();
      refreshTandaView();
      showToast('Eliminado');
    } catch {
      showToast('No se pudo eliminar');
    }
  };
}

function confirmDeleteTanda() {
  const tanda = getTanda(currentTandaId);
  openModal('Eliminar tanda', `<p class="modal-text">¿Eliminar "${tanda.name}"?</p>`,
    `<button class="btn btn-secondary" id="modal-cancel">No</button>
     <button class="btn btn-danger" id="modal-confirm">Sí, eliminar</button>`);

  $('#modal-cancel').onclick = closeModal;
  $('#modal-confirm').onclick = () => {
    deleteTanda(currentTandaId);
    closeModal();
    showToast('Eliminada');
    showDashboard();
  };
}

boot();
