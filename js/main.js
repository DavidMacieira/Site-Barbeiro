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

// ==================== CALENDÁRIO VISUAL ====================
const Calendar = {
  currentYear: new Date().getFullYear(),
  currentMonth: new Date().getMonth(),
  selectedDate: null,
  bookedDates: {},
  blockedDates: [],
  openExceptions: [],
  CLOSED_DAYS: [0, 1],

  // Inicializar e injetar calendário no modal
  async init() {
    const bookingDate = document.getElementById('bookingDate');
    if (!bookingDate) return;

    // Esconder o input nativo
    bookingDate.style.display = 'none';

    // Criar o widget (só se não existir)
    if (!document.getElementById('calendarWidget')) {
      const wrapper = document.createElement('div');
      wrapper.id = 'calendarWidget';
      wrapper.className = 'cal-widget';
      bookingDate.parentNode.insertBefore(wrapper, bookingDate.nextSibling);
    }

    // Carregar configurações do barbeiro (dias de trabalho) e bloqueios
    await this.loadServerConfig();

    // Selecionar hoje por padrão — mas se já passou o horário de fecho, avança para amanhã
    const todayDate = new Date();
    this.selectedDate = this.nextAvailableDay(todayDate);
    bookingDate.value = this.toISO(this.selectedDate);
    this.currentYear = this.selectedDate.getFullYear();
    this.currentMonth = this.selectedDate.getMonth();

    await this.loadMonthBookings();
    this.render();
  },

  // Carregar configurações do servidor (dias de trabalho + bloqueios/excepções)
  async loadServerConfig() {
    try {
      // Carregar dias de trabalho das settings
      const settings = await barbeariaAPI.getSettings();
      if (settings && settings.workingHours && settings.workingHours.workingDays) {
        const workingDays = settings.workingHours.workingDays; // ex: [2,3,4,5,6]
        // Dias fechados = todos os dias da semana que NÃO estão em workingDays
        this.CLOSED_DAYS = [0,1,2,3,4,5,6].filter(d => !workingDays.includes(d));
      }
    } catch(e) { /* manter padrão */ }

    try {
      // Carregar bloqueios e excepções do servidor
      const blocked = await barbeariaAPI.getBlockedDates();
      window._allBlockedDates = blocked || []; // cache global para filtro de slots
      if (Array.isArray(blocked)) {
        this.blockedDates = [];    // datas bloqueadas
        this.openExceptions = [];  // dias extra abertos (override dos dias fechados)

        blocked.forEach(b => {
          if (b.type === 'open_exception') {
            // Dia extra — guardar com horário se disponível
            this.openExceptions.push({
              date:      b.startDate,
              openStart: b.openStart || '09:00',
              openEnd:   b.openEnd   || '19:00'
            });
          } else if (b.type === 'slot_block' || b.type === 'break_override') {
            // Bloqueio parcial de slots — não bloqueia o dia inteiro, ignorar aqui
          } else {
            // Bloqueio — pode ser dia único ou período
            if (b.startDate) {
              if (b.endDate && b.endDate !== b.startDate) {
                // Expandir período em datas individuais
                const cur = new Date(b.startDate + 'T12:00:00');
                const end = new Date(b.endDate   + 'T12:00:00');
                while (cur <= end) {
                  this.blockedDates.push(this.toISO(cur));
                  cur.setDate(cur.getDate() + 1);
                }
              } else {
                this.blockedDates.push(b.startDate);
              }
            }
          }
        });
      }
    } catch(e) { /* silencioso */ }
  },

  // Converter Date para YYYY-MM-DD
  toISO(date) {
    const y = date.getFullYear();
    const m = String(date.getMonth() + 1).padStart(2, '0');
    const d = String(date.getDate()).padStart(2, '0');
    return `${y}-${m}-${d}`;
  },

  // Próximo dia útil a partir de uma data
  // Próximo dia de trabalho, respeitando excepções abertas
  nextWorkingDay(date) {
    const d = new Date(date);
    while (this.isClosed(d) && !this.isOpenException(d)) {
      d.setDate(d.getDate() + 1);
    }
    return d;
  },

  // Se hoje já passou o horário de fecho, avança para o próximo dia disponível
  nextAvailableDay(date) {
    const d = new Date(date);
    const WORKING_END_HOUR = 19;
    const isAfterHours = d.getHours() >= WORKING_END_HOUR;
    if (!this.isClosed(d) && isAfterHours) {
      d.setDate(d.getDate() + 1);
    }
    return this.nextWorkingDay(d);
  },

  // Dia fechado = dia de folga normal SEM excepção aberta
  isClosed(date) {
    const iso = this.toISO(date);
    if (this.openExceptions.some(e => e.date === iso)) return false;
    return this.CLOSED_DAYS.includes(date.getDay());
  },

  // Dia com excepção aberta (ex: segunda-feira pontual)
  isOpenException(date) {
    const iso = typeof date === 'string' ? date : this.toISO(date);
    return this.openExceptions.some(e => e.date === iso);
  },

  // Dia bloqueado pelo barbeiro
  isBlocked(isoDate) {
    return this.blockedDates.includes(isoDate);
  },

  // Verificar se uma data é passada (anterior a hoje)
  isPast(date) {
    const today = new Date();
    today.setHours(0,0,0,0);
    const d = new Date(date);
    d.setHours(0,0,0,0);
    return d < today;
  },

  // Carregar reservas do mês atual para mostrar indicadores
  async loadMonthBookings() {
    try {
      const service = document.getElementById('serviceSelect')?.value;
      const duration = service ? parseInt(service.split('|')[2]) || 30 : 30;

      // Para cada dia do mês, verificar disponibilidade em background
      // (sem bloquear o render — fazemos lazy)
      this.bookedDates = {};
    } catch(e) { /* silencioso */ }
  },

  // Avançar/recuar mês
  prevMonth() {
    this.currentMonth--;
    if (this.currentMonth < 0) { this.currentMonth = 11; this.currentYear--; }
    this.render();
  },
  nextMonth() {
    this.currentMonth++;
    if (this.currentMonth > 11) { this.currentMonth = 0; this.currentYear++; }
    this.render();
  },

  // Selecionar um dia
  async selectDay(isoDate, el) {
    // Remover seleção anterior
    document.querySelectorAll('.cal-day.selected').forEach(d => d.classList.remove('selected'));
    el.classList.add('selected');

    this.selectedDate = new Date(isoDate + 'T12:00:00');
    document.getElementById('bookingDate').value = isoDate;

    // Recarregar time slots
    await loadAvailableTimeSlots();
  },

  // Renderizar o calendário
  render() {
    const widget = document.getElementById('calendarWidget');
    if (!widget) return;

    const MONTHS_PT = ['Janeiro','Fevereiro','Março','Abril','Maio','Junho','Julho','Agosto','Setembro','Outubro','Novembro','Dezembro'];
    const DAYS_PT = ['Dom','Seg','Ter','Qua','Qui','Sex','Sáb'];

    const firstDay = new Date(this.currentYear, this.currentMonth, 1);
    const lastDay  = new Date(this.currentYear, this.currentMonth + 1, 0);
    const startDow = firstDay.getDay(); // 0=Dom
    const today = new Date(); today.setHours(0,0,0,0);

    // Não permitir navegar para meses passados
    const nowMonth = new Date(); nowMonth.setDate(1); nowMonth.setHours(0,0,0,0);
    const viewMonth = new Date(this.currentYear, this.currentMonth, 1);
    const isPrevDisabled = viewMonth <= nowMonth;

    let html = `
      <div class="cal-header">
        <button type="button" class="cal-nav" onclick="Calendar.prevMonth()" ${isPrevDisabled ? 'disabled' : ''} aria-label="Mês anterior">
          <i class="fas fa-chevron-left"></i>
        </button>
        <span class="cal-month-label">${MONTHS_PT[this.currentMonth]} ${this.currentYear}</span>
        <button type="button" class="cal-nav" onclick="Calendar.nextMonth()" aria-label="Mês seguinte">
          <i class="fas fa-chevron-right"></i>
        </button>
      </div>
      <div class="cal-grid">
    `;

    // Cabeçalho dias da semana
    DAYS_PT.forEach((d, i) => {
      const isClosed = this.CLOSED_DAYS.includes(i);
      html += `<div class="cal-dow ${isClosed ? 'cal-dow--closed' : ''}">${d}</div>`;
    });

    // Espaços vazios antes do primeiro dia
    for (let i = 0; i < startDow; i++) {
      html += `<div class="cal-day cal-day--empty"></div>`;
    }

    // Dias do mês
    for (let d = 1; d <= lastDay.getDate(); d++) {
      const date = new Date(this.currentYear, this.currentMonth, d);
      const iso = this.toISO(date);
      const past    = this.isPast(date);
      const closed  = this.isClosed(date);   // dia de folga sem excepção
      const blocked = this.isBlocked(iso);   // bloqueado pelo barbeiro
      const isExtra = this.isOpenException(iso); // dia extra aberto
      const isSelected = this.selectedDate && this.toISO(this.selectedDate) === iso;
      const isToday = this.toISO(today) === iso;
      const hasBookings = this.bookedDates[iso] && this.bookedDates[iso] > 0;

      let cls = 'cal-day';
      let title = '';
      let clickable = true;

      if (past) {
        cls += ' cal-day--past';
        clickable = false;
        title = 'Data passada';
      } else if (blocked) {
        // Bloqueado pelo barbeiro — sempre fecha, mesmo que seja dia normal
        cls += ' cal-day--blocked';
        clickable = false;
        title = 'Data indisponível';
      } else if (closed) {
        // Dia de folga normal (sem excepção)
        cls += ' cal-day--closed';
        clickable = false;
        title = 'Encerrado';
      } else {
        cls += ' cal-day--open';
        if (isExtra) {
          cls += ' cal-day--extra';
          title = 'Dia extra disponível';
        }
      }

      if (isSelected) cls += ' selected';
      if (isToday) cls += ' cal-day--today';
      if (hasBookings && clickable) cls += ' cal-day--has-bookings';

      const onclick = clickable
        ? `onclick="Calendar.selectDay('${iso}', this)"`
        : '';

      let inner = `<span class="cal-day-num">${d}</span>`;
      if (!clickable) inner += `<span class="cal-day-x" aria-hidden="true"></span>`;
      if (isExtra && clickable) inner += `<span class="cal-day-extra-dot" aria-hidden="true" title="Dia extra">★</span>`;
      if (hasBookings && clickable) inner += `<span class="cal-day-dot" aria-hidden="true"></span>`;

      html += `<div class="${cls}" ${onclick} title="${title}" role="${clickable ? 'button' : ''}" tabindex="${clickable ? '0' : '-1'}" onkeydown="if(event.key==='Enter'&&${clickable})Calendar.selectDay('${iso}',this)">${inner}</div>`;
    }

    html += `</div>`;

    // Legenda
    html += `
      <div class="cal-legend">
        <span class="cal-legend-item"><span class="cal-legend-dot cal-legend-dot--closed"></span> Encerrado</span>
        <span class="cal-legend-item"><span class="cal-legend-dot cal-legend-dot--open"></span> Disponível</span>
        <span class="cal-legend-item"><span class="cal-legend-dot cal-legend-dot--selected"></span> Selecionado</span>
      </div>
    `;

    widget.innerHTML = html;
  },

  // Atualizar indicadores de reservas para um mês (chamado após carregar slots)
  markDateBookings(isoDate, occupiedCount) {
    this.bookedDates[isoDate] = occupiedCount;
    // Re-renderizar só o dia específico seria mais eficiente,
    // mas re-renderizar o calendário inteiro é mais simples
    const widget = document.getElementById('calendarWidget');
    if (widget) this.render();
  }
};

