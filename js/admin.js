// admin.js - PAINEL DO BARBEIRO COMPLETO

document.addEventListener('DOMContentLoaded', async function() {
  console.log('🔧 Painel do Barbeiro inicializando...');
  
  // Verificar autenticação
  if (!barbeariaAPI.checkAuth()) {
    console.log('❌ Não autenticado, redirecionando...');
    window.location.href = 'index.html';
    return;
  }
  
  console.log('✅ Autenticado, carregando painel...');
  
  // Inicializar
  await initAdminPanel();
});

async function initAdminPanel() {
  try {
    // Configurar tabs
    setupTabs();
    
    // Carregar dados
    await Promise.all([
      loadDashboardData(),
      loadAllBookings(),
      loadBlockedDates(),
      loadSettings(),
      checkAPIStatus()
    ]);
    
    // Configurar event listeners
    setupEventListeners();
    
    // Auto-refresh a cada 30 segundos
    setInterval(async () => {
      await loadDashboardData();
    }, 30000);
    
    console.log('✅ Painel do barbeiro carregado!');
    
  } catch (error) {
    console.error('❌ Erro ao inicializar painel:', error);
    showToast('Erro ao carregar painel', 'error');
  }
}

// ==================== TABS ====================
function setupTabs() {
  const tabBtns = document.querySelectorAll('.tab-btn');
  tabBtns.forEach(btn => {
    btn.addEventListener('click', function() {
      const tabId = this.getAttribute('onclick').match(/'([^']+)'/)[1];
      openTab(tabId);
    });
  });
  
  // Tipo de bloqueio
  const blockTypeSelect = document.getElementById('blockType');
  if (blockTypeSelect) {
    blockTypeSelect.addEventListener('change', function() {
      const endDateGroup = document.getElementById('blockEndDateGroup');
      endDateGroup.style.display = this.value === 'range' ? 'block' : 'none';
    });
  }
}

function openTab(tabId) {
  document.querySelectorAll('.tab-content').forEach(tab => tab.classList.remove('active'));
  document.querySelectorAll('.tab-btn').forEach(btn => btn.classList.remove('active'));
  
  const targetTab = document.getElementById(tabId);
  if (targetTab) targetTab.classList.add('active');
  
  const targetBtn = document.querySelector(`.tab-btn[onclick*="${tabId}"]`);
  if (targetBtn) targetBtn.classList.add('active');
}

// ==================== DASHBOARD ====================
async function loadDashboardData() {
  try {
    const stats = await barbeariaAPI.getStats();
    
    document.getElementById('todayBookings').textContent = stats.today || 0;
    document.getElementById('weekBookings').textContent = stats.week || 0;
    document.getElementById('pendingBookings').textContent = stats.pending || 0;
    document.getElementById('totalRevenue').textContent = (stats.revenue || 0).toFixed(2) + '€';
    
    const todayBookings = await barbeariaAPI.getTodayBookings();
    updateBookingsTable('upcomingBookingsBody', todayBookings, false);
    
  } catch (error) {
    console.error('Erro dashboard:', error);
  }
}

// ==================== AGENDA ====================
async function loadAllBookings() {
  try {
    const filterDate = document.getElementById('filterDate')?.value;
    const filterStatus = document.getElementById('filterStatus')?.value;
    
    const filters = {};
    if (filterDate) filters.date = filterDate;
    if (filterStatus) filters.status = filterStatus;
    
    const bookings = await barbeariaAPI.getBookings(filters);
    updateBookingsTable('allBookingsBody', bookings, true);
    
  } catch (error) {
    console.error('Erro agenda:', error);
    showToast('Erro ao carregar agenda', 'error');
  }
}

