// api.js - SISTEMA COMPLETO PARA BARBEARIA REAL


const API_URL = 'https://script.google.com/macros/s/AKfycbzQNh6jtsXo0-0tcTCDRjusbYI9bVBmbb0aOcsOaZ1sElL5-W9zEPWUY7QhwsTUkP6Z/exec';

// Credenciais admin
const ADMIN_CREDENTIALS = {
  email: 'jangeirasbarbeiro@admin.com',
  password: 'gostodecortarcabelo'
};

class BarbeariaAPI {
  constructor() {
    this.API_URL = API_URL;
    console.log('🚀 Sistema Barbearia João Angeiras - API Conectada');
  }

  // ==================== FUNÇÕES PÚBLICAS ====================
async testConnection() {
    try {
      // Usamos o modo 'cors' e explicitamente 'follow' para o redirecionamento 302
      const response = await fetch(`${this.API_URL}?action=test`, {
        method: 'GET',
        mode: 'cors',
        redirect: 'follow', 
        cache: 'no-cache'
      });
      
      if (!response.ok) throw new Error('Servidor respondeu com erro');
      
      const data = await response.json();
      return data;
    } catch (error) {
      console.error('❌ Erro na conexão:', error);
      // Se der erro de CORS aqui, o script ainda pode estar a funcionar, 
      // mas o navegador impede a leitura da resposta.
      return { success: false, error: error.message };
    }
  }
  async getAvailableSlots(date, serviceDuration = 30) {
  try {
    console.log('🕐 Buscando slots para', date);
    const url = `${this.API_URL}?action=getAvailableSlots&date=${encodeURIComponent(date)}&duration=${serviceDuration}`;

    // Adicionado redirect: 'follow' explicitamente
    const resp = await fetch(url, { mode: 'cors', redirect: 'follow' }); 
    const text = await resp.text();

    let data;
    try {
      data = JSON.parse(text);
    } catch (e) {
      console.warn('Resposta não-JSON, usando fallback local.');
      // IMPORTANTE: Se o backend falhar totalmente, usamos o fallback
      return { success: true, slots: this.getFallbackSlots() }; 
    }

    if (data && data.success) {
      // Se a API diz que é sucesso, usamos os slots dela (mesmo que vazios)
      // Se estiver vazio, é porque o dia está fechado ou cheio.
      console.log(`✅ API retornou ${data.slots?.length ?? 0} slots. Razão: ${data.reason || 'OK'}`);
      return { success: true, slots: data.slots, reason: data.reason };
    }

    // API respondeu mas com erro — usar fallback local para não bloquear o utilizador
    console.warn('⚠️ API retornou success:false. Usando fallback local. Erro:', data?.error);
    return { success: true, slots: this.getFallbackSlots(), fromFallback: true };

  } catch (error) {
    console.error('Erro slots:', error);
    // Em caso de erro de rede, fallback local permite testar o frontend
    return { success: true, slots: this.getFallbackSlots() };
  }
}

  async checkAvailability(date, time, duration = 30) {
    try {
      console.log('🔍 Verificando disponibilidade:', date, time, duration + 'min');
      const url = `${this.API_URL}?action=checkAvailability&date=${encodeURIComponent(date)}&time=${encodeURIComponent(time)}&duration=${duration}`;
      const response = await fetch(url, { mode: 'cors', redirect: 'follow' });
      const data = await response.json();
      console.log('🔍 Resultado disponibilidade:', data);
      return data;
    } catch (error) {
      console.error('Erro disponibilidade:', error);
      // Em caso de erro de rede, bloquear por segurança (não permitir duplicados)
      return { success: false, available: false };
    }
  }

  async saveBooking(bookingData) {
  try {
    // Adicionamos a ação na URL para facilitar a leitura pelo Script
    const url = `${this.API_URL}?action=saveBooking`;
    
    const response = await fetch(url, {
      method: 'POST',
      mode: 'cors',       // IMPORTANTE: Manter cors
      redirect: 'follow', // CRITICO: Força o navegador a seguir o redirecionamento do Google
      body: JSON.stringify(bookingData),
      headers: {
        'Content-Type': 'text/plain;charset=utf-8', // O Google prefere text/plain para evitar pre-flight OPTIONS
      }
    });

    if (!response.ok) throw new Error('Erro na rede');

    const result = await response.json();
    return result;
  } catch (error) {
    console.error('Erro ao salvar:', error);
    return { success: false, error: error.message };
  }
}

