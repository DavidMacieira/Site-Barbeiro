// ==================== MAIN.JS - SISTEMA COMPLETO MELHORADO ====================
console.log('🚀 Sistema Barbearia João Angeiras v2.0 inicializando...');

// ==================== VARIÁVEIS GLOBAIS ====================
let selectedTimeSlot = null;
let clientPreferences = null;

// ==================== SISTEMA DE PREFERÊNCIAS DO CLIENTE ====================
const ClientPreferences = {
  STORAGE_KEY: 'barberiaJoaoAngeiras_clientData',
  
  save(data) {
    try {
      const preferences = {
        name: data.name,
        phone: data.phone,
        lastService: data.service,
        lastBooking: new Date().toISOString(),
        rememberMe: data.rememberMe || false
      };
      localStorage.setItem(this.STORAGE_KEY, JSON.stringify(preferences));
      console.log('✅ Preferências salvas:', preferences);
      return true;
    } catch (error) {
      console.error('❌ Erro ao salvar preferências:', error);
      return false;
    }
  },
  
  load() {
    try {
      const data = localStorage.getItem(this.STORAGE_KEY);
      if (data) {
        const preferences = JSON.parse(data);
        console.log('📂 Preferências carregadas:', preferences);
        return preferences;
      }
      return null;
    } catch (error) {
      console.error('❌ Erro ao carregar preferências:', error);
      return null;
    }
  },
  
  clear() {
    try {
      localStorage.removeItem(this.STORAGE_KEY);
      console.log('🗑️ Preferências removidas');
      return true;
    } catch (error) {
      console.error('❌ Erro ao limpar preferências:', error);
      return false;
    }
  }
};

// ==================== SISTEMA DE VALIDAÇÃO EM TEMPO REAL ====================
const ValidationSystem = {
  // Validar nome
  validateName(name) {
    const trimmed = name.trim();
    if (trimmed.length < 3) {
      return { valid: false, message: 'Nome deve ter pelo menos 3 caracteres' };
    }
    if (trimmed.length > 50) {
      return { valid: false, message: 'Nome muito longo (máx. 50 caracteres)' };
    }
    if (!/^[a-zA-ZÀ-ÿ\s]+$/.test(trimmed)) {
      return { valid: false, message: 'Nome deve conter apenas letras' };
    }
    return { valid: true, message: 'Nome válido' };
  },
  
  // Validar telefone português
  validatePhone(phone) {
    const cleaned = phone.replace(/\D/g, '');
    
    if (cleaned.length === 0) {
      return { valid: false, message: 'Telefone é obrigatório' };
    }
    
    if (cleaned.length !== 9) {
      return { valid: false, message: 'Telefone deve ter 9 dígitos' };
    }
    
    // Validar prefixos portugueses válidos
    const validPrefixes = ['91', '92', '93', '96', '21', '22', '23', '24', '25', '26', '27', '28', '29'];
    const prefix = cleaned.substring(0, 2);
    
    if (!validPrefixes.includes(prefix)) {
      return { valid: false, message: 'Prefixo inválido para Portugal' };
    }
    
    return { valid: true, message: 'Telefone válido' };
  },
  
  // Aplicar máscara de telefone
  formatPhone(phone) {
    const cleaned = phone.replace(/\D/g, '');
    if (cleaned.length <= 3) return cleaned;
    if (cleaned.length <= 6) return `${cleaned.slice(0, 3)} ${cleaned.slice(3)}`;
    return `${cleaned.slice(0, 3)} ${cleaned.slice(3, 6)} ${cleaned.slice(6, 9)}`;
  },
  
  // Atualizar UI com feedback visual
  updateFieldUI(fieldId, validation) {
    const formGroup = document.getElementById(fieldId)?.closest('.form-group');
    if (!formGroup) return;
    
    // Remover classes anteriores
    formGroup.classList.remove('valid', 'invalid');
    
    // Remover ícone anterior se existir
    const oldIcon = formGroup.querySelector('.validation-icon');
    if (oldIcon) oldIcon.remove();
    
    // Remover mensagem de erro anterior
    const oldError = formGroup.querySelector('.error-message');
    if (oldError) oldError.remove();
    
    if (validation.valid) {
      formGroup.classList.add('valid');
      
      // Adicionar ícone de sucesso
      const icon = document.createElement('i');
      icon.className = 'fas fa-check-circle validation-icon';
      formGroup.appendChild(icon);
    } else {
      formGroup.classList.add('invalid');
      
      // Adicionar ícone de erro
      const icon = document.createElement('i');
      icon.className = 'fas fa-times-circle validation-icon';
      formGroup.appendChild(icon);
      
      // Adicionar mensagem de erro
      const errorMsg = document.createElement('div');
      errorMsg.className = 'error-message';
      errorMsg.textContent = validation.message;
      formGroup.appendChild(errorMsg);
    }
  }
};