function updateBookingsTable(tableBodyId, bookings, showAllColumns = false) {
  const tableBody = document.getElementById(tableBodyId);
  if (!tableBody) return;
  
  tableBody.innerHTML = '';
  
  if (!bookings || bookings.length === 0) {
    tableBody.innerHTML = `
      <tr>
        <td colspan="${showAllColumns ? '8' : '7'}" style="text-align: center; padding: 40px; color: #aaa;">
          <i class="fas fa-calendar-times" style="font-size: 2rem; margin-bottom: 10px; display: block;"></i>
          Nenhuma reserva encontrada
        </td>
      </tr>
    `;
    return;
  }
  
  bookings.forEach(booking => {
    const row = document.createElement('tr');
    
    // Status
    let statusClass = '';
    let statusText = '';
    let statusIcon = '';
    
    switch(booking.status) {
      case 'pending':
        statusClass = 'status-pending';
        statusText = 'Pendente';
        statusIcon = 'fas fa-clock';
        break;
      case 'confirmed':
        statusClass = 'status-confirmed';
        statusText = 'Confirmado';
        statusIcon = 'fas fa-check-circle';
        break;
      case 'completed':
        statusClass = 'status-completed';
        statusText = 'Concluído';
        statusIcon = 'fas fa-check-double';
        break;
      case 'cancelled':
        statusClass = 'status-cancelled';
        statusText = 'Cancelado';
        statusIcon = 'fas fa-times-circle';
        break;
      default:
        statusClass = 'status-pending';
        statusText = booking.status;
        statusIcon = 'fas fa-question';
    }
    
    // Formatar data
    const formatDate = (dateStr) => {
      if (!dateStr) return '--';
      try {
        const date = new Date(dateStr);
        return date.toLocaleDateString('pt-PT');
      } catch {
        return dateStr;
      }
    };
    
    if (showAllColumns) {
      row.innerHTML = `
        <td>${formatDate(booking.date)}</td>
        <td>${booking.time || '--'}</td>
        <td>${booking.name || '--'}</td>
        <td>${booking.phone || '--'}</td>
        <td>${booking.service || '--'}</td>
        <td>${booking.price || 0}€</td>
        <td><span class="status-badge ${statusClass}"><i class="${statusIcon}"></i> ${statusText}</span></td>
        <td>
          <div style="display: flex; gap: 5px; flex-wrap: wrap;">
            ${booking.status === 'pending' ? `
              <button class="btn btn-small btn-success" onclick="confirmBooking('${booking.id}')" title="Confirmar">
                <i class="fas fa-check"></i>
              </button>
            ` : ''}
            
            ${booking.status === 'confirmed' ? `
              <button class="btn btn-small btn-success" onclick="completeBooking('${booking.id}')" title="Concluir">
                <i class="fas fa-check-double"></i>
              </button>
            ` : ''}
            
            ${booking.status !== 'cancelled' && booking.status !== 'completed' ? `
              <button class="btn btn-small btn-danger" onclick="cancelBooking('${booking.id}')" title="Cancelar">
                <i class="fas fa-times"></i>
              </button>
            ` : ''}
            
            <button class="btn btn-small btn-danger" onclick="deleteBooking('${booking.id}')" title="Apagar">
              <i class="fas fa-trash"></i>
            </button>
            
            ${booking.phone ? `
              <button class="btn btn-small" onclick="contactClient('${booking.phone}', '${booking.name}')" title="Contactar">
                <i class="fas fa-phone"></i>
              </button>
            ` : ''}
          </div>
        </td>
      `;
    } else {
      row.innerHTML = `
        <td>${booking.time || '--'}</td>
        <td>${booking.name || '--'}</td>
        <td>${booking.phone || '--'}</td>
        <td>${booking.service || '--'}</td>
        <td>${booking.price || 0}€</td>
        <td><span class="status-badge ${statusClass}"><i class="${statusIcon}"></i> ${statusText}</span></td>
        <td>
          <div style="display: flex; gap: 5px;">
            ${booking.status === 'pending' ? `
              <button class="btn btn-small btn-success" onclick="confirmBooking('${booking.id}')" title="Confirmar">
                <i class="fas fa-check"></i>
              </button>
            ` : ''}
            <button class="btn btn-small" onclick="contactClient('${booking.phone}', '${booking.name}')" title="Contactar">
              <i class="fas fa-phone"></i>
            </button>
          </div>
        </td>
      `;
    }
    
    tableBody.appendChild(row);
  });
}

// ==================== AÇÕES RESERVAS ====================
async function confirmBooking(bookingId) {
  if (confirm('Confirmar esta marcação?')) {
    try {
      const result = await barbeariaAPI.updateBookingStatus(bookingId, 'confirmed');
      if (result.success) {
        showToast('✅ Marcação confirmada!', 'success');
        await Promise.all([loadDashboardData(), loadAllBookings()]);
      }
    } catch (error) {
      console.error('Erro confirmBooking:', error);
      showToast('Erro ao confirmar', 'error');
    }
  }
}

