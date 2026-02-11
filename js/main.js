// main.js - SISTEMA COMPLETO CORRIGIDO

console.log('🚀 Sistema Barbearia João Angeiras inicializando...');

// ==================== VARIÁVEIS GLOBAIS ====================
let selectedTimeSlot = null;

// ==================== INICIALIZAÇÃO ====================
document.addEventListener('DOMContentLoaded', function() {
  console.log('✅ DOM completamente carregado');
  
  // Configurar data mínima (hoje)
  const today = new Date().toISOString().split('T')[0];
  const bookingDate = document.getElementById('bookingDate');
  if (bookingDate) {
    bookingDate.min = today;
    bookingDate.value = today;
    bookingDate.addEventListener('change', loadAvailableTimeSlots);
  }
  
  // Configurar serviço
  /*
  const serviceSelect = document.getElementById('serviceSelect');
  if (serviceSelect) {
    serviceSelect.addEventListener('change', loadAvailableTimeSlots);
  }
  
  // Configurar botão de confirmação
  const confirmBtn = document.getElementById('confirmBookingBtn');
  if (confirmBtn) {
    console.log('🔗 Botão de confirmação encontrado');
    
    // Remover event listeners antigos
    const newConfirmBtn = confirmBtn.cloneNode(true);
    confirmBtn.parentNode.replaceChild(newConfirmBtn, confirmBtn);
    
    // Adicionar novo listener
    newConfirmBtn.addEventListener('click', function(e) {
      console.log('🎯 CONFIRMAR CLICADO!');
      e.preventDefault();
      confirmBooking();
    });
    
    // Também adicionar onclick via atributo
    newConfirmBtn.setAttribute('onclick', 'confirmBooking()');
  }
  */
  // Ano atual no footer
  document.getElementById('currentYear').textContent = new Date().getFullYear();
  
  // Menu mobile
  const mobileMenuBtn = document.getElementById('mobileMenuBtn');
  const navLinks = document.getElementById('navLinks');
  
  if (mobileMenuBtn && navLinks) {
    mobileMenuBtn.addEventListener('click', function() {
      navLinks.classList.toggle('active');
      mobileMenuBtn.innerHTML = navLinks.classList.contains('active') 
        ? '<i class="fas fa-times"></i>' 
        : '<i class="fas fa-bars"></i>';
    });
  }
  
  // Testar conexão API
  setTimeout(() => {
    if (window.barbeariaAPI && typeof barbeariaAPI.testConnection === 'function') {
      barbeariaAPI.testConnection().then(result => {
        console.log('🔗 API Status:', result.success ? '✅ ONLINE' : '❌ OFFLINE');
      });
    }
  }, 1000);
});

// ==================== FUNÇÕES DE MODAL ====================
function openBookingModal(serviceName, price, duration) {
  console.log('📅 Abrindo modal de reserva');
  
  const modal = document.getElementById('bookingModal');
  if (!modal) {
    console.error('❌ Modal não encontrado!');
    return;
  }
  
  // Preencher serviço se fornecido
  if (serviceName && price && duration) {
    const serviceSelect = document.getElementById('serviceSelect');
    if (serviceSelect) {
      const optionValue = `${serviceName}|${price}|${duration}`;
      
      // Encontrar ou criar opção
      let found = false;
      for (let option of serviceSelect.options) {
        if (option.value.includes(serviceName)) {
          option.selected = true;
          found = true;
          break;
        }
      }
      
      if (!found) {
        const newOption = document.createElement('option');
        newOption.value = optionValue;
        newOption.textContent = `${serviceName} - ${price}€ (${duration} min)`;
        serviceSelect.appendChild(newOption);
        newOption.selected = true;
      }
    }
  }
  
  // Limpar campos
  document.getElementById('clientName').value = '';
  document.getElementById('clientPhone').value = '';
  
  // Data de hoje
  const today = new Date().toISOString().split('T')[0];
  document.getElementById('bookingDate').value = today;
  
  // Carregar slots disponíveis
  setTimeout(() => {
    loadAvailableTimeSlots();
  }, 500);
  
  // Mostrar modal
  modal.style.display = 'block';
  document.body.style.overflow = 'hidden';
  
  console.log('✅ Modal aberto');
}

function closeBookingModal() {
  const modal = document.getElementById('bookingModal');
  if (modal) {
    modal.style.display = 'none';
    document.body.style.overflow = 'auto';
    console.log('📅 Modal fechado');
  }
}

function openAdminModal() {
  const modal = document.getElementById('adminModal');
  if (modal) {
    modal.style.display = 'block';
    document.body.style.overflow = 'hidden';
  }
}

function closeAdminModal() {
  const modal = document.getElementById('adminModal');
  if (modal) {
    modal.style.display = 'none';
    document.body.style.overflow = 'auto';
  }
}