// ==================== SKELETON LOADER PARA TIME SLOTS ====================
function showSkeletonLoader() {
  const container = document.getElementById('availableTimes');
  if (!container) return;
  
  container.innerHTML = '';
  container.style.display = 'flex';
  container.className = 'time-slots-skeleton';
  
  // Criar 12 skeleton items
  for (let i = 0; i < 12; i++) {
    const skeleton = document.createElement('div');
    skeleton.className = 'skeleton time-slot-skeleton';
    container.appendChild(skeleton);
  }
}

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
  
  // Ano atual no footer
  const yearElement = document.getElementById('currentYear');
  if (yearElement) {
    yearElement.textContent = new Date().getFullYear();
  }
  
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
    
    // Fechar menu ao clicar em link
    const links = navLinks.querySelectorAll('a');
    links.forEach(link => {
      link.addEventListener('click', () => {
        navLinks.classList.remove('active');
        mobileMenuBtn.innerHTML = '<i class="fas fa-bars"></i>';
      });
    });
  }
  
  // ==================== VALIDAÇÃO EM TEMPO REAL ====================
  
  // Validar nome
  const nameInput = document.getElementById('clientName');
  if (nameInput) {
    nameInput.addEventListener('input', function(e) {
      const validation = ValidationSystem.validateName(e.target.value);
      ValidationSystem.updateFieldUI('clientName', validation);
    });
  }
  
  // Validar e formatar telefone
  const phoneInput = document.getElementById('clientPhone');
  if (phoneInput) {
    phoneInput.addEventListener('input', function(e) {
      // Aplicar máscara
      const formatted = ValidationSystem.formatPhone(e.target.value);
      e.target.value = formatted;
      
      // Validar
      const validation = ValidationSystem.validatePhone(e.target.value);
      ValidationSystem.updateFieldUI('clientPhone', validation);
    });
  }
  
  // Validar serviço
  const serviceSelect = document.getElementById('serviceSelect');
  if (serviceSelect) {
    serviceSelect.addEventListener('change', function(e) {
      const validation = {
        valid: e.target.value !== '',
        message: e.target.value ? 'Serviço selecionado' : 'Selecione um serviço'
      };
      ValidationSystem.updateFieldUI('serviceSelect', validation);
      
      // Recarregar slots quando mudar serviço
      if (e.target.value) {
        loadAvailableTimeSlots();
      }
    });
  }
  
  // Validar data
  if (bookingDate) {
    bookingDate.addEventListener('change', function(e) {
      const selectedDate = new Date(e.target.value);
      const today = new Date();
      today.setHours(0, 0, 0, 0);
      
      const validation = {
        valid: selectedDate >= today,
        message: selectedDate >= today ? 'Data válida' : 'Data deve ser futura'
      };
      ValidationSystem.updateFieldUI('bookingDate', validation);
    });
  }
  
  // Carregar preferências do cliente
  clientPreferences = ClientPreferences.load();
  
  // Testar conexão API
  setTimeout(() => {
    if (window.barbeariaAPI && typeof barbeariaAPI.testConnection === 'function') {
      barbeariaAPI.testConnection().then(result => {
        console.log('🔗 API Status:', result.success ? '✅ ONLINE' : '❌ OFFLINE');
      });
    }
  }, 1000);
  
  console.log('✅ Sistema inicializado com sucesso!');
});

