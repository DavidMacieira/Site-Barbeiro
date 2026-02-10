// api.js - SISTEMA COMPLETO PARA BARBEARIA REAL


const API_URL = 'https://script.google.com/macros/s/AKfycbz0XP1u_ZvO_alVSnEuhtSnmddqqnUcRMyAwOz-b7sjjqWX7ZRtRR85_nAoqcZeUr-6/exec';

// Credenciais admin
const ADMIN_CREDENTIALS = {
  email: 'admin@barbearia.com',
  password: 'admin123'
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
      const url = `${this.API_URL}?action=getAvailableSlots&date=${date}&duration=${serviceDuration}`;
      const response = await fetch(url);
      const data = await response.json();
      
      if (data.success && data.slots) {
        return data.slots;
      }
      return [];
    } catch (error) {
      console.error('Erro slots:', error);
      return this.getFallbackSlots();
    }
  }

  async checkAvailability(date, time, duration = 30) {
    try {
      console.log('🔍 Verificando disponibilidade:', date, time);
      const url = `${this.API_URL}?action=checkAvailability&date=${date}&time=${time}&duration=${duration}`;
      const response = await fetch(url);
      return await response.json();
    } catch (error) {
      console.error('Erro disponibilidade:', error);
      return { success: true, available: true }; // Em caso de erro, permitir
    }
  }

  async saveBooking(bookingData) {
    try {
    console.log('💾 Salvando reserva REAL:', bookingData);
      
    const response = await fetch(`${this.API_URL}?action=saveBooking`, {
      method: 'POST',
      mode: 'cors',
      headers: { 
        'Content-Type': 'text/plain' // **MUDAR para text/plain**
      },
      body: JSON.stringify(bookingData)
    });
    const result = await response.json();
    console.log('Resultado API:', result);
    
    return result;
  } catch (error) {
    console.error('❌ Erro grave saveBooking:', error);
    return {
      success: false,
      error: 'Erro de conexão. Tente novamente.'
    };
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
        number: '+351919241169'
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

// Função global toast
function showToast(message, type = 'info') {
  if (typeof Toastify === 'undefined') {
    alert(message);
    return;
  }
  
  const colors = {
    success: '#4CAF50',
    error: '#f44336',
    warning: '#ff9800',
    info: '#2196F3'
  };
  
  Toastify({
    text: message,
    duration: 3000,
    gravity: "top",
    position: "right",
    backgroundColor: colors[type] || '#333',
    stopOnFocus: true,
    style: { borderRadius: '4px' }
  }).showToast();
}