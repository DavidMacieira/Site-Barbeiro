// ============================================================
//  ADMIN.JS — Painel do Barbeiro João Angeiras
// ============================================================

document.addEventListener('DOMContentLoaded', async () => {
  if (!barbeariaAPI.checkAuth()) {
    window.location.href = 'index.html';
    return;
  }
  await initPanel();
});

// ── INICIALIZAÇÃO ────────────────────────────────────────────
async function initPanel() {
  startClock();
  setDefaultDates();
  setupFilters();

  await Promise.all([
    loadStats(),
    loadAllBookings(),
    loadBlockedDates(),
    loadSettings(),
    checkAPIStatus(),
  ]);

  renderCalendar();

  // Auto-refresh stats a cada 30s
  setInterval(loadStats, 30000);
}

// ── RELÓGIO ──────────────────────────────────────────────────
function startClock() {
  const tick = () => {
    const now = new Date();
    const timeEl = document.getElementById('topbarTime');
    const dateEl = document.getElementById('topbarDate');
    if (timeEl) timeEl.textContent = now.toLocaleTimeString('pt-PT', { hour: '2-digit', minute: '2-digit' });
    if (dateEl) dateEl.textContent = now.toLocaleDateString('pt-PT', { weekday: 'long', day: '2-digit', month: 'long' });
  };
  tick();
  setInterval(tick, 1000);
}

// ── TABS ─────────────────────────────────────────────────────
function showTab(tabId, btn) {
  document.querySelectorAll('.tab-view').forEach(t => t.classList.remove('active'));
  document.querySelectorAll('.sidebar-btn').forEach(b => b.classList.remove('active'));
  document.getElementById(tabId)?.classList.add('active');
  if (btn) btn.classList.add('active');

  if (tabId === 'tabCalendar') renderCalendar();
  if (tabId === 'tabBookings') loadAllBookings();
  if (tabId === 'tabBlocked')  loadBlockedDates();
}

// ── STATS ────────────────────────────────────────────────────
async function loadStats() {
  try {
    const s = await barbeariaAPI.getStats();
    setText('statToday',   s.today   ?? 0);
    setText('statWeek',    s.week    ?? 0);
    setText('statPending', s.pending ?? 0);
    setText('statRevenue', ((s.revenue ?? 0).toFixed(2)) + '€');

    // Badge sidebar
    const badge = document.getElementById('sidebarPendingBadge');
    if (badge) {
      badge.textContent = s.pending ?? 0;
      badge.style.display = (s.pending > 0) ? 'inline-flex' : 'none';
    }
  } catch (e) {
    console.error('loadStats:', e);
  }
}

// ── CALENDÁRIO ───────────────────────────────────────────────
let calView  = 'week';   // 'week' | 'month'
let calDate  = new Date();
let allBookingsCache = [];
let blockedDatesCache = [];

function switchCalView(v) {
  calView = v;
  document.getElementById('btnWeek').classList.toggle('active', v === 'week');
  document.getElementById('btnMonth').classList.toggle('active', v === 'month');
  renderCalendar();
}

function calPrev()  { moveCalendar(-1); }
function calNext()  { moveCalendar(+1); }
function calToday() { calDate = new Date(); renderCalendar(); }

function moveCalendar(dir) {
  if (calView === 'week') {
    calDate.setDate(calDate.getDate() + dir * 7);
  } else {
    calDate.setMonth(calDate.getMonth() + dir);
  }
  renderCalendar();
}

async function renderCalendar() {
  try {
    // Garantir dados actualizados
    const [bookings, blocked] = await Promise.all([
      barbeariaAPI.getBookings({}),
      barbeariaAPI.getBlockedDates()
    ]);
    allBookingsCache  = bookings  || [];
    blockedDatesCache = blocked   || [];
  } catch (e) {
    console.error('renderCalendar fetch:', e);
  }

  const container = document.getElementById('calContainer');
  if (!container) return;

  if (calView === 'week') {
    renderWeekView(container);
  } else {
    renderMonthView(container);
  }
}