// ==================== FUNÇÕES DE MODAL ====================
function openBookingModal(serviceName, price, duration) {
  console.log('📅 Abrindo modal de reserva');
  
  const modal = document.getElementById('bookingModal');
  if (!modal) {
    console.error('❌ Modal não encontrado!');
    return;
  }
  
  // Carregar preferências do cliente
  const preferences = ClientPreferences.load();
  
  if (preferences && preferences.rememberMe) {
    // Auto-preencher dados salvos
    const nameInput = document.getElementById('clientName');
    const phoneInput = document.getElementById('clientPhone');
    
    if (nameInput) {
      nameInput.value = preferences.name || '';
      // Validar campo preenchido
      if (preferences.name) {
        const validation = ValidationSystem.validateName(preferences.name);
        ValidationSystem.updateFieldUI('clientName', validation);
      }
    }
    
    if (phoneInput) {
      phoneInput.value = preferences.phone || '';
      // Validar campo preenchido
      if (preferences.phone) {
        const validation = ValidationSystem.validatePhone(preferences.phone);
        ValidationSystem.updateFieldUI('clientPhone', validation);
      }
    }
    
    // Mostrar notificação
    notificationSystem.show(
      'Seus dados foram preenchidos automaticamente',
      'info',
      { title: '👤 Bem-vindo de volta!', duration: 3000 }
    );
  } else {
    // Limpar campos se não houver preferências
    document.getElementById('clientName').value = '';
    document.getElementById('clientPhone').value = '';
    
    // Remover classes de validação
    const formGroups = document.querySelectorAll('.form-group');
    formGroups.forEach(group => {
      group.classList.remove('valid', 'invalid');
      const icon = group.querySelector('.validation-icon');
      if (icon) icon.remove();
      const error = group.querySelector('.error-message');
      if (error) error.remove();
    });
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
      
      // Validar serviço
      const validation = { valid: true, message: 'Serviço selecionado' };
      ValidationSystem.updateFieldUI('serviceSelect', validation);
    }
  }
  
  // Data de hoje
  const today = new Date().toISOString().split('T')[0];
  document.getElementById('bookingDate').value = today;
  
  // Validar data
  const dateValidation = { valid: true, message: 'Data válida' };
  ValidationSystem.updateFieldUI('bookingDate', dateValidation);
  
  // Carregar slots disponíveis
  setTimeout(() => {
    loadAvailableTimeSlots();
  }, 500);
  
  // Mostrar modal com animação
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
  const btn = event.target;
  
  if (!email || !password) {
    notificationSystem.show('Preencha email e senha', 'error');
    return;
  }
  
  // Adicionar loading state
  btn.classList.add('loading');
  btn.disabled = true;
  
  barbeariaAPI.adminLogin(email, password).then(result => {
    // Remover loading state
    btn.classList.remove('loading');
    btn.disabled = false;
    
    if (result.success) {
      notificationSystem.show('Login realizado com sucesso!', 'success');
      closeAdminModal();
      setTimeout(() => {
        window.location.href = 'admin.html';
      }, 1000);
    } else {
      notificationSystem.show('Credenciais inválidas', 'error');
    }
  }).catch(error => {
    // Remover loading state
    btn.classList.remove('loading');
    btn.disabled = false;
    
    console.error('Erro login:', error);
    notificationSystem.show('Erro no login', 'error');
  });
}