  async getServices() {
    try {
      const response = await fetch(`${this.API_URL}?action=getServices`);
      const data = await response.json();
      return data.services || data;
    } catch (error) {
      console.error('Erro serviços:', error);
      return [
        { name: 'Corte de Cabelo', price: 11, duration: 30 },
        { name: 'Barba', price: 5, duration: 20 },
        { name: 'Corte + Barba', price: 15, duration: 50 }
      ];
    }
  }

  // ==================== FUNÇÕES ADMIN ====================

  async adminLogin(email, password) {
    console.log('🔐 Tentativa login admin:', email);
    
    if (email === ADMIN_CREDENTIALS.email && password === ADMIN_CREDENTIALS.password) {
      const session = {
        logged: true,
        email: email,
        expires: Date.now() + (24 * 60 * 60 * 1000),
        nivel: 'admin'
      };
      
      localStorage.setItem('admin_session', JSON.stringify(session));
      console.log('✅ Login admin bem-sucedido');
      return { success: true };
    }
    
    console.log('❌ Login falhou');
    return { success: false, error: 'Credenciais inválidas' };
  }

  checkAuth() {
    try {
      const sessionStr = localStorage.getItem('admin_session');
      if (!sessionStr) return false;
      
      const session = JSON.parse(sessionStr);
      const isValid = session.logged === true && session.expires > Date.now();
      
      return isValid;
    } catch (error) {
      console.error('Erro auth:', error);
      return false;
    }
  }

  logout() {
    localStorage.removeItem('admin_session');
    console.log('👋 Logout realizado');
    return { success: true };
  }

async getBookings(filters = {}) {
  try {
    // **CORRIGIR A CONSTRUÇÃO DA URL**
    const params = new URLSearchParams();
    params.append('action', 'getBookings');
    
    if (filters.date) params.append('date', filters.date);
    if (filters.status) params.append('status', filters.status);
    
    const url = `${this.API_URL}?${params.toString()}`;
    console.log('📋 Buscando reservas:', url);
    
    const response = await fetch(url);
    const data = await response.json();
    
    // **DEBUG: Log dos dados recebidos**
    console.log('📊 Dados recebidos:', data);
    
    if (data.success && data.bookings) {
      return data.bookings;
    }
    
    // **SE NÃO HOUVER bookings, tentar buscar diretamente**
    if (data.success && Array.isArray(data)) {
      return data;
    }
    
    return [];
    
  } catch (error) {
    console.error('Erro getBookings:', error);
    return [];
  }
}

  async getTodayBookings() {
    const today = new Date().toISOString().split('T')[0];
    return this.getBookings({ date: today });
  }

  async updateBookingStatus(bookingId, status) {
    try {
      console.log(`🔄 Atualizando ${bookingId} para ${status}`);
      const response = await fetch(`${this.API_URL}?action=updateBookingStatus`, {
        method: 'POST',
        headers: { 'Content-Type': 'text/plain;charset=utf-8' },
        body: JSON.stringify({ bookingId, status })
      });
      
      return await response.json();
    } catch (error) {
      console.error('Erro updateStatus:', error);
      return { success: false, error: error.message };
    }
  }

  async deleteBooking(bookingId) {
    try {
      console.log(`🗑️ Apagando reserva ${bookingId}`);
      const response = await fetch(`${this.API_URL}?action=deleteBooking`, {
        method: 'POST',
        headers: { 'Content-Type': 'text/plain;charset=utf-8' },
        body: JSON.stringify({ bookingId })
      });
      
      return await response.json();
    } catch (error) {
      console.error('Erro deleteBooking:', error);
      return { success: false, error: error.message };
    }
  }