// ==================== FUNÇÕES DE LOGIN ====================
function loginAdmin() {
  const email = document.getElementById('adminEmail').value;
  const password = document.getElementById('adminPassword').value;
  
  if (!email || !password) {
    showToast('Preencha email e senha', 'error');
    return;
  }
  
  barbeariaAPI.adminLogin(email, password).then(result => {
    if (result.success) {
      showToast('Login realizado com sucesso!', 'success');
      closeAdminModal();
      setTimeout(() => {
        window.location.href = 'admin.html';
      }, 1000);
    } else {
      showToast('Credenciais inválidas', 'error');
    }
  }).catch(error => {
    console.error('Erro login:', error);
    showToast('Erro no login', 'error');
  });
}

// ==================== FUNÇÃO PRINCIPAL DE RESERVA ====================
async function confirmBooking() {
  console.log('🎯 CONFIRMAR RESERVA CHAMADA!');
  
  try {
    // Coletar dados do formulário
    const name = document.getElementById('clientName').value.trim();
    const phone = document.getElementById('clientPhone').value.trim();
    const service = document.getElementById('serviceSelect').value;
    const date = document.getElementById('bookingDate').value;
    const time = document.getElementById('bookingTime').value;
    
    console.log('📋 Dados coletados:', { name, phone, service, date, time });
    
    // VALIDAÇÃO BÁSICA
    if (!name || !phone || !service || !date || !time) {
      showToast('❌ Por favor, preencha todos os campos!', 'error');
      console.log('❌ Validação falhou: campos vazios');
      return;
    }
    
    // Validar telefone
    if (!validatePhone(phone)) {
      showToast('❌ Número de telefone inválido! Use 9 dígitos.', 'error');
      return;
    }
    
    // Extrair dados do serviço
    const [serviceName, servicePrice, serviceDuration] = service.split('|');
    
    if (!serviceName || !servicePrice || !serviceDuration) {
      showToast('❌ Serviço inválido!', 'error');
      return;
    }
    
    console.log('🔍 Verificando disponibilidade...');
    
    // VERIFICAR DISPONIBILIDADE
    const availability = await barbeariaAPI.checkAvailability(
      date, 
      time, 
      parseInt(serviceDuration)
    );
    
    console.log('📊 Disponibilidade:', availability);
    
    if (!availability || !availability.available) {
      showToast('❌ Este horário já está ocupado! Escolha outro.', 'error');
      loadAvailableTimeSlots(); // Recarregar slots
      return;
    }
    
    // CRIAR OBJETO DE RESERVA
    const bookingData = {
      name: name,
      phone: phone,
      service: serviceName,
      price: parseFloat(servicePrice),
      duration: parseInt(serviceDuration),
      date: date,
      time: time,
      status: 'pending',
      notes: 'Reserva via site oficial'
    };
    
    console.log('📤 Enviando reserva para API...', bookingData);
    
    // SALVAR RESERVA
    const result = await barbeariaAPI.saveBooking(bookingData);
    
    console.log('📩 Resultado API:', result);
    
    if (result && result.success) {
      // SUCESSO!
      showToast('✅ Reserva confirmada com sucesso!', 'success');
      
      // Obter configurações do WhatsApp
      const settings = await barbeariaAPI.getSettings();
      const whatsappNumber = settings.whatsapp?.number || '+351919241169';
      
      // Formatar data
      const dateObj = new Date(date);
      const formattedDate = dateObj.toLocaleDateString('pt-PT', { 
        weekday: 'long', 
        year: 'numeric', 
        month: 'long', 
        day: 'numeric' 
      });
      
      // Criar mensagem
      const message = `✅ NOVA MARCAÇÃO - Barbearia João Angeiras

👤 Cliente: ${name}
✂️ Serviço: ${serviceName}
💰 Preço: ${servicePrice}€
📅 Data: ${formattedDate}
🕐 Horário: ${time}
📍 Local: R. de 31 de Janeiro 183, Póvoa de Varzim

Por favor, confirme esta marcação respondendo SIM.
O cliente será contactado para confirmação final.

Obrigado! ✂️`;
      
      // Criar link do WhatsApp
      const cleanNumber = whatsappNumber.replace(/\D/g, '');
      const whatsappURL = `https://wa.me/${cleanNumber}?text=${encodeURIComponent(message)}`;
      
      // Fechar modal
      closeBookingModal();
      
      // Abrir WhatsApp após 1 segundo
      setTimeout(() => {
        window.open(whatsappURL, '_blank');
      }, 1000);
      
      // Limpar formulário
      setTimeout(() => {
        document.getElementById('clientName').value = '';
        document.getElementById('clientPhone').value = '';
      }, 500);
      
    } else {
      // ERRO
      const errorMsg = result?.error || 'Erro desconhecido ao salvar reserva';
      showToast(`❌ ${errorMsg}`, 'error');
      console.error('❌ Erro na reserva:', result);
    }
    
  } catch (error) {
    console.error('💥 ERRO CRÍTICO em confirmBooking:', error);
    showToast('❌ Erro no sistema. Tente novamente.', 'error');
  }
}