async function completeBooking(bookingId) {
  if (confirm('Marcar como concluído?')) {
    try {
      const result = await barbeariaAPI.updateBookingStatus(bookingId, 'completed');
      if (result.success) {
        showToast('✅ Marcação concluída!', 'success');
        await Promise.all([loadDashboardData(), loadAllBookings()]);
      }
    } catch (error) {
      console.error('Erro completeBooking:', error);
      showToast('Erro ao concluir', 'error');
    }
  }
}

async function cancelBooking(bookingId) {
  if (confirm('Cancelar esta marcação?')) {
    try {
      const result = await barbeariaAPI.updateBookingStatus(bookingId, 'cancelled');
      if (result.success) {
        showToast('✅ Marcação cancelada!', 'success');
        await Promise.all([loadDashboardData(), loadAllBookings()]);
      }
    } catch (error) {
      console.error('Erro cancelBooking:', error);
      showToast('Erro ao cancelar', 'error');
    }
  }
}

async function deleteBooking(bookingId) {
  if (confirm('Apagar esta marcação permanentemente?')) {
    try {
      const result = await barbeariaAPI.deleteBooking(bookingId);
      if (result.success) {
        showToast('✅ Marcação apagada!', 'success');
        await Promise.all([loadDashboardData(), loadAllBookings()]);
      }
    } catch (error) {
      console.error('Erro deleteBooking:', error);
      showToast('Erro ao apagar', 'error');
    }
  }
}

function contactClient(phone, name) {
  if (!phone) {
    showToast('Número não disponível', 'warning');
    return;
  }
  
  const message = `Olá ${name}, aqui é da Barbearia João Angeiras.`;
  const whatsappURL = `https://wa.me/${phone.replace(/\D/g, '')}?text=${encodeURIComponent(message)}`;
  window.open(whatsappURL, '_blank');
}

// ==================== RESERVA MANUAL ====================
function addManualBooking() {
  const modal = document.getElementById('manualBookingModal');
  const today = new Date().toISOString().split('T')[0];
  
  document.getElementById('manualBookingDate').value = today;
  document.getElementById('manualBookingTime').value = '10:00';
  
  modal.style.display = 'block';
}

function closeManualBookingModal() {
  document.getElementById('manualBookingModal').style.display = 'none';
}

async function saveManualBooking() {
  const name = document.getElementById('manualClientName').value.trim();
  const phone = document.getElementById('manualClientPhone').value.trim();
  const service = document.getElementById('manualServiceSelect').value;
  const date = document.getElementById('manualBookingDate').value;
  const time = document.getElementById('manualBookingTime').value;
  const status = document.getElementById('manualBookingStatus').value;
  const notes = document.getElementById('manualBookingNotes').value.trim();
  
  if (!name || !phone || !service || !date || !time) {
    showToast('Preencha todos os campos obrigatórios!', 'error');
    return;
  }
  
  const [serviceName, servicePrice, serviceDuration] = service.split('|');
  
  const bookingData = {
    name: name,
    phone: phone,
    service: serviceName,
    price: parseFloat(servicePrice),
    duration: parseInt(serviceDuration),
    date: date,
    time: time,
    status: status,
    notes: notes,
    created_by: 'barbeiro'
  };
  
  try {
    // Verificar disponibilidade (exceto se for o barbeiro marcando)
    if (status === 'pending' || status === 'confirmed') {
      const availability = await barbeariaAPI.checkAvailability(date, time, parseInt(serviceDuration));
      if (!availability.available) {
        showToast('❌ Este horário já está ocupado!', 'error');
        return;
      }
    }
    
    // Salvar reserva
    const result = await barbeariaAPI.saveBooking(bookingData);
    
    if (result.success) {
      showToast('✅ Reserva manual criada!', 'success');
      closeManualBookingModal();
      await Promise.all([loadDashboardData(), loadAllBookings()]);
    } else {
      showToast(`❌ ${result.error}`, 'error');
    }
    
  } catch (error) {
    console.error('Erro saveManualBooking:', error);
    showToast('Erro ao salvar reserva', 'error');
  }
}