  async getStats() {
    try {
      const response = await fetch(`${this.API_URL}?action=getStats`);
      const data = await response.json();
      return data.stats || { today: 0, week: 0, pending: 0, revenue: 0 };
    } catch (error) {
      console.error('Erro stats:', error);
      return { today: 0, week: 0, pending: 0, revenue: 0 };
    }
  }

  async getSettings() {
    try {
      const response = await fetch(`${this.API_URL}?action=getSettings`);
      const data = await response.json();
      return data.settings || this.getDefaultSettings();
    } catch (error) {
      console.error('Erro settings:', error);
      return this.getDefaultSettings();
    }
  }

  async saveSettings(settingsData) {
    try {
      const response = await fetch(`${this.API_URL}?action=saveSettings`, {
        method: 'POST',
        headers: { 'Content-Type': 'text/plain;charset=utf-8' },
        body: JSON.stringify(settingsData)
      });
      
      return await response.json();
    } catch (error) {
      console.error('Erro saveSettings:', error);
      return { success: false, error: error.message };
    }
  }

  async getBlockedDates() {
    try {
      const response = await fetch(`${this.API_URL}?action=getBlockedDates`);
      const data = await response.json();
      return data.blockedDates || [];
    } catch (error) {
      console.error('Erro blockedDates:', error);
      return [];
    }
  }

  async addBlockedDate(dateData) {
    try {
      const response = await fetch(`${this.API_URL}?action=addBlockedDate`, {
        method: 'POST',
        headers: { 'Content-Type': 'text/plain;charset=utf-8' },
        body: JSON.stringify(dateData)
      });
      
      return await response.json();
    } catch (error) {
      console.error('Erro addBlockedDate:', error);
      return { success: false, error: error.message };
    }
  }

  async removeBlockedDate(dateId) {
    try {
      const response = await fetch(`${this.API_URL}?action=removeBlockedDate`, {
        method: 'POST',
        headers: { 'Content-Type': 'text/plain;charset=utf-8' },
        body: JSON.stringify({ dateId })
      });
      
      return await response.json();
    } catch (error) {
      console.error('Erro removeBlockedDate:', error);
      return { success: false, error: error.message };
    }
  }

  // ==================== FUNÇÕES AUXILIARES ====================

  getFallbackSlots() {
    const slots = [];
    for (let hour = 9; hour < 19; hour++) {
      if (hour >= 12 && hour < 14) continue;
      slots.push(`${hour.toString().padStart(2, '0')}:00`);
      if (hour < 18) {
        slots.push(`${hour.toString().padStart(2, '0')}:30`);
      }
    }
    return slots;
  }

  getDefaultSettings() {
    return {
      workingHours: {
        open: 9,
        close: 19,
        breakStart: 12,
        breakEnd: 14,
        workingDays: [2, 3, 4, 5, 6]
      },
      whatsapp: {
        number: '+351918749689'
      }
    };
  }

  isConfigured() {
    return this.API_URL && this.API_URL.includes('https://script.google.com');
  }
}

// Instância global
window.barbeariaAPI = new BarbeariaAPI();

// Inicialização
document.addEventListener('DOMContentLoaded', async function() {
  console.log('🔧 Sistema Barbearia inicializando...');
  
  if (!barbeariaAPI.isConfigured()) {
    console.error('❌ API não configurada!');
    showToast('⚠️ Configure a API primeiro!', 'error');
    return;
  }
  
  // Testar conexão
  try {
    const test = await barbeariaAPI.testConnection();
    if (test.success) {
      console.log('✅ API ONLINE:', test.message);
    } else {
      console.error('❌ API OFFLINE:', test.error);
      showToast('⚠️ Erro na conexão com a API', 'error');
    }
  } catch (error) {
    console.error('❌ Erro teste:', error);
  }
});

// ==================== SISTEMA DE NOTIFICAÇÕES PROFISSIONAL ====================
class NotificationSystem {
  constructor() {
    this.container = null;
    this.notifications = [];
    this.init();
  }

  init() {
    // Criar container se não existir
    if (!document.querySelector('.notification-container')) {
      this.container = document.createElement('div');
      this.container.className = 'notification-container';
      document.body.appendChild(this.container);
    } else {
      this.container = document.querySelector('.notification-container');
    }
  }