// ── WEEK VIEW ────────────────────────────────────────────────
function renderWeekView(container) {
  const monday = getMonday(calDate);
  const days   = Array.from({ length: 7 }, (_, i) => {
    const d = new Date(monday);
    d.setDate(d.getDate() + i);
    return d;
  });

  // Update title
  const startFmt = days[0].toLocaleDateString('pt-PT', { day: '2-digit', month: 'short' });
  const endFmt   = days[6].toLocaleDateString('pt-PT', { day: '2-digit', month: 'short', year: 'numeric' });
  document.getElementById('calTitle').textContent = `${startFmt} – ${endFmt}`;

  const hours = [];
  for (let h = 9; h <= 19; h++) hours.push(h);

  const today    = toDateStr(new Date());
  const dayNames = ['Dom', 'Seg', 'Ter', 'Qua', 'Qui', 'Sex', 'Sáb'];

  let html = `<div class="week-grid">`;

  // Time column header (empty)
  html += `<div class="week-time-col">`;
  html += `<div style="height:56px;background:var(--black-4);border-bottom:1px solid rgba(255,255,255,0.05);"></div>`;
  hours.forEach(h => {
    html += `<div class="week-time-label">${String(h).padStart(2,'0')}:00</div>`;
  });
  html += `</div>`;

  // Day columns
  days.forEach(day => {
    const ds       = toDateStr(day);
    const isToday  = ds === today;
    const isBlocked = isDayBlocked(ds);

    html += `<div class="week-day-col">`;
    html += `<div class="week-day-header${isToday ? ' today' : ''}${isBlocked ? ' blocked' : ''}">`;
    html += `<div class="week-day-name">${dayNames[day.getDay()]}</div>`;
    html += `<div class="week-day-date">${day.getDate()}</div>`;
    html += `</div>`;

    hours.forEach(h => {
      const slotClass = isBlocked ? ' blocked-day' : '';
      html += `<div class="week-slot${slotClass}">`;
      if (!isBlocked) {
        const slotBookings = allBookingsCache.filter(b =>
          b.date === ds &&
          b.time && parseInt(b.time.split(':')[0]) === h &&
          b.status !== 'cancelled'
        );
        slotBookings.forEach(b => {
          const top = (parseInt((b.time.split(':')[1] || '0')) / 60) * 60;
          const height = Math.max(((b.duration || 30) / 60) * 60, 28);
          html += `<div class="booking-block status-${b.status}"
            style="top:${top}px; height:${height - 4}px;"
            onclick="openBookingDetail('${b.id}')">
            <div class="bb-time">${b.time}</div>
            <div class="bb-name">${escHtml(b.name || '—')}</div>
            <div class="bb-service">${escHtml(b.service || '')}</div>
          </div>`;
        });
      }
      html += `</div>`;
    });

    html += `</div>`;
  });

  html += `</div>`;
  container.innerHTML = html;
}

// ── MONTH VIEW ───────────────────────────────────────────────
function renderMonthView(container) {
  const year  = calDate.getFullYear();
  const month = calDate.getMonth();

  document.getElementById('calTitle').textContent =
    new Date(year, month).toLocaleDateString('pt-PT', { month: 'long', year: 'numeric' });

  const firstDay  = new Date(year, month, 1);
  const lastDay   = new Date(year, month + 1, 0);
  const startWeek = (firstDay.getDay() + 6) % 7; // Monday-start
  const today     = toDateStr(new Date());

  const dayLabels = ['Seg','Ter','Qua','Qui','Sex','Sáb','Dom'];

  let html = `<div class="month-grid">`;
  html += `<div class="month-weekdays">` + dayLabels.map(l => `<div class="month-weekday-label">${l}</div>`).join('') + `</div>`;
  html += `<div class="month-days">`;

  // Padding before
  for (let i = 0; i < startWeek; i++) {
    const d = new Date(year, month, 1 - startWeek + i);
    html += renderMonthDay(d, true, today);
  }

  for (let d = 1; d <= lastDay.getDate(); d++) {
    const date = new Date(year, month, d);
    html += renderMonthDay(date, false, today);
  }

  // Padding after
  const totalCells = startWeek + lastDay.getDate();
  const remainder  = totalCells % 7 === 0 ? 0 : 7 - (totalCells % 7);
  for (let i = 1; i <= remainder; i++) {
    const d = new Date(year, month + 1, i);
    html += renderMonthDay(d, true, today);
  }

  html += `</div></div>`;
  container.innerHTML = html;
}