// ==================== CONFIGURAÇÕES ====================
async function loadSettings() {
  try {
    const settings = await barbeariaAPI.getSettings();
    
    if (settings.workingHours) {
      document.getElementById('openTime').value = settings.workingHours.open || 9;
      document.getElementById('closeTime').value = settings.workingHours.close || 19;
      document.getElementById('breakStart').value = settings.workingHours.breakStart || 12;
      document.getElementById('breakEnd').value = settings.workingHours.breakEnd || 14;
      
      const workingDays = settings.workingHours.workingDays || [2, 3, 4, 5, 6];
      document.querySelectorAll('input[name="workingDays"]').forEach(checkbox => {
        checkbox.checked = workingDays.includes(parseInt(checkbox.value));
      });
    }
    
    if (settings.whatsapp) {
      document.getElementById('whatsappNumber').value = settings.whatsapp.number || '+351918749689';
      if (settings.whatsapp.mensagem_padrao) {
        document.getElementById('whatsappMessage').value = settings.whatsapp.mensagem_padrao;
      }
    }
    
  } catch (error) {
    console.error('Erro loadSettings:', error);
  }
}

async function saveWorkingHours() {
  const open = parseInt(document.getElementById('openTime').value);
  const close = parseInt(document.getElementById('closeTime').value);
  const breakStart = parseInt(document.getElementById('breakStart').value);
  const breakEnd = parseInt(document.getElementById('breakEnd').value);
  
  const workingDays = Array.from(document.querySelectorAll('input[name="workingDays"]:checked'))
    .map(cb => parseInt(cb.value));
  
  if (workingDays.length === 0) {
    showToast('Selecione pelo menos um dia de trabalho', 'error');
    return;
  }
  
  const settingsData = {
    workingHours: {
      open: open,
      close: close,
      breakStart: breakStart,
      breakEnd: breakEnd,
      workingDays: workingDays
    }
  };
  
  try {
    const result = await barbeariaAPI.saveSettings(settingsData);
    if (result.success) {
      showToast('✅ Horários salvos com sucesso!', 'success');
    } else {
      showToast(`❌ ${result.error}`, 'error');
    }
  } catch (error) {
    console.error('Erro saveWorkingHours:', error);
    showToast('Erro ao salvar horários', 'error');
  }
}

async function saveWhatsAppSettings() {
  const number = document.getElementById('whatsappNumber').value.trim();
  const message = document.getElementById('whatsappMessage').value.trim();
  
  if (!number) {
    showToast('Digite o número do WhatsApp', 'error');
    return;
  }
  
  const settingsData = {
    whatsapp: {
      number: number,
      mensagem_padrao: message
    }
  };
  
  try {
    const result = await barbeariaAPI.saveSettings(settingsData);
    if (result.success) {
      showToast('✅ Configurações do WhatsApp salvas!', 'success');
    } else {
      showToast(`❌ ${result.error}`, 'error');
    }
  } catch (error) {
    console.error('Erro saveWhatsAppSettings:', error);
    showToast('Erro ao salvar configurações', 'error');
  }
}

// ==================== DATAS BLOQUEADAS ====================
async function loadBlockedDates() {
  try {
    const blockedDates = await barbeariaAPI.getBlockedDates();
    updateBlockedDatesTable(blockedDates);
  } catch (error) {
    console.error('Erro blockedDates:', error);
  }
}

function updateBlockedDatesTable(dates) {
  const tableBody = document.getElementById('blockedDatesBody');
  if (!tableBody) return;
  
  tableBody.innerHTML = '';
  
  if (!dates || dates.length === 0) {
    tableBody.innerHTML = `
      <tr>
        <td colspan="3" style="text-align: center; padding: 20px; color: #aaa;">
          Nenhuma data bloqueada
        </td>
      </tr>
    `;
    return;
  }
  
  dates.forEach(date => {
    const formatDate = (dateStr) => {
      if (!dateStr) return '--';
      try {
        const date = new Date(dateStr);
        return date.toLocaleDateString('pt-PT');
      } catch {
        return dateStr;
      }
    };
    
    let dateRange = formatDate(date.startDate);
    if (date.endDate && date.startDate !== date.endDate) {
      dateRange = `${formatDate(date.startDate)} - ${formatDate(date.endDate)}`;
    }
    
    const row = document.createElement('tr');
    row.innerHTML = `
      <td>${date.description || 'Sem descrição'}</td>
      <td>${dateRange}</td>
      <td>
        <button class="btn btn-small btn-danger" onclick="removeBlockedDate('${date.id}')">
          <i class="fas fa-trash"></i> Remover
        </button>
      </td>
    `;
    
    tableBody.appendChild(row);
  });
}