  /**
   * Mostrar notificação
   * @param {string} message - Mensagem principal
   * @param {string} type - success, error, warning, info
   * @param {Object} options - Opções adicionais
   */
  show(message, type = 'info', options = {}) {
    const id = 'notification-' + Date.now() + '-' + Math.random().toString(36).substr(2, 9);
    const {
      title = this.getTitleByType(type),
      icon = this.getIconByType(type),
      duration = 5000,
      details = null,
      actions = [],
      booking = null
    } = options;

    const notification = document.createElement('div');
    notification.id = id;
    notification.className = `notification ${type} ${booking ? 'notification-booking' : ''}`;
    
    // Construir HTML base
    let html = `
      <div class="notification-icon">
        <i class="${icon}"></i>
      </div>
      <div class="notification-content">
        <div class="notification-title">
          <span>${title}</span>
        </div>
        <div class="notification-message">${message}</div>
    `;

    // Adicionar detalhes da reserva
    if (booking) {
      html += `
        <div class="booking-details">
          <div class="booking-detail-item">
            <i class="fas fa-user"></i>
            <span>${booking.name || 'Cliente'}</span>
          </div>
          <div class="booking-detail-item">
            <i class="fas fa-cut"></i>
            <span>${booking.service || 'Serviço'}</span>
          </div>
          <div class="booking-detail-item">
            <i class="fas fa-calendar"></i>
            <span>${booking.date || ''}</span>
          </div>
          <div class="booking-detail-item">
            <i class="fas fa-clock"></i>
            <span>${booking.time || ''}</span>
          </div>
          <div class="booking-detail-item">
            <i class="fas fa-euro-sign"></i>
            <span>${booking.price || 0}€</span>
          </div>
        </div>
      `;
    }

    // Adicionar ações personalizadas
    if (actions.length > 0) {
      html += `<div class="booking-actions">`;
      actions.forEach(action => {
        html += `
          <button class="${action.class || 'btn'}" onclick="${action.onclick}">
            <i class="${action.icon}"></i> ${action.text}
          </button>
        `;
      });
      html += `</div>`;
    }

    // Adicionar timestamp e fechar
    html += `
        <div class="notification-time">
          <i class="far fa-clock"></i>
          <span>${this.getCurrentTime()}</span>
        </div>
      </div>
      <button class="notification-close" onclick="notificationSystem.close('${id}')">
        <i class="fas fa-times"></i>
      </button>
      <div class="notification-progress" style="animation-duration: ${duration}ms;"></div>
    `;

    notification.innerHTML = html;
    this.container.appendChild(notification);

    // Auto-remover após duração
    const timeout = setTimeout(() => {
      this.close(id);
    }, duration);

    // Armazenar notificação
    this.notifications.push({ id, element: notification, timeout });

    return id;
  }

  /**
   * Fechar notificação específica
   */
  close(id) {
    const notification = this.notifications.find(n => n.id === id);
    if (notification) {
      const element = notification.element;
      clearTimeout(notification.timeout);
      
      element.classList.add('closing');
      setTimeout(() => {
        if (element.parentNode) {
          element.remove();
        }
      }, 400);
      
      this.notifications = this.notifications.filter(n => n.id !== id);
    }
  }

  /**
   * Fechar todas as notificações
   */
  closeAll() {
    this.notifications.forEach(n => {
      this.close(n.id);
    });
  }

  /**
   * Notificação de sucesso para reserva
   */
  showBookingSuccess(bookingData) {
    const formattedDate = this.formatDate(bookingData.date);
    
    return this.show(
      'A sua marcação foi registada com sucesso!',
      'success',
      {
        title: '✅ MARCAÇÃO CONFIRMADA',
        duration: 12000,
        booking: {
          name: bookingData.name,
          service: bookingData.service,
          date: formattedDate,
          time: bookingData.time,
          price: bookingData.price
        },
        actions: []
      }
    );
  }