function renderMonthDay(date, otherMonth, today) {
  const ds        = toDateStr(date);
  const isToday   = ds === today;
  const isBlocked = isDayBlocked(ds);
  const bookings  = otherMonth ? [] : allBookingsCache.filter(b =>
    b.date === ds && b.status !== 'cancelled'
  );

  let cls = 'month-day';
  if (otherMonth) cls += ' other-month';
  if (isToday)    cls += ' today';
  if (isBlocked)  cls += ' blocked';

  const clickAttr = !otherMonth && !isBlocked
    ? `onclick="onMonthDayClick('${ds}')"` : '';

  let html = `<div class="${cls}" ${clickAttr}>`;
  html += `<div class="month-day-num">${date.getDate()}</div>`;

  if (isBlocked) {
    const label = getBlockedLabel(ds);
    html += `<div class="month-blocked-label"><i class="fas fa-ban"></i>${escHtml(label)}</div>`;
  } else {
    html += `<div class="month-mini-bookings">`;
    bookings.slice(0, 3).forEach(b => {
      html += `<div class="month-mini-booking status-${b.status}" onclick="openBookingDetail('${b.id}');event.stopPropagation();">
        ${escHtml(b.time || '')} ${escHtml(b.name || '')}
      </div>`;
    });
    if (bookings.length > 3) {
      html += `<div class="month-more">+${bookings.length - 3} mais</div>`;
    }
    html += `</div>`;
  }

  html += `</div>`;
  return html;
}

function onMonthDayClick(ds) {
  // Ao clicar num dia no mês, abrir semana view nesse dia
  calDate = new Date(ds);
  switchCalView('week');
}

// ── BOOKING DETAIL MODAL ─────────────────────────────────────
function openBookingDetail(bookingId) {
  const b = allBookingsCache.find(x => x.id === bookingId || x.id == bookingId);
  if (!b) return;

  const statusLabels = { pending: 'Pendente', confirmed: 'Confirmado', completed: 'Concluído', cancelled: 'Cancelado' };
  const statusLabel  = statusLabels[b.status] || b.status;

  const body = document.getElementById('modalBookingDetailBody');
  const footer = document.getElementById('modalBookingDetailFooter');

  body.innerHTML = `
    <div class="booking-detail-grid">
      <div class="booking-detail-item">
        <label>Cliente</label>
        <div class="val">${escHtml(b.name || '—')}</div>
      </div>
      <div class="booking-detail-item">
        <label>Telefone</label>
        <div class="val">${escHtml(b.phone || '—')}</div>
      </div>
      <div class="booking-detail-item">
        <label>Serviço</label>
        <div class="val">${escHtml(b.service || '—')}</div>
      </div>
      <div class="booking-detail-item">
        <label>Preço</label>
        <div class="val gold">${b.price || 0}€</div>
      </div>
      <div class="booking-detail-item">
        <label>Data</label>
        <div class="val">${formatDate(b.date)}</div>
      </div>
      <div class="booking-detail-item">
        <label>Hora</label>
        <div class="val">${b.time || '—'}</div>
      </div>
      <div class="booking-detail-item" style="grid-column:1/-1;">
        <label>Estado</label>
        <div><span class="badge badge-${b.status}">${statusLabel}</span></div>
      </div>
      ${b.notes ? `<div class="booking-detail-item" style="grid-column:1/-1;">
        <label>Notas</label>
        <div class="val">${escHtml(b.notes)}</div>
      </div>` : ''}
    </div>
  `;

  // Action buttons
  let footerHtml = `<button class="btn btn-ghost" onclick="closeModal('modalBookingDetail')">Fechar</button>`;

  if (b.phone) {
    footerHtml += `<button class="btn btn-outline" onclick="contactWhatsApp('${b.phone}','${escHtml(b.name || '')}')">
      <i class="fab fa-whatsapp"></i> WhatsApp
    </button>`;
  }

  if (b.status === 'pending') {
    footerHtml += `<button class="btn btn-primary" onclick="confirmBooking('${b.id}')">
      <i class="fas fa-check"></i> Confirmar
    </button>`;
  }

  if (b.status === 'confirmed') {
    footerHtml += `<button class="btn btn-success" onclick="completeBooking('${b.id}')">
      <i class="fas fa-check-double"></i> Concluído
    </button>`;
  }

  if (b.status !== 'cancelled' && b.status !== 'completed') {
    footerHtml += `<button class="btn btn-danger" onclick="cancelBooking('${b.id}')">
      <i class="fas fa-times"></i> Cancelar
    </button>`;
  }

  footer.innerHTML = footerHtml;
  openModal('modalBookingDetail');
}

