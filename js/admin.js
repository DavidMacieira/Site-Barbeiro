// ============================================================
//  ADMIN.JS — Painel do Barbeiro João Angeiras
//  MELHORADO: Gestão de slots, dias extra, bloqueios
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
  if (tabId === 'tabSchedule') { loadBlockedDates(); loadDaySlots(); }
}

// ── STATS ────────────────────────────────────────────────────
async function loadStats() {
  try {
    const s = await barbeariaAPI.getStats();
    setText('statToday',   s.today   ?? 0);
    setText('statWeek',    s.week    ?? 0);
    setText('statPending', s.pending ?? 0);
    setText('statRevenue', ((s.revenue ?? 0).toFixed(2)) + '€');

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
let calView  = 'week';
let calDate  = new Date();
let allBookingsCache  = [];
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

  const startFmt = days[0].toLocaleDateString('pt-PT', { day: '2-digit', month: 'short' });
  const endFmt   = days[6].toLocaleDateString('pt-PT', { day: '2-digit', month: 'short', year: 'numeric' });
  document.getElementById('calTitle').textContent = `${startFmt} – ${endFmt}`;

  const hours    = [];
  for (let h = 9; h <= 19; h++) hours.push(h);

  const today    = toDateStr(new Date());
  const dayNames = ['Dom', 'Seg', 'Ter', 'Qua', 'Qui', 'Sex', 'Sáb'];

  let html = `<div class="week-grid">`;
  html += `<div class="week-time-col">`;
  html += `<div style="height:56px;background:var(--black-4);border-bottom:1px solid rgba(255,255,255,0.05);"></div>`;
  hours.forEach(h => {
    html += `<div class="week-time-label">${String(h).padStart(2,'0')}:00</div>`;
  });
  html += `</div>`;

  days.forEach(day => {
    const ds        = toDateStr(day);
    const isToday   = ds === today;
    const blockInfo = getDayStatus(ds);
    const isBlocked = blockInfo.status === 'blocked';
    const isOpen    = blockInfo.status === 'open_exception';

    html += `<div class="week-day-col">`;
    html += `<div class="week-day-header${isToday ? ' today' : ''}${isBlocked ? ' blocked' : ''}${isOpen ? ' open-exception' : ''}">`;
    html += `<div class="week-day-name">${dayNames[day.getDay()]}</div>`;
    html += `<div class="week-day-date">${day.getDate()}</div>`;
    if (isOpen) html += `<div style="font-size:0.6rem;color:var(--green)"><i class="fas fa-star"></i> Extra</div>`;
    if (isBlocked) html += `<div style="font-size:0.6rem;color:var(--red)"><i class="fas fa-ban"></i> Fechado</div>`;
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
          const top    = (parseInt((b.time.split(':')[1] || '0')) / 60) * 60;
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
  const startWeek = (firstDay.getDay() + 6) % 7;
  const today     = toDateStr(new Date());
  const dayLabels = ['Seg','Ter','Qua','Qui','Sex','Sáb','Dom'];

  let html = `<div class="month-grid">`;
  html += `<div class="month-weekdays">` + dayLabels.map(l => `<div class="month-weekday-label">${l}</div>`).join('') + `</div>`;
  html += `<div class="month-days">`;

  for (let i = 0; i < startWeek; i++) {
    const d = new Date(year, month, 1 - startWeek + i);
    html += renderMonthDay(d, true, today);
  }
  for (let d = 1; d <= lastDay.getDate(); d++) {
    html += renderMonthDay(new Date(year, month, d), false, today);
  }
  const totalCells = startWeek + lastDay.getDate();
  const remainder  = totalCells % 7 === 0 ? 0 : 7 - (totalCells % 7);
  for (let i = 1; i <= remainder; i++) {
    html += renderMonthDay(new Date(year, month + 1, i), true, today);
  }

  html += `</div></div>`;
  container.innerHTML = html;
}

function renderMonthDay(date, otherMonth, today) {
  const ds        = toDateStr(date);
  const isToday   = ds === today;
  const blockInfo = getDayStatus(ds);
  const isBlocked = !otherMonth && blockInfo.status === 'blocked';
  const isOpen    = !otherMonth && blockInfo.status === 'open_exception';
  const bookings  = otherMonth ? [] : allBookingsCache.filter(b =>
    b.date === ds && b.status !== 'cancelled'
  );

  let cls = 'month-day';
  if (otherMonth) cls += ' other-month';
  if (isToday)    cls += ' today';
  if (isBlocked)  cls += ' blocked';
  if (isOpen)     cls += ' open-exception-day';

  const clickAttr = !otherMonth && !isBlocked
    ? `onclick="onMonthDayClick('${ds}')"` : '';

  let html = `<div class="${cls}" ${clickAttr}>`;
  html += `<div class="month-day-num">${date.getDate()}</div>`;

  if (isBlocked) {
    html += `<div class="month-blocked-label"><i class="fas fa-ban"></i> ${escHtml(blockInfo.description || 'Fechado')}</div>`;
  } else if (isOpen) {
    html += `<div class="month-open-label"><i class="fas fa-star"></i> Dia Extra</div>`;
    html += `<div class="month-mini-bookings">`;
    bookings.slice(0, 3).forEach(b => {
      html += `<div class="month-mini-booking status-${b.status}" onclick="openBookingDetail('${b.id}');event.stopPropagation();">
        ${escHtml(b.time || '')} ${escHtml(b.name || '')}
      </div>`;
    });
    html += `</div>`;
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
  calDate = new Date(ds + 'T12:00:00');
  switchCalView('week');
}

// ── BOOKING DETAIL MODAL ─────────────────────────────────────
function openBookingDetail(bookingId) {
  const b = allBookingsCache.find(x => x.id === bookingId || x.id == bookingId);
  if (!b) return;

  const statusLabels = { pending: 'Pendente', confirmed: 'Confirmado', completed: 'Concluído', cancelled: 'Cancelado' };

  document.getElementById('modalBookingDetailBody').innerHTML = `
    <div class="booking-detail-grid">
      <div class="booking-detail-item"><label>Cliente</label><div class="val">${escHtml(b.name || '—')}</div></div>
      <div class="booking-detail-item"><label>Telefone</label><div class="val">${escHtml(b.phone || '—')}</div></div>
      <div class="booking-detail-item"><label>Serviço</label><div class="val">${escHtml(b.service || '—')}</div></div>
      <div class="booking-detail-item"><label>Preço</label><div class="val gold">${b.price || 0}€</div></div>
      <div class="booking-detail-item"><label>Data</label><div class="val">${formatDate(b.date)}</div></div>
      <div class="booking-detail-item"><label>Hora</label><div class="val">${b.time || '—'}</div></div>
      <div class="booking-detail-item" style="grid-column:1/-1;">
        <label>Estado</label>
        <div><span class="badge badge-${b.status}">${statusLabels[b.status] || b.status}</span></div>
      </div>
      ${b.notes ? `<div class="booking-detail-item" style="grid-column:1/-1;"><label>Notas</label><div class="val">${escHtml(b.notes)}</div></div>` : ''}
    </div>
  `;

  let footerHtml = `<button class="btn btn-ghost" onclick="closeModal('modalBookingDetail')">Fechar</button>`;
  if (b.phone) {
    footerHtml += `<button class="btn btn-outline" onclick="contactWhatsApp('${b.phone}','${escHtml(b.name || '')}')">
      <i class="fab fa-whatsapp"></i> WhatsApp</button>`;
  }
  if (b.status === 'pending') {
    footerHtml += `<button class="btn btn-primary" onclick="confirmBooking('${b.id}')"><i class="fas fa-check"></i> Confirmar</button>`;
  }
  if (b.status === 'confirmed') {
    footerHtml += `<button class="btn btn-success" onclick="completeBooking('${b.id}')"><i class="fas fa-check-double"></i> Concluído</button>`;
  }
  if (b.status !== 'cancelled' && b.status !== 'completed') {
    footerHtml += `<button class="btn btn-danger" onclick="cancelBooking('${b.id}')"><i class="fas fa-times"></i> Cancelar</button>`;
  }

  document.getElementById('modalBookingDetailFooter').innerHTML = footerHtml;
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
      <i class="fas fa-calendar-times"></i><p>Nenhuma reserva encontrada</p></td></tr>`;
    return;
  }

  const statusLabels = { pending: 'Pendente', confirmed: 'Confirmado', completed: 'Concluído', cancelled: 'Cancelado' };
  tbody.innerHTML = bookings.map(b => `<tr>
    <td class="muted">${formatDate(b.date)}</td>
    <td>${b.time || '—'}</td>
    <td>${escHtml(b.name || '—')}</td>
    <td class="muted">${escHtml(b.phone || '—')}</td>
    <td>${escHtml(b.service || '—')}</td>
    <td style="color:var(--gold)">${b.price || 0}€</td>
    <td><span class="badge badge-${b.status}">${statusLabels[b.status] || b.status}</span></td>
    <td>
      <div class="action-row">
        ${b.status === 'pending' ? `<button class="btn btn-success btn-sm btn-icon" title="Confirmar" onclick="confirmBooking('${b.id}')"><i class="fas fa-check"></i></button>` : ''}
        ${b.status === 'confirmed' ? `<button class="btn btn-blue btn-sm btn-icon" title="Concluir" onclick="completeBooking('${b.id}')"><i class="fas fa-check-double"></i></button>` : ''}
        ${b.status !== 'cancelled' && b.status !== 'completed' ? `<button class="btn btn-danger btn-sm btn-icon" title="Cancelar" onclick="cancelBooking('${b.id}')"><i class="fas fa-times"></i></button>` : ''}
        <button class="btn btn-ghost btn-sm btn-icon" title="Ver detalhes" onclick="openBookingDetail('${b.id}')"><i class="fas fa-eye"></i></button>
        ${b.phone ? `<button class="btn btn-ghost btn-sm btn-icon" title="WhatsApp" onclick="contactWhatsApp('${b.phone}','${escHtml(b.name || '')}')"><i class="fab fa-whatsapp"></i></button>` : ''}
        <button class="btn btn-danger btn-sm btn-icon" title="Apagar" onclick="deleteBooking('${b.id}')"><i class="fas fa-trash"></i></button>
      </div>
    </td>
  </tr>`).join('');
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
  } else { toast('Erro ao confirmar', 'error'); }
}

async function completeBooking(id) {
  const ok = await barbeariaAPI.updateBookingStatus(id, 'completed').catch(() => null);
  if (ok?.success) {
    toast('Marcação concluída! ✓', 'success');
    closeModal('modalBookingDetail');
    await Promise.all([loadStats(), loadAllBookings(), renderCalendar()]);
  } else { toast('Erro ao concluir', 'error'); }
}

async function cancelBooking(id) {
  if (!confirm('Cancelar esta marcação?')) return;
  const ok = await barbeariaAPI.updateBookingStatus(id, 'cancelled').catch(() => null);
  if (ok?.success) {
    toast('Marcação cancelada', 'warning');
    closeModal('modalBookingDetail');
    await Promise.all([loadStats(), loadAllBookings(), renderCalendar()]);
  } else { toast('Erro ao cancelar', 'error'); }
}

async function deleteBooking(id) {
  if (!confirm('Apagar permanentemente esta marcação?')) return;
  const ok = await barbeariaAPI.deleteBooking(id).catch(() => null);
  if (ok?.success) {
    toast('Marcação apagada', 'info');
    await Promise.all([loadStats(), loadAllBookings(), renderCalendar()]);
  } else { toast('Erro ao apagar', 'error'); }
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
  const slotDate = document.getElementById('slotDate');
  if (slotDate) slotDate.value = today;
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

// ════════════════════════════════════════════════════════════════
//  GESTÃO DE HORÁRIOS — NOVIDADES
// ════════════════════════════════════════════════════════════════

// ── HELPER: status de um dia ─────────────────────────────────
// Devolve { status: 'normal'|'blocked'|'open_exception', description, ... }
function getDayStatus(dateStr) {
  for (const b of blockedDatesCache) {
    if (b.type === 'open_exception') {
      if (b.startDate === dateStr) return { status: 'open_exception', ...b };
    } else {
      // bloqueio
      if (b.startDate === dateStr) return { status: 'blocked', ...b };
      if (b.endDate && b.startDate <= dateStr && dateStr <= b.endDate) {
        return { status: 'blocked', ...b };
      }
    }
  }
  return { status: 'normal' };
}

// ── BLOQUEAR DIA ─────────────────────────────────────────────
function toggleBlockEndDate() {
  const type = document.getElementById('blockType').value;
  document.getElementById('blockEndGroup').style.display = type === 'range' ? 'block' : 'none';
}

async function addBlockedDate() {
  const desc  = document.getElementById('blockDesc').value.trim();
  const type  = document.getElementById('blockType').value;
  const start = document.getElementById('blockStart').value;
  const end   = document.getElementById('blockEnd').value;

  if (!start) {
    toast('Escolha uma data', 'error');
    return;
  }
  if (!desc) {
    toast('Escreva um motivo (ex: Férias)', 'error');
    return;
  }
  if (type === 'range' && (!end || end < start)) {
    toast('Data de fim inválida', 'error');
    return;
  }

  const payload = { description: desc, startDate: start, type: 'blocked' };
  if (type === 'range') payload.endDate = end;

  const result = await barbeariaAPI.addBlockedDate(payload).catch(() => null);

  if (result?.success) {
    toast(`Dia ${formatDate(start)} bloqueado!`, 'success');
    document.getElementById('blockDesc').value  = '';
    document.getElementById('blockStart').value = '';
    document.getElementById('blockEnd').value   = '';
    await loadBlockedDates();
    renderCalendar();
  } else {
    toast(result?.error || 'Erro ao bloquear', 'error');
  }
}

// ── ABRIR DIA EXTRA (excepção) ───────────────────────────────
async function addOpenException() {
  const desc  = document.getElementById('openDesc').value.trim();
  const date  = document.getElementById('openDate').value;
  const start = document.getElementById('openStart').value;
  const end   = document.getElementById('openEnd').value;

  if (!date) {
    toast('Escolha uma data para abrir', 'error');
    return;
  }
  if (!start || !end || end <= start) {
    toast('Defina horário de abertura e fecho válidos', 'error');
    return;
  }

  const payload = {
    description: desc || 'Dia extra de trabalho',
    startDate:   date,
    type:        'open_exception',
    openStart:   start,
    openEnd:     end
  };

  const result = await barbeariaAPI.addBlockedDate(payload).catch(() => null);

  if (result?.success) {
    toast(`Dia ${formatDate(date)} aberto para marcações (${start}–${end})!`, 'success');
    document.getElementById('openDesc').value  = '';
    document.getElementById('openDate').value  = '';
    document.getElementById('openStart').value = '09:00';
    document.getElementById('openEnd').value   = '18:00';
    await loadBlockedDates();
    renderCalendar();
  } else {
    toast(result?.error || 'Erro ao abrir dia extra', 'error');
  }
}

// ── REMOVER EXCEPÇÃO / BLOQUEIO ──────────────────────────────
async function removeBlockedDate(id) {
  if (!confirm('Remover esta excepção?')) return;
  const result = await barbeariaAPI.removeBlockedDate(id).catch(() => null);
  if (result?.success) {
    toast('Removido!', 'success');
    await loadBlockedDates();
    renderCalendar();
  } else {
    toast('Erro ao remover', 'error');
  }
}

// ── CARREGAR + RENDERIZAR LISTA ──────────────────────────────
async function loadBlockedDates() {
  const dates = await barbeariaAPI.getBlockedDates().catch(() => []);
  blockedDatesCache = dates || [];
  renderBlockedList(dates);
}

function renderBlockedList(dates) {
  const el = document.getElementById('blockedList');
  if (!el) return;

  if (!dates || dates.length === 0) {
    el.innerHTML = `<p style="color:var(--white-dim);font-size:0.85rem;">Nenhuma excepção definida.</p>`;
    return;
  }

  // Ordenar por data
  const sorted = [...dates].sort((a, b) => (a.startDate || '') > (b.startDate || '') ? 1 : -1);

  el.innerHTML = sorted.map(d => {
    const isOpen    = d.type === 'open_exception';
    const isBreak   = d.type === 'break_override';
    let period = formatDate(d.startDate);
    if (d.endDate && d.endDate !== d.startDate) period += ` → ${formatDate(d.endDate)}`;

    let extraInfo = '';
    if (isOpen && d.openStart)  extraInfo = `<span style="font-size:0.78rem;color:var(--white-dim);"> · ${d.openStart}–${d.openEnd}</span>`;
    if (isBreak && d.openStart) {
      const info = d.openStart === 'none' ? 'sem pausa' : `${d.openStart}–${d.openEnd}`;
      extraInfo = `<span style="font-size:0.78rem;color:var(--white-dim);"> · ${info}</span>`;
    }

    let chipClass = 'blocked-chip';
    let icon = 'fa-ban';
    if (isOpen)  { chipClass += ' chip-open';  icon = 'fa-calendar-plus'; }
    if (isBreak) { chipClass += ' chip-break'; icon = 'fa-coffee'; }

    const defaultLabel = isOpen ? 'Dia Extra' : isBreak ? 'Pausa alterada' : 'Bloqueado';

    return `<div class="${chipClass}">
      <i class="fas ${icon}"></i>
      <span>
        <strong>${escHtml(d.description || defaultLabel)}</strong>
        — ${period}${extraInfo}
      </span>
      <button onclick="removeBlockedDate('${d.id}')" title="Remover">
        <i class="fas fa-times"></i>
      </button>
    </div>`;
  }).join('');
}

// ════════════════════════════════════════════════════════════════
//  GESTÃO DE SLOTS POR DIA
// ════════════════════════════════════════════════════════════════

// Slots personalizados guardados em localStorage (key: "slots_YYYY-MM-DD")
// Cada entrada: { blocked: ['09:00','09:30',...] }  — lista dos bloqueados
// Se não existir entrada, todos os slots normais estão disponíveis.

function getSettingsHours() {
  const open  = document.getElementById('cfgOpen')?.value  || '09:00';
  const close = document.getElementById('cfgClose')?.value || '19:00';
  return { open, close };
}

function timeToMin(t) {
  const [h, m] = t.split(':').map(Number);
  return h * 60 + m;
}

function minToTime(m) {
  const h  = Math.floor(m / 60);
  const mn = m % 60;
  return `${String(h).padStart(2,'0')}:${String(mn).padStart(2,'0')}`;
}

function generateAllSlots(open = '09:00', close = '19:00', step = 30) {
  const slots = [];
  let cur = timeToMin(open);
  const end = timeToMin(close);
  while (cur < end) {
    slots.push(minToTime(cur));
    cur += step;
  }
  return slots;
}

function getDayBlockedSlots(dateStr) {
  try {
    const raw = localStorage.getItem(`slots_${dateStr}`);
    if (!raw) return [];
    return JSON.parse(raw).blocked || [];
  } catch { return []; }
}

function saveDayBlockedSlots(dateStr, blockedSlots) {
  localStorage.setItem(`slots_${dateStr}`, JSON.stringify({ blocked: blockedSlots }));
}

async function loadDaySlots() {
  const dateStr = document.getElementById('slotDate')?.value;
  const grid    = document.getElementById('slotsGrid');
  if (!grid) return;

  if (!dateStr) {
    grid.innerHTML = `<p style="color:var(--white-dim);font-size:0.85rem;"><i class="fas fa-info-circle"></i> Escolha uma data.</p>`;
    return;
  }

  const { open, close } = getSettingsHours();
  const allSlots   = generateAllSlots(open, close);
  const blocked    = getDayBlockedSlots(dateStr);

  // Marcações reais nesse dia
  const dayBookings = allBookingsCache.filter(b =>
    b.date === dateStr && b.status !== 'cancelled'
  );
  const bookedTimes = dayBookings.map(b => b.time?.slice(0, 5));

  // Dia da semana
  const d      = new Date(dateStr + 'T12:00:00');
  const dow    = d.getDay();
  const dayNames = ['Domingo','Segunda','Terça','Quarta','Quinta','Sexta','Sábado'];
  const dayStatus = getDayStatus(dateStr);
  const isClosed  = dayStatus.status === 'blocked';
  const isExtra   = dayStatus.status === 'open_exception';

  let headerHtml = `<div style="margin-bottom:10px;font-size:0.85rem;color:var(--white-dim);">
    <strong style="color:var(--white)">${dayNames[dow]}, ${formatDate(dateStr)}</strong>`;
  if (isClosed) headerHtml += ` &nbsp;<span style="color:var(--red);"><i class="fas fa-ban"></i> Dia bloqueado</span>`;
  if (isExtra)  headerHtml += ` &nbsp;<span style="color:var(--green);"><i class="fas fa-star"></i> Dia extra aberto</span>`;
  headerHtml += `</div>`;

  let html = headerHtml + `<div class="slots-picker-inner">`;

  allSlots.forEach(slot => {
    const isBooked  = bookedTimes.includes(slot);
    const isBlocked = blocked.includes(slot);

    let cls = 'slot-pick';
    let title = slot;

    if (isBooked) {
      const bk = dayBookings.find(b => b.time?.slice(0,5) === slot);
      cls  += ' slot-booked';
      title = `${slot} — ${bk?.name || 'Marcação'}`;
    } else if (isBlocked) {
      cls  += ' slot-blocked-manual';
      title = `${slot} — Bloqueado`;
    } else {
      cls  += ' slot-available';
      title = `${slot} — Disponível (clicar para bloquear)`;
    }

    html += `<div class="${cls}" title="${escHtml(title)}"
      data-slot="${slot}"
      data-booked="${isBooked ? '1' : '0'}"
      ${!isBooked ? `onclick="toggleSlotBlock(this)"` : ''}
    >
      ${slot}
      ${isBooked ? `<span class="slot-badge"><i class="fas fa-user"></i></span>` : ''}
      ${isBlocked && !isBooked ? `<span class="slot-badge blocked-badge"><i class="fas fa-lock"></i></span>` : ''}
    </div>`;
  });

  html += `</div>`;
  grid.innerHTML = html;
}

function toggleSlotBlock(el) {
  if (el.dataset.booked === '1') return; // não tocar em slots com marcação
  el.classList.toggle('slot-blocked-manual');
  el.classList.toggle('slot-available');
  const isNowBlocked = el.classList.contains('slot-blocked-manual');
  el.title = isNowBlocked
    ? `${el.dataset.slot} — Bloqueado`
    : `${el.dataset.slot} — Disponível (clicar para bloquear)`;

  // Actualizar badge
  let badge = el.querySelector('.slot-badge');
  if (isNowBlocked) {
    if (!badge) {
      badge = document.createElement('span');
      badge.className = 'slot-badge blocked-badge';
      el.appendChild(badge);
    }
    badge.innerHTML = '<i class="fas fa-lock"></i>';
  } else {
    if (badge) badge.remove();
  }
}

function selectAllSlots() {
  document.querySelectorAll('.slot-pick[data-booked="0"]').forEach(el => {
    el.classList.remove('slot-blocked-manual');
    el.classList.add('slot-available');
    const badge = el.querySelector('.slot-badge');
    if (badge) badge.remove();
    el.title = `${el.dataset.slot} — Disponível`;
  });
}

function clearAllSlots() {
  document.querySelectorAll('.slot-pick[data-booked="0"]').forEach(el => {
    el.classList.add('slot-blocked-manual');
    el.classList.remove('slot-available');
    let badge = el.querySelector('.slot-badge');
    if (!badge) {
      badge = document.createElement('span');
      badge.className = 'slot-badge blocked-badge';
      el.appendChild(badge);
    }
    badge.innerHTML = '<i class="fas fa-lock"></i>';
    el.title = `${el.dataset.slot} — Bloqueado`;
  });
}

function saveDaySlots() {
  const dateStr = document.getElementById('slotDate')?.value;
  if (!dateStr) { toast('Escolha uma data', 'error'); return; }

  const blocked = [];
  document.querySelectorAll('.slot-pick[data-booked="0"]').forEach(el => {
    if (el.classList.contains('slot-blocked-manual')) {
      blocked.push(el.dataset.slot);
    }
  });

  saveDayBlockedSlots(dateStr, blocked);
  toast('Horários guardados!', 'success');

  // Flash da mensagem de confirmação
  const msg = document.getElementById('slotsSaveMsg');
  if (msg) {
    msg.style.display = 'block';
    setTimeout(() => { msg.style.display = 'none'; }, 3000);
  }
}

function resetDaySlots() {
  const dateStr = document.getElementById('slotDate')?.value;
  if (!dateStr) return;
  if (!confirm('Repor horários padrão para este dia?')) return;
  localStorage.removeItem(`slots_${dateStr}`);
  loadDaySlots();
  toast('Horários repostos ao padrão', 'info');
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

      const enableBreak = wh.enableBreak === true || wh.enableBreak === 'true';
      const cbBreak = document.getElementById('cfgEnableBreak');
      if (cbBreak) {
        cbBreak.checked = enableBreak;
        toggleBreakFields();
      }

      const days = wh.workingDays || [2, 3, 4, 5, 6];
      document.querySelectorAll('input[name="workingDays"]').forEach(cb => {
        cb.checked = days.includes(parseInt(cb.value));
      });
    }
    if (settings.whatsapp) {
      setValue('cfgWhatsapp',    settings.whatsapp.number          || '');
      setValue('cfgWhatsappMsg', settings.whatsapp.mensagem_padrao || '');
    }
  } catch (e) { console.error('loadSettings:', e); }
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
      open:        document.getElementById('cfgOpen').value,
      close:       document.getElementById('cfgClose').value,
      enableBreak: document.getElementById('cfgEnableBreak')?.checked || false,
      breakStart:  document.getElementById('cfgBreakStart')?.value || '13:00',
      breakEnd:    document.getElementById('cfgBreakEnd')?.value   || '14:00',
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
  if (!number) { toast('Digite o número de WhatsApp', 'error'); return; }
  const payload = { whatsapp: { number, mensagem_padrao: message } };
  const result  = await barbeariaAPI.saveSettings(payload).catch(() => null);
  if (result?.success) {
    toast('WhatsApp guardado!', 'success');
  } else {
    toast('Erro ao guardar', 'error');
  }
}

// ── PAUSA DE ALMOÇO ─────────────────────────────────────────
function toggleBreakFields() {
  const enabled = document.getElementById('cfgEnableBreak')?.checked;
  const grp = document.getElementById('breakFieldsGroup');
  if (grp) grp.style.display = enabled ? 'block' : 'none';
}

function toggleBreakOverrideFields() {
  const type = document.getElementById('breakOverrideType')?.value;
  const grp  = document.getElementById('breakOverrideHours');
  if (grp) grp.style.display = type === 'change' ? 'block' : 'none';
}

async function addBreakOverride() {
  const date = document.getElementById('breakOverrideDate')?.value;
  const type = document.getElementById('breakOverrideType')?.value;

  if (!date) { toast('Escolha uma data', 'error'); return; }

  let payload;
  if (type === 'remove') {
    // Sem pausa neste dia
    payload = {
      description: 'Sem pausa de almoço',
      startDate:   date,
      type:        'break_override',
      breakStart:  'none',
      breakEnd:    'none'
    };
  } else {
    const start = document.getElementById('breakOverrideStart')?.value;
    const end   = document.getElementById('breakOverrideEnd')?.value;
    if (!start || !end || end <= start) {
      toast('Defina início e fim da pausa válidos', 'error');
      return;
    }
    payload = {
      description: `Pausa ${start}–${end}`,
      startDate:   date,
      type:        'break_override',
      breakStart:  start,
      breakEnd:    end
    };
  }

  const result = await barbeariaAPI.addBlockedDate(payload).catch(() => null);
  if (result?.success) {
    const msg = type === 'remove'
      ? `Sem pausa a ${formatDate(date)}`
      : `Pausa alterada em ${formatDate(date)}`;
    toast(msg, 'success');
    document.getElementById('breakOverrideDate').value = '';
    await loadBlockedDates();
    renderCalendar();
  } else {
    toast(result?.error || 'Erro ao guardar', 'error');
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

// ── MODAL ────────────────────────────────────────────────────
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
window.showToast = toast;

// ── LOGOUT ───────────────────────────────────────────────────
function logout() {
  if (confirm('Terminar sessão?')) {
    barbeariaAPI.logout();
    window.location.href = 'index.html';
  }
}

// ── UTILS ────────────────────────────────────────────────────
function toDateStr(d) { return d.toISOString().split('T')[0]; }

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
  try { return new Date(ds + 'T12:00:00').toLocaleDateString('pt-PT'); }
  catch { return ds; }
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