// ==================== INICIALIZAÇÃO ====================
document.addEventListener('DOMContentLoaded', function() {
  console.log('✅ DOM completamente carregado');
  
  // Inicializar calendário visual (substitui o input nativo)
  const bookingDate = document.getElementById('bookingDate');
  if (bookingDate) {
    // O calendário será inicializado quando o modal abrir (openBookingModal)
    // Para já, apenas configurar o valor padrão
    const today = new Date().toISOString().split('T')[0];
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
      
      // Recarregar slots quando mudar serviço (só se o modal estiver visível)
      const modal = document.getElementById('bookingModal');
      if (e.target.value && modal && modal.style.display !== 'none') {
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
      
      // NÃO disparar change aqui — loadAvailableTimeSlots será chamado no setTimeout abaixo
      // após o calendário estar inicializado com a data correcta
    }
  }
  
  // Mostrar modal com animação
  modal.style.display = 'block';
  document.body.style.overflow = 'hidden';

  // Inicializar/re-renderizar o calendário visual
  setTimeout(async () => {
    const widget = document.getElementById('calendarWidget');
    if (!widget) {
      await Calendar.init();
    } else {
      // Na reabertura, verificar se a data guardada já passou; se sim, reinicializar
      const bookingDateEl = document.getElementById('bookingDate');
      const storedISO = bookingDateEl ? bookingDateEl.value : '';
      const isPastDate = storedISO && Calendar.isPast(new Date(storedISO + 'T12:00:00'));
      if (isPastDate || !storedISO) {
        await Calendar.init();
      } else {
        Calendar.render();
      }
    }
    // Recarregar slots após o calendário estar pronto (garante data correcta)
    const bookingDateFinal = document.getElementById('bookingDate');
    if (bookingDateFinal && bookingDateFinal.value) {
      await loadAvailableTimeSlots();
    }
  }, 80);
  
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
    
    // VERIFICAR DISPONIBILIDADE NO SERVIDOR (antes de gravar)
    btn.textContent = 'A verificar disponibilidade...';
    const availability = await barbeariaAPI.checkAvailability(
      date,
      time,
      parseInt(serviceDuration)
    );

    // Só bloquear se o servidor confirmar explicitamente que não está disponível
    if (availability && availability.success === true && availability.available === false) {
      notificationSystem.show(
        'Este horário já foi reservado. Por favor, escolha outro horário.',
        'error',
        { title: '⏰ HORÁRIO INDISPONÍVEL', duration: 6000 }
      );
      await loadAvailableTimeSlots();
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
      
      // NOTIFICAÇÃO DE SUCESSO COM BOTÃO PARA AGENDA
      notificationSystem.showBookingSuccess({
        ...bookingData,
        date: date,
        time: time,
        bookingId: result.bookingId,
        duration: parseInt(serviceDuration) || 30
      });
      
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

      // Se o erro é de conflito (horário ocupado entre checkAvailability e saveBooking)
      if (errorMsg.toLowerCase().includes('horário') || errorMsg.toLowerCase().includes('reservado')) {
        notificationSystem.show(
          'Este horário acabou de ser reservado. Por favor, escolha outro horário.',
          'error',
          { title: '⏰ HORÁRIO OCUPADO', duration: 6000 }
        );
        await loadAvailableTimeSlots(); // Atualizar slots visualmente
      } else {
        notificationSystem.showError(
          `Não foi possível concluir a sua reserva. ${errorMsg}`,
          { message: errorMsg }
        );
      }
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
    
    let slots = result?.slots ?? [];

    // Se a API falhou (success false ou slots vazio por erro), usar fallback
    if (!result?.success && (!Array.isArray(slots) || slots.length === 0)) {
      console.warn('⚠️ API sem sucesso, usando fallback local');
      const fallback = barbeariaAPI.getFallbackSlots ? barbeariaAPI.getFallbackSlots() : [];
      if (fallback.length === 0) {
        availableEl.style.display = 'none';
        if (noSlotsEl) noSlotsEl.style.display = 'block';
        return;
      }
      slots = fallback;
    }
    
    // Se a API retornou slots não é array, usar fallback
    if (!Array.isArray(slots)) {
      console.warn('Slots Inválidos da API');
      const fallback = barbeariaAPI.getFallbackSlots ? barbeariaAPI.getFallbackSlots() : [];
      if (fallback.length === 0) {
        availableEl.style.display = 'none';
        if (noSlotsEl) noSlotsEl.style.display = 'block';
        return;
      }
      slots = fallback;
    }

    // Normalizar formato
    slots = slots.map(slot => {
      if (typeof slot === 'string') {
        return { time: slot, available: true };
      }
      return slot;
    });

    // Slots bloqueados manualmente pelo barbeiro (vindos do servidor via slot_block)
    const slotBlockEntry = (typeof blockedDatesCache !== 'undefined'
      ? blockedDatesCache
      : (window.app?.blockedDates ? [] : [])
    );
    // Ler do cache global de bloqueios carregado no init()
    const adminBlockedFromServer = (() => {
      try {
        if (!Array.isArray(window._allBlockedDates)) return [];
        const entry = window._allBlockedDates.find(b => b.type === 'slot_block' && b.startDate === date);
        if (!entry || !entry.slots) return [];
        return entry.slots.split(',').map(s => s.trim()).filter(Boolean);
      } catch { return []; }
    })();

    // Marcar slots bloqueados pelo admin como indisponíveis
    if (adminBlockedFromServer.length > 0) {
      slots = slots.map(slot => {
        if (adminBlockedFromServer.includes(slot.time)) {
          return { ...slot, available: false };
        }
        return slot;
      });
    }

    // Filtrar horas passadas
    const validSlots = slots.filter(slot => {
      if (!isToday) return true;
      const [hours, minutes] = slot.time.split(':').map(Number);
      const slotMinutes = (hours * 60) + minutes;
      return slotMinutes > currentMinutes;
    });

    if (validSlots.length === 0) {
      availableEl.style.display = 'none';
      if (noSlotsEl) {
        // Mensagem específica se o problema é a hora (após fecho hoje)
        if (isToday) {
          noSlotsEl.innerHTML = `<i class="fas fa-moon"></i> Horário de hoje já encerrado. Por favor, selecione outro dia.`;
        } else {
          noSlotsEl.innerHTML = `<i class="fas fa-calendar-times"></i> Não há horários disponíveis nesta data.`;
        }
        noSlotsEl.style.display = 'block';
      }
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
        // Distinguir pausa de almoço de slot já reservado
        if (slot.inBreak) {
          button.title = 'Pausa de almoço';
          button.innerHTML = slot.time + '<span class="slot-break-label">🍽</span>';
        } else {
          button.title = 'Horário já reservado';
        }
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
        timeSelect.dispatchEvent(new Event('change')); // <-- LINHA CRÍTICA
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

    // Marcar no calendário quantos slots estão ocupados neste dia
    const occupiedCount = validSlots.filter(s => s.available === false).length;
    const currentDateValue = document.getElementById('bookingDate')?.value;
    if (currentDateValue && occupiedCount > 0) {
      Calendar.markDateBookings(currentDateValue, occupiedCount);
    }

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

// ==================== CONTROLO DO MENU MOBILE ====================
document.addEventListener('DOMContentLoaded', () => {
  const mobileMenuBtn = document.getElementById('mobileMenuBtn');
  const navLinks = document.getElementById('navLinks');

  if (mobileMenuBtn && navLinks) {
    mobileMenuBtn.addEventListener('click', () => {
      // Alterna a classe 'active' para abrir/fechar o menu
      navLinks.classList.toggle('active');
      mobileMenuBtn.classList.toggle('active');
      
      // Bloqueia o scroll do corpo quando o menu está aberto
      document.body.style.overflow = navLinks.classList.contains('active') ? 'hidden' : '';
    });

    // Fecha o menu automaticamente ao clicar num link (ex: "Serviços")
    navLinks.querySelectorAll('a').forEach(link => {
      link.addEventListener('click', () => {
        navLinks.classList.remove('active');
        mobileMenuBtn.classList.remove('active');
        document.body.style.overflow = '';
      });
    });
  }
});