// ── RESERVAS TABLE ───────────────────────────────────────────
async function loadAllBookings() {
  const tbody = document.getElementById('bookingsBody');
  if (!tbody) return;

  tbody.innerHTML = `<tr><td colspan="8" class="empty-state"><div class="spinner"></div></td></tr>`;

  const filterDate   = document.getElementById('filterDate')?.value;
  const filterStatus = document.getElementById('filterStatus')?.value;
  const filters      = {};
  if (filterDate)   filters.date   = filterDate;
  if (filterStatus) filters.status = filterStatus;

  const bookings = await barbeariaAPI.getBookings(filters).catch(() => []);
  allBookingsCache = bookings;

  if (!bookings || bookings.length === 0) {
    tbody.innerHTML = `<tr><td colspan="8" class="empty-state">
      <i class="fas fa-calendar-times"></i>
      <p>Nenhuma reserva encontrada</p>
    </td></tr>`;
    return;
  }

  tbody.innerHTML = bookings.map(b => {
    const statusLabels = { pending: 'Pendente', confirmed: 'Confirmado', completed: 'Concluído', cancelled: 'Cancelado' };
    return `<tr>
      <td class="muted">${formatDate(b.date)}</td>
      <td>${b.time || '—'}</td>
      <td>${escHtml(b.name || '—')}</td>
      <td class="muted">${escHtml(b.phone || '—')}</td>
      <td>${escHtml(b.service || '—')}</td>
      <td style="color:var(--gold)">${b.price || 0}€</td>
      <td><span class="badge badge-${b.status}">${statusLabels[b.status] || b.status}</span></td>
      <td>
        <div class="action-row">
          ${b.status === 'pending' ? `
            <button class="btn btn-success btn-sm btn-icon" title="Confirmar" onclick="confirmBooking('${b.id}')"><i class="fas fa-check"></i></button>
          ` : ''}
          ${b.status === 'confirmed' ? `
            <button class="btn btn-blue btn-sm btn-icon" title="Concluir" onclick="completeBooking('${b.id}')"><i class="fas fa-check-double"></i></button>
          ` : ''}
          ${b.status !== 'cancelled' && b.status !== 'completed' ? `
            <button class="btn btn-danger btn-sm btn-icon" title="Cancelar" onclick="cancelBooking('${b.id}')"><i class="fas fa-times"></i></button>
          ` : ''}
          <button class="btn btn-ghost btn-sm btn-icon" title="Ver detalhes" onclick="openBookingDetail('${b.id}')"><i class="fas fa-eye"></i></button>
          ${b.phone ? `
            <button class="btn btn-ghost btn-sm btn-icon" title="WhatsApp" onclick="contactWhatsApp('${b.phone}','${escHtml(b.name || '')}')"><i class="fab fa-whatsapp"></i></button>
          ` : ''}
          <button class="btn btn-danger btn-sm btn-icon" title="Apagar" onclick="deleteBooking('${b.id}')"><i class="fas fa-trash"></i></button>
        </div>
      </td>
    </tr>`;
  }).join('');
}

function clearFilters() {
  document.getElementById('filterDate').value   = '';
  document.getElementById('filterStatus').value = '';
  loadAllBookings();
}

function setupFilters() {
  document.getElementById('filterDate')?.addEventListener('change',   loadAllBookings);
  document.getElementById('filterStatus')?.addEventListener('change', loadAllBookings);
}