async function addBlockedDate() {
  const description = document.getElementById('blockDescription').value.trim();
  const type = document.getElementById('blockType').value;
  const startDate = document.getElementById('blockStartDate').value;
  const endDate = type === 'range' ? document.getElementById('blockEndDate').value : null;
  
  if (!description || !startDate) {
    showToast('Preencha todos os campos', 'error');
    return;
  }
  
  if (type === 'range' && (!endDate || endDate < startDate)) {
    showToast('Data de fim inválida', 'error');
    return;
  }
  
  const dateData = {
    description: description,
    startDate: startDate,
    type: type
  };
  
  if (endDate) {
    dateData.endDate = endDate;
  }
  
  try {
    const result = await barbeariaAPI.addBlockedDate(dateData);
    
    if (result.success) {
      showToast('✅ Data bloqueada!', 'success');
      
      // Limpar formulário
      document.getElementById('blockDescription').value = '';
      document.getElementById('blockStartDate').value = '';
      document.getElementById('blockEndDate').value = '';
      
      await loadBlockedDates();
    } else {
      showToast(`❌ ${result.error}`, 'error');
    }
  } catch (error) {
    console.error('Erro addBlockedDate:', error);
    showToast('Erro ao bloquear data', 'error');
  }
}

async function removeBlockedDate(dateId) {
  if (confirm('Remover este bloqueio?')) {
    try {
      const result = await barbeariaAPI.removeBlockedDate(dateId);
      
      if (result.success) {
        showToast('✅ Bloqueio removido!', 'success');
        await loadBlockedDates();
      } else {
        showToast(`❌ ${result.error}`, 'error');
      }
    } catch (error) {
      console.error('Erro removeBlockedDate:', error);
      showToast('Erro ao remover bloqueio', 'error');
    }
  }
}

// ==================== SISTEMA ====================
async function checkAPIStatus() {
  const apiStatusDiv = document.getElementById('apiStatus');
  const apiUrlDiv = document.getElementById('apiUrl');
  
  if (!apiStatusDiv || !apiUrlDiv) return;
  
  // Mostrar URL
  apiUrlDiv.textContent = barbeariaAPI.API_URL || 'Não configurada';
  
  if (!barbeariaAPI.isConfigured()) {
    apiStatusDiv.innerHTML = `
      <p style="color: #ff9800;"><i class="fas fa-exclamation-triangle"></i> API não configurada</p>
    `;
    return;
  }
  
  try {
    const result = await barbeariaAPI.testConnection();
    
    if (result.success) {
      apiStatusDiv.innerHTML = `
        <p style="color: #4CAF50;"><i class="fas fa-check-circle"></i> ✅ SISTEMA ONLINE</p>
        <p style="color: #aaa; font-size: 0.9rem; margin-top: 10px;">
          ${result.data?.message || 'Conectado ao servidor'}
        </p>
      `;
    } else {
      apiStatusDiv.innerHTML = `
        <p style="color: #f44336;"><i class="fas fa-times-circle"></i> ❌ SISTEMA OFFLINE</p>
        <p style="color: #aaa; font-size: 0.9rem; margin-top: 10px;">
          ${result.error || 'Erro de conexão'}
        </p>
      `;
    }
  } catch (error) {
    apiStatusDiv.innerHTML = `
      <p style="color: #f44336;"><i class="fas fa-times-circle"></i> Erro ao testar conexão</p>
    `;
  }
}

async function testAPIConnection() {
  await checkAPIStatus();
  showToast('Conexão testada', 'info');
}

function clearCache() {
  if (confirm('Limpar cache local do navegador?')) {
    localStorage.removeItem('admin_session');
    showToast('Cache limpo! Faça login novamente.', 'info');
    setTimeout(() => {
      window.location.href = 'index.html';
    }, 1000);
  }
}

// ==================== EVENT LISTENERS ====================
function setupEventListeners() {
  // Data de filtro para hoje
  const today = new Date().toISOString().split('T')[0];
  const filterDateInput = document.getElementById('filterDate');
  if (filterDateInput) {
    filterDateInput.value = today;
    filterDateInput.addEventListener('change', loadAllBookings);
  }
  
  // Filtro de status
  const filterStatus = document.getElementById('filterStatus');
  if (filterStatus) {
    filterStatus.addEventListener('change', loadAllBookings);
  }
  
  // Fechar modais ao clicar fora
  window.addEventListener('click', function(event) {
    const manualModal = document.getElementById('manualBookingModal');
    if (event.target == manualModal) {
      closeManualBookingModal();
    }
  });
}

// ==================== LOGOUT ====================
function logout() {
  if (confirm('Sair do painel do barbeiro?')) {
    barbeariaAPI.logout();
    window.location.href = 'index.html';
  }
}