  downloadICS(bookingData) {
    try {
      console.log('📅 A gerar ficheiro ICS...', bookingData);

      const [year, month, day] = bookingData.date.split('-').map(Number);
      const [hour, min] = bookingData.time.split(':').map(Number);

      const pad = n => String(n).padStart(2, '0');
      const dtStart = `${year}${pad(month)}${pad(day)}T${pad(hour)}${pad(min)}00`;

      const duration = parseInt(bookingData.duration) || 30;
      const endDate = new Date(year, month - 1, day, hour, min + duration);
      const dtEnd = `${endDate.getFullYear()}${pad(endDate.getMonth()+1)}${pad(endDate.getDate())}T${pad(endDate.getHours())}${pad(endDate.getMinutes())}00`;

      const ics = [
        'BEGIN:VCALENDAR',
        'VERSION:2.0',
        'PRODID:-//Barbearia Joao Angeiras//PT',
        'BEGIN:VEVENT',
        `DTSTART:${dtStart}`,
        `DTEND:${dtEnd}`,
        `SUMMARY:Barbearia Joao Angeiras - ${bookingData.service}`,
        `DESCRIPTION:Marcacao confirmada para ${bookingData.name}. Preco: ${bookingData.price}EUR`,
        'LOCATION:R. de 31 de Janeiro 183, Povoa de Varzim',
        `UID:${bookingData.bookingId || Date.now()}@barbearia-joaoangeiras`,
        'BEGIN:VALARM',
        'TRIGGER:-PT60M',
        'ACTION:DISPLAY',
        'DESCRIPTION:Lembrete: Marcacao na Barbearia em 1 hora!',
        'END:VALARM',
        'END:VEVENT',
        'END:VCALENDAR'
      ].join('\r\n');

      // Usar data URI — funciona em PC e telemóvel sem restrições de browser
      const encoded = encodeURIComponent(ics);
      const a = document.createElement('a');
      a.href = 'data:text/calendar;charset=utf-8,' + encoded;
      a.download = 'marcacao-barbearia.ics';
      a.style.display = 'none';
      document.body.appendChild(a);
      a.click();
      setTimeout(() => document.body.removeChild(a), 500);

      console.log('✅ Ficheiro ICS gerado com sucesso!');
    } catch(err) {
      console.error('❌ Erro ao gerar ICS:', err);
      alert('Nao foi possivel gerar o ficheiro da agenda. Tenta novamente.');
    }
  }

  /**
   * Notificação de erro melhorada
   */
  showError(message, error = null) {
    console.error('Erro:', error || message);
    
    return this.show(
      message,
      'error',
      {
        title: '❌ ERRO',
        duration: 6000,
        actions: [
          {
            text: 'Tentar Novamente',
            icon: 'fas fa-redo',
            class: 'btn',
            onclick: 'window.location.reload()'
          }
        ]
      }
    );
  }

  // ========== FUNÇÕES AUXILIARES ==========
  getTitleByType(type) {
    const titles = {
      success: '✅ SUCESSO',
      error: '❌ ERRO',
      warning: '⚠️ ATENÇÃO',
      info: 'ℹ️ INFORMAÇÃO'
    };
    return titles[type] || 'NOTIFICAÇÃO';
  }

  getIconByType(type) {
    const icons = {
      success: 'fas fa-check-circle',
      error: 'fas fa-exclamation-circle',
      warning: 'fas fa-exclamation-triangle',
      info: 'fas fa-info-circle'
    };
    return icons[type] || 'fas fa-bell';
  }

  getCurrentTime() {
    const now = new Date();
    return now.toLocaleTimeString('pt-PT', { hour: '2-digit', minute: '2-digit' });
  }

  formatDate(dateStr) {
    try {
      const date = new Date(dateStr);
      return date.toLocaleDateString('pt-PT', {
        weekday: 'short',
        day: '2-digit',
        month: '2-digit'
      });
    } catch {
      return dateStr;
    }
  }

}

window.notificationSystem = new NotificationSystem();

// Função de compatibilidade com código antigo
function showToast(message, type = 'info', options = {}) {
  return notificationSystem.show(message, type, options);
}