// ── AÇÕES RESERVAS ───────────────────────────────────────────
async function confirmBooking(id) {
  const ok = await barbeariaAPI.updateBookingStatus(id, 'confirmed').catch(() => null);
  if (ok?.success) {
    toast('Marcação confirmada!', 'success');
    closeModal('modalBookingDetail');
    await Promise.all([loadStats(), loadAllBookings(), renderCalendar()]);
  } else {
    toast('Erro ao confirmar', 'error');
  }
}

async function completeBooking(id) {
  const ok = await barbeariaAPI.updateBookingStatus(id, 'completed').catch(() => null);
  if (ok?.success) {
    toast('Marcação concluída! ✓', 'success');
    closeModal('modalBookingDetail');
    await Promise.all([loadStats(), loadAllBookings(), renderCalendar()]);
  } else {
    toast('Erro ao concluir', 'error');
  }
}

async function cancelBooking(id) {
  if (!confirm('Cancelar esta marcação?')) return;
  const ok = await barbeariaAPI.updateBookingStatus(id, 'cancelled').catch(() => null);
  if (ok?.success) {
    toast('Marcação cancelada', 'warning');
    closeModal('modalBookingDetail');
    await Promise.all([loadStats(), loadAllBookings(), renderCalendar()]);
  } else {
    toast('Erro ao cancelar', 'error');
  }
}

async function deleteBooking(id) {
  if (!confirm('Apagar permanentemente esta marcação?')) return;
  const ok = await barbeariaAPI.deleteBooking(id).catch(() => null);
  if (ok?.success) {
    toast('Marcação apagada', 'info');
    await Promise.all([loadStats(), loadAllBookings(), renderCalendar()]);
  } else {
    toast('Erro ao apagar', 'error');
  }
}

function contactWhatsApp(phone, name) {
  const clean = phone.replace(/\D/g, '');
  const msg   = `Olá ${name}, aqui é da Barbearia João Angeiras.`;
  window.open(`https://wa.me/${clean}?text=${encodeURIComponent(msg)}`, '_blank');
}

// ── RESERVA MANUAL ───────────────────────────────────────────
function setDefaultDates() {
  const today = toDateStr(new Date());
  const mDate = document.getElementById('mDate');
  if (mDate) mDate.value = today;
}

async function saveManualBooking() {
  const name    = document.getElementById('mName').value.trim();
  const phone   = document.getElementById('mPhone').value.trim();
  const service = document.getElementById('mService').value;
  const date    = document.getElementById('mDate').value;
  const time    = document.getElementById('mTime').value;
  const status  = document.getElementById('mStatus').value;
  const notes   = document.getElementById('mNotes').value.trim();

  if (!name || !phone || !service || !date || !time) {
    toast('Preencha todos os campos obrigatórios', 'error');
    return;
  }

  const [svcName, svcPrice, svcDuration] = service.split('|');

  const data = {
    name, phone,
    service:  svcName,
    price:    parseFloat(svcPrice),
    duration: parseInt(svcDuration),
    date, time, status, notes,
    created_by: 'barbeiro'
  };

  const result = await barbeariaAPI.saveBooking(data).catch(() => null);

  if (result?.success) {
    toast('Reserva criada com sucesso!', 'success');
    clearManualForm();
    await Promise.all([loadStats(), renderCalendar()]);
  } else {
    toast(result?.error || 'Erro ao guardar reserva', 'error');
  }
}

function clearManualForm() {
  ['mName','mPhone','mNotes'].forEach(id => {
    const el = document.getElementById(id);
    if (el) el.value = '';
  });
  document.getElementById('mService').value = '';
  document.getElementById('mStatus').value  = 'confirmed';
  setDefaultDates();
}

// ── DIAS BLOQUEADOS ──────────────────────────────────────────
async function loadBlockedDates() {
  const dates = await barbeariaAPI.getBlockedDates().catch(() => []);
  blockedDatesCache = dates || [];
  renderBlockedList(dates);
}