// ==================== FUNÇÕES AUXILIARES ====================
function validatePhone(phone) {
  const cleanPhone = phone.replace(/\D/g, '');
  return cleanPhone.length >= 9;
}

async function loadAvailableTimeSlots() {
  console.log('🕐 Carregando slots disponíveis...');
  
  const date = document.getElementById('bookingDate')?.value;
  const service = document.getElementById('serviceSelect')?.value;
  
  if (!date || !service) {
    console.log('❌ Data ou serviço não definido');
    return;
  }
  
  const [serviceName, servicePrice, serviceDuration] = service.split('|');
  
  // Mostrar loading
  const loadingEl = document.getElementById('loadingSlots');
  const noSlotsEl = document.getElementById('noSlots');
  const availableEl = document.getElementById('availableTimes');
  const timeSelect = document.getElementById('bookingTime');
  
  if (loadingEl) loadingEl.style.display = 'block';
  if (noSlotsEl) noSlotsEl.style.display = 'none';
  if (availableEl) availableEl.style.display = 'none';
  if (timeSelect) timeSelect.disabled = true;
  
  // VALIDAÇÃO DE HORA: Verificar se é hoje
  const now = new Date();
  const bookingDate = document.getElementById('bookingDate');
  const isToday = bookingDate.value === now.toISOString().split('T')[0];
  const currentMinutes = (now.getHours() * 60) + now.getMinutes();
  
  try {
    const result = await barbeariaAPI.getAvailableSlots(date, parseInt(serviceDuration));
    console.log('📊 Slots recebidos:', result);
    
    if (loadingEl) loadingEl.style.display = 'none';
    
    // Processar resultado (pode vir como array ou objeto com success)
    let slots = Array.isArray(result) ? result : (result?.slots || result);
    
    // Se não houver slots
    if (!slots || slots.length === 0) {
      if (noSlotsEl) noSlotsEl.style.display = 'block';
      if (timeSelect) {
        timeSelect.innerHTML = '<option value="">Nenhum horário disponível</option>';
        timeSelect.disabled = true;
      }
      return;
    }
    
    // FILTRAR slots para não mostrar horas que já passaram se for HOJE
    const validSlots = slots.filter(slot => {
      if (!isToday) return true;
      const [hours, minutes] = slot.split(':').map(Number);
      const slotMinutes = (hours * 60) + minutes;
      return slotMinutes > (currentMinutes + 15); // +15 min de margem para o cliente chegar
    });
    
    console.log('✅ Slots válidos após filtro:', validSlots);
    
    // Se não houver slots após o filtro
    if (validSlots.length === 0) {
      if (noSlotsEl) noSlotsEl.style.display = 'block';
      if (timeSelect) {
        timeSelect.innerHTML = '<option value="">Nenhum horário disponível</option>';
        timeSelect.disabled = true;
      }
      return;
    }
    
    // Renderizar slots válidos
    if (availableEl) availableEl.style.display = 'block';
    
    // Atualizar select
    if (timeSelect) {
      timeSelect.innerHTML = '<option value="">Selecione um horário</option>';
      validSlots.forEach(slot => {
        const option = document.createElement('option');
        option.value = slot;
        option.textContent = slot;
        timeSelect.appendChild(option);
      });
      timeSelect.disabled = false;
    }
    
    // Atualizar botões
    if (availableEl) {
      availableEl.innerHTML = '';
      validSlots.forEach(slot => {
        const button = document.createElement('button');
        button.type = 'button';
        button.className = 'time-slot';
        button.textContent = slot;
        button.onclick = () => {
          // Remover seleção anterior
          document.querySelectorAll('.time-slot').forEach(btn => {
            btn.classList.remove('selected');
          });
          
          // Selecionar este
          button.classList.add('selected');
          selectedTimeSlot = slot;
          
          // Atualizar select
          if (timeSelect) {
            timeSelect.value = slot;
          }
        };
        availableEl.appendChild(button);
      });
    }
  } catch (error) {
    console.error('❌ Erro ao carregar slots:', error);
    if (loadingEl) loadingEl.style.display = 'none';
    if (noSlotsEl) noSlotsEl.style.display = 'block';
  }
}

// ==================== EVENT LISTENERS GLOBAIS ====================
// Fechar modais ao clicar fora
window.addEventListener('click', function(event) {
  const bookingModal = document.getElementById('bookingModal');
  const adminModal = document.getElementById('adminModal');
  
  if (event.target == bookingModal) {
    closeBookingModal();
  }
  
  if (event.target == adminModal) {
    closeAdminModal();
  }
});

// Fechar modais com ESC
document.addEventListener('keydown', function(event) {
  if (event.key === 'Escape') {
    closeBookingModal();
    closeAdminModal();
  }
});

console.log('✅ main.js completamente carregado!');