// ==================== FUNÇÃO PRINCIPAL DE RESERVA MELHORADA ====================
async function confirmBooking() {
  console.log('🎯 CONFIRMAR RESERVA CHAMADA!');
  
  const btn = document.getElementById('confirmBookingBtn');
  
  try {
    // Adicionar loading state no botão
    if (btn) {
      btn.classList.add('loading');
      btn.disabled = true;
      btn.textContent = 'Processando...';
    }
    
    // Coletar dados do formulário
    const name = document.getElementById('clientName').value.trim();
    const phone = document.getElementById('clientPhone').value.trim();
    const service = document.getElementById('serviceSelect').value;
    const date = document.getElementById('bookingDate').value;
    const time = document.getElementById('bookingTime').value;
    const rememberMe = document.getElementById('rememberMe')?.checked || false;
    
    console.log('📋 Dados coletados:', { name, phone, service, date, time });
    
    // VALIDAÇÃO COMPLETA
    const nameValidation = ValidationSystem.validateName(name);
    const phoneValidation = ValidationSystem.validatePhone(phone);
    
    if (!name || !phone || !service || !date || !time) {
      notificationSystem.show(
        'Por favor, preencha todos os campos para realizar sua reserva.',
        'warning',
        { title: '⚠️ CAMPOS INCOMPLETOS' }
      );
      
      // Remover loading state
      if (btn) {
        btn.classList.remove('loading');
        btn.disabled = false;
        btn.innerHTML = '<i class="fab fa-whatsapp"></i> Confirmar Marcação';
      }
      return;
    }
    
    if (!nameValidation.valid) {
      notificationSystem.show(nameValidation.message, 'error', { title: '❌ NOME INVÁLIDO' });
      if (btn) {
        btn.classList.remove('loading');
        btn.disabled = false;
        btn.innerHTML = '<i class="fab fa-whatsapp"></i> Confirmar Marcação';
      }
      return;
    }
    
    if (!phoneValidation.valid) {
      notificationSystem.show(phoneValidation.message, 'error', { title: '📱 TELEFONE INVÁLIDO' });
      if (btn) {
        btn.classList.remove('loading');
        btn.disabled = false;
        btn.innerHTML = '<i class="fab fa-whatsapp"></i> Confirmar Marcação';
      }
      return;
    }
    
    // Extrair dados do serviço
    const [serviceName, servicePrice, serviceDuration] = service.split('|');
    
    if (!serviceName || !servicePrice || !serviceDuration) {
      notificationSystem.show(
        'Serviço selecionado é inválido. Por favor, escolha novamente.',
        'error',
        { title: '✂️ SERVIÇO INVÁLIDO' }
      );
      
      if (btn) {
        btn.classList.remove('loading');
        btn.disabled = false;
        btn.innerHTML = '<i class="fab fa-whatsapp"></i> Confirmar Marcação';
      }
      return;
    }
    
    // VERIFICAR DISPONIBILIDADE
    const availability = await barbeariaAPI.checkAvailability(
      date, 
      time, 
      parseInt(serviceDuration)
    );
    
    if (!availability || !availability.available) {
      notificationSystem.show(
        'Este horário acabou de ser reservado por outro cliente. Por favor, selecione outro horário.',
        'error',
        { 
          title: '⏰ HORÁRIO INDISPONÍVEL',
          duration: 6000
        }
      );
      
      loadAvailableTimeSlots(); // Recarregar slots
      
      if (btn) {
        btn.classList.remove('loading');
        btn.disabled = false;
        btn.innerHTML = '<i class="fab fa-whatsapp"></i> Confirmar Marcação';
      }
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
    
    // SALVAR RESERVA
    const result = await barbeariaAPI.saveBooking(bookingData);
    
    if (result && result.success) {
      // Salvar preferências do cliente se solicitado
      if (rememberMe) {
        ClientPreferences.save({
          name: name,
          phone: phone,
          service: serviceName,
          rememberMe: true
        });
      }
      
      // Obter configurações do WhatsApp
      const settings = await barbeariaAPI.getSettings();
      const whatsappNumber = settings.whatsapp?.number || '+351919241169';
      const cleanNumber = whatsappNumber.replace(/\D/g, '');
      
      // Criar mensagem
      const message = `✅ NOVA MARCAÇÃO - Barbearia João Angeiras

👤 Cliente: ${name}
✂️ Serviço: ${serviceName}
💰 Preço: ${servicePrice}€
📅 Data: ${new Date(date).toLocaleDateString('pt-PT')}
🕐 Horário: ${time}
📍 Local: R. de 31 de Janeiro 183, Póvoa de Varzim

Por favor, confirme esta marcação respondendo SIM.
O cliente será contactado para confirmação final.`;
      
      const whatsappURL = `https://wa.me/${cleanNumber}?text=${encodeURIComponent(message)}`;
      
      // NOTIFICAÇÃO PROFISSIONAL DE SUCESSO
      notificationSystem.showBookingSuccess(
        {
          ...bookingData,
          date: date,
          time: time
        },
        whatsappURL
      );
      
      // Fechar modal
      closeBookingModal();
      
      // Limpar formulário
      setTimeout(() => {
        document.getElementById('clientName').value = '';
        document.getElementById('clientPhone').value = '';
        document.getElementById('serviceSelect').value = '';
        document.getElementById('bookingTime').innerHTML = '<option value="">Selecione um horário</option>';
        
        // Remover classes de validação
        const formGroups = document.querySelectorAll('.form-group');
        formGroups.forEach(group => {
          group.classList.remove('valid', 'invalid');
          const icon = group.querySelector('.validation-icon');
          if (icon) icon.remove();
          const error = group.querySelector('.error-message');
          if (error) error.remove();
        });
      }, 500);
      
    } else {
      const errorMsg = result?.error || 'Erro desconhecido ao salvar reserva';
      notificationSystem.showError(
        'Não foi possível concluir sua reserva. Por favor, tente novamente.',
        { message: errorMsg }
      );
    }
    
  } catch (error) {
    console.error('💥 ERRO CRÍTICO em confirmBooking:', error);
    notificationSystem.showError(
      'Ocorreu um erro inesperado. Nossa equipe já foi notificada.',
      error
    );
  } finally {
    // Sempre remover loading state
    if (btn) {
      btn.classList.remove('loading');
      btn.disabled = false;
      btn.innerHTML = '<i class="fab fa-whatsapp"></i> Confirmar Marcação';
    }
  }
}

// ==================== CARREGAR SLOTS COM SKELETON LOADER ====================
async function loadAvailableTimeSlots() {
  console.log('🕐 Carregando slots disponíveis...');
  
  const date = document.getElementById('bookingDate')?.value;
  const service = document.getElementById('serviceSelect')?.value;
  
  if (!date || !service) {
    console.log('❌ Data ou serviço não definido');
    return;
  }
  
  const [serviceName, servicePrice, serviceDuration] = service.split('|');
  
  const loadingEl = document.getElementById('loadingSlots');
  const noSlotsEl = document.getElementById('noSlots');
  const availableEl = document.getElementById('availableTimes');
  const timeSelect = document.getElementById('bookingTime');
  
  // Mostrar skeleton loader
  showSkeletonLoader();
  
  if (loadingEl) loadingEl.style.display = 'none';
  if (noSlotsEl) noSlotsEl.style.display = 'none';
  if (timeSelect) timeSelect.disabled = true;
  
  const now = new Date();
  const bookingDate = document.getElementById('bookingDate');
  const isToday = bookingDate.value === now.toISOString().split('T')[0];
  const currentMinutes = (now.getHours() * 60) + now.getMinutes();
  
  try {
    const result = await barbeariaAPI.getAvailableSlots(date, parseInt(serviceDuration));
    console.log('📊 Slots recebidos:', result);
    
    let slots = Array.isArray(result) ? result : (result?.slots || []);
    
    if (!slots || slots.length === 0) {
      availableEl.style.display = 'none';
      if (noSlotsEl) noSlotsEl.style.display = 'block';
      return;
    }

    // Normalizar formato
    slots = slots.map(slot => {
      if (typeof slot === 'string') {
        return { time: slot, available: true };
      }
      return slot;
    });

    // Filtrar horas passadas
    const validSlots = slots.filter(slot => {
      if (!isToday) return true;
      const [hours, minutes] = slot.time.split(':').map(Number);
      const slotMinutes = (hours * 60) + minutes;
      return slotMinutes > (currentMinutes + 15);
    });

    if (validSlots.length === 0) {
      availableEl.style.display = 'none';
      if (noSlotsEl) noSlotsEl.style.display = 'block';
      return;
    }

    // Mostrar slots com animação
    availableEl.style.display = 'flex';
    availableEl.className = 'time-slots-container';
    availableEl.innerHTML = '';

    if (timeSelect) {
      timeSelect.innerHTML = '<option value="">Selecione um horário</option>';
      timeSelect.disabled = false;
    }

    validSlots.forEach((slot, index) => {
      const button = document.createElement('button');
      button.type = 'button';
      button.textContent = slot.time;
      button.style.animationDelay = `${index * 0.05}s`;
      button.classList.add('fade-in-up');

      if (slot.available === false) {
        button.className += ' time-slot busy';
        button.disabled = true;
        button.title = "Horário já reservado";
      } else {
        button.className += ' time-slot';

        button.onclick = () => {
          document.querySelectorAll('.time-slot').forEach(btn => {
            if (!btn.disabled) btn.classList.remove('selected');
          });

          button.classList.add('selected');
          selectedTimeSlot = slot.time;

          if (timeSelect) {
            timeSelect.value = slot.time;
          }
        };

        // Adicionar ao select
        if (timeSelect) {
          const option = document.createElement('option');
          option.value = slot.time;
          option.textContent = slot.time;
          timeSelect.appendChild(option);
        }
      }

      availableEl.appendChild(button);
    });

  } catch (error) {
    console.error('❌ Erro ao carregar slots:', error);
    availableEl.style.display = 'none';
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

// Animação de scroll para seções
document.querySelectorAll('a[href^="#"]').forEach(anchor => {
  anchor.addEventListener('click', function (e) {
    e.preventDefault();
    const target = document.querySelector(this.getAttribute('href'));
    if (target) {
      target.scrollIntoView({
        behavior: 'smooth',
        block: 'start'
      });
    }
  });
});

console.log('✅ main.js v2.0 completamente carregado!');