function renderBlockedList(dates) {
  const el = document.getElementById('blockedList');
  if (!el) return;

  if (!dates || dates.length === 0) {
    el.innerHTML = `<p style="color:var(--white-dim);font-size:0.85rem;">Nenhum dia bloqueado.</p>`;
    return;
  }

  el.innerHTML = dates.map(d => {
    let period = formatDate(d.startDate);
    if (d.endDate && d.endDate !== d.startDate) {
      period += ` → ${formatDate(d.endDate)}`;
    }
    return `<div class="blocked-chip">
      <i class="fas fa-ban"></i>
      <span><strong>${escHtml(d.description || 'Bloqueado')}</strong> — ${period}</span>
      <button onclick="removeBlockedDate('${d.id}')" title="Remover bloqueio">
        <i class="fas fa-times"></i>
      </button>
    </div>`;
  }).join('');
}

function toggleBlockEndDate() {
  const type = document.getElementById('blockType').value;
  document.getElementById('blockEndGroup').style.display = type === 'range' ? 'block' : 'none';
}

async function addBlockedDate() {
  const desc  = document.getElementById('blockDesc').value.trim();
  const type  = document.getElementById('blockType').value;
  const start = document.getElementById('blockStart').value;
  const end   = document.getElementById('blockEnd').value;

  if (!desc || !start) {
    toast('Preencha a descrição e a data', 'error');
    return;
  }
  if (type === 'range' && (!end || end < start)) {
    toast('Data de fim inválida', 'error');
    return;
  }

  const payload = { description: desc, startDate: start, type };
  if (type === 'range') payload.endDate = end;

  const result = await barbeariaAPI.addBlockedDate(payload).catch(() => null);

  if (result?.success) {
    toast('Dia bloqueado!', 'success');
    document.getElementById('blockDesc').value  = '';
    document.getElementById('blockStart').value = '';
    document.getElementById('blockEnd').value   = '';
    await loadBlockedDates();
    renderCalendar();
  } else {
    toast(result?.error || 'Erro ao bloquear', 'error');
  }
}

async function removeBlockedDate(id) {
  if (!confirm('Remover este bloqueio?')) return;
  const result = await barbeariaAPI.removeBlockedDate(id).catch(() => null);
  if (result?.success) {
    toast('Bloqueio removido!', 'success');
    await loadBlockedDates();
    renderCalendar();
  } else {
    toast('Erro ao remover bloqueio', 'error');
  }
}

function isDayBlocked(dateStr) {
  return blockedDatesCache.some(b => {
    if (b.startDate === dateStr) return true;
    if (b.endDate && b.startDate <= dateStr && dateStr <= b.endDate) return true;
    return false;
  });
}

function getBlockedLabel(dateStr) {
  const b = blockedDatesCache.find(b =>
    b.startDate === dateStr ||
    (b.endDate && b.startDate <= dateStr && dateStr <= b.endDate)
  );
  return b?.description || 'Fechado';
}

// ── CONFIGURAÇÕES ────────────────────────────────────────────
async function loadSettings() {
  try {
    const settings = await barbeariaAPI.getSettings();

    if (settings.workingHours) {
      const wh = settings.workingHours;
      setValue('cfgOpen',       wh.open       || '09:00');
      setValue('cfgClose',      wh.close      || '19:00');
      setValue('cfgBreakStart', wh.breakStart || '13:00');
      setValue('cfgBreakEnd',   wh.breakEnd   || '14:00');

      const days = wh.workingDays || [2, 3, 4, 5, 6];
      document.querySelectorAll('input[name="workingDays"]').forEach(cb => {
        cb.checked = days.includes(parseInt(cb.value));
      });
    }

    if (settings.whatsapp) {
      setValue('cfgWhatsapp',    settings.whatsapp.number           || '');
      setValue('cfgWhatsappMsg', settings.whatsapp.mensagem_padrao  || '');
    }
  } catch (e) {
    console.error('loadSettings:', e);
  }
}

async function saveWorkingHours() {
  const days = Array.from(document.querySelectorAll('input[name="workingDays"]:checked'))
    .map(cb => parseInt(cb.value));

  if (days.length === 0) {
    toast('Selecione pelo menos um dia de trabalho', 'error');
    return;
  }

  const payload = {
    workingHours: {
      open:       document.getElementById('cfgOpen').value,
      close:      document.getElementById('cfgClose').value,
      breakStart: document.getElementById('cfgBreakStart').value,
      breakEnd:   document.getElementById('cfgBreakEnd').value,
      workingDays: days
    }
  };

  const result = await barbeariaAPI.saveSettings(payload).catch(() => null);
  if (result?.success) {
    toast('Horários guardados!', 'success');
  } else {
    toast('Erro ao guardar horários', 'error');
  }
}

async function saveWhatsAppSettings() {
  const number  = document.getElementById('cfgWhatsapp').value.trim();
  const message = document.getElementById('cfgWhatsappMsg').value.trim();

  if (!number) {
    toast('Digite o número de WhatsApp', 'error');
    return;
  }

  const payload = { whatsapp: { number, mensagem_padrao: message } };
  const result  = await barbeariaAPI.saveSettings(payload).catch(() => null);

  if (result?.success) {
    toast('Configurações de WhatsApp guardadas!', 'success');
  } else {
    toast('Erro ao guardar', 'error');
  }
}

async function checkAPIStatus() {
  const el = document.getElementById('apiStatusDisplay');
  if (!el) return;

  el.innerHTML = `<span style="color:var(--white-dim)"><i class="fas fa-spinner fa-spin"></i> A verificar...</span>`;

  try {
    const result = await barbeariaAPI.testConnection();
    if (result?.success) {
      el.innerHTML = `<span style="color:var(--green)"><i class="fas fa-check-circle"></i> Sistema online</span>
        <p style="color:var(--white-dim);font-size:0.78rem;margin-top:6px;">${escHtml(result.data?.message || 'Conectado ao servidor')}</p>`;
    } else {
      el.innerHTML = `<span style="color:var(--red)"><i class="fas fa-times-circle"></i> Sistema offline</span>
        <p style="color:var(--white-dim);font-size:0.78rem;margin-top:6px;">${escHtml(result.error || 'Erro de ligação')}</p>`;
    }
  } catch (e) {
    el.innerHTML = `<span style="color:var(--red)"><i class="fas fa-times-circle"></i> Erro ao testar</span>`;
  }
}

// ── MODAL HELPERS ────────────────────────────────────────────
function openModal(id)  { document.getElementById(id)?.classList.add('open'); }
function closeModal(id) { document.getElementById(id)?.classList.remove('open'); }

window.addEventListener('click', e => {
  document.querySelectorAll('.modal-overlay.open').forEach(overlay => {
    if (e.target === overlay) overlay.classList.remove('open');
  });
});

// ── TOAST ────────────────────────────────────────────────────
const TOAST_ICONS = {
  success: 'fas fa-check-circle',
  error:   'fas fa-exclamation-circle',
  warning: 'fas fa-exclamation-triangle',
  info:    'fas fa-info-circle',
};

function toast(msg, type = 'info', duration = 3500) {
  const container = document.getElementById('toastContainer');
  if (!container) return;

  const el = document.createElement('div');
  el.className = `toast ${type}`;
  el.innerHTML = `<i class="${TOAST_ICONS[type] || 'fas fa-bell'}"></i><span>${escHtml(msg)}</span>`;
  container.appendChild(el);

  setTimeout(() => {
    el.classList.add('removing');
    setTimeout(() => el.remove(), 300);
  }, duration);
}

// Compatibilidade com funções existentes no api.js
window.showToast = toast;

// ── LOGOUT ───────────────────────────────────────────────────
function logout() {
  if (confirm('Terminar sessão?')) {
    barbeariaAPI.logout();
    window.location.href = 'index.html';
  }
}

// ── UTILS ────────────────────────────────────────────────────
function toDateStr(d) {
  return d.toISOString().split('T')[0];
}

function getMonday(d) {
  const date = new Date(d);
  const day  = date.getDay();
  const diff = (day === 0 ? -6 : 1 - day);
  date.setDate(date.getDate() + diff);
  date.setHours(0, 0, 0, 0);
  return date;
}

function formatDate(ds) {
  if (!ds) return '—';
  try {
    return new Date(ds + 'T12:00:00').toLocaleDateString('pt-PT');
  } catch {
    return ds;
  }
}

function escHtml(str) {
  return String(str)
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#39;');
}

function setText(id, val) {
  const el = document.getElementById(id);
  if (el) el.textContent = val;
}

function setValue(id, val) {
  const el = document.getElementById(id);
  if (el) el.value = val;
}