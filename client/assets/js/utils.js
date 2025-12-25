const API_BASE_URL = window.location.origin + '/api';

async function fetchAPI(endpoint, options = {}) {
  const token = localStorage.getItem('token');

  const defaultHeaders = {
    'Content-Type': 'application/json',
  };

  if (token) {
    defaultHeaders['Authorization'] = `Bearer ${token}`;
  }

  const config = {
    ...options,
    headers: {
      ...defaultHeaders,
      ...options.headers,
    },
  };

  try {
    const response = await fetch(`${API_BASE_URL}${endpoint}`, config);
    const data = await response.json();

    if (!response.ok) {
      if (response.status === 401) {
        localStorage.removeItem('token');
        localStorage.removeItem('user');
        window.location.href = '/';
      }

      throw new Error(data.message || 'Request failed');
    }

    return data;
  } catch (error) {
    throw error;
  }
}

function formatCurrency(amount) {
  if (amount === null || amount === undefined) return 'RD$ 0.00';

  return new Intl.NumberFormat('es-DO', {
    style: 'currency',
    currency: 'DOP',
    minimumFractionDigits: 2,
  }).format(amount);
}

function formatDate(dateString) {
  if (!dateString) return '';

  const date = new Date(dateString);
  return new Intl.DateTimeFormat('es-DO', {
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
  }).format(date);
}

function formatDateTime(dateString) {
  if (!dateString) return '';

  const date = new Date(dateString);
  return new Intl.DateTimeFormat('es-DO', {
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
    hour: '2-digit',
    minute: '2-digit',
  }).format(date);
}

function formatRNC(rnc) {
  if (!rnc) return '';

  const cleaned = rnc.replace(/\D/g, '');

  if (cleaned.length === 9) {
    return `${cleaned.slice(0, 3)}-${cleaned.slice(3, 8)}-${cleaned.slice(8)}`;
  }

  return rnc;
}

function formatNCF(ncf) {
  if (!ncf) return '';
  return ncf.toUpperCase();
}

function showToast(message, type = 'info') {
  const existingToast = document.querySelector('.toast');
  if (existingToast) {
    existingToast.remove();
  }

  const toast = document.createElement('div');
  toast.className = `toast ${type}`;
  toast.textContent = message;

  document.body.appendChild(toast);

  setTimeout(() => {
    toast.remove();
  }, 3000);
}

function getUser() {
  const userStr = localStorage.getItem('user');
  return userStr ? JSON.parse(userStr) : null;
}

function getToken() {
  return localStorage.getItem('token');
}

function setAuth(token, user) {
  localStorage.setItem('token', token);
  localStorage.setItem('user', JSON.stringify(user));
}

function clearAuth() {
  localStorage.removeItem('token');
  localStorage.removeItem('user');
}

function isAuthenticated() {
  return !!getToken();
}

function redirectToDashboard(rol) {
  switch (rol) {
    case 'super_admin':
      window.location.href = '/views/admin/dashboard.html';
      break;
    case 'contable':
      window.location.href = '/views/contable/dashboard.html';
      break;
    case 'asistente':
      window.location.href = '/views/asistente/dashboard.html';
      break;
    default:
      window.location.href = '/';
  }
}

function requireAuth() {
  if (!isAuthenticated()) {
    window.location.href = '/';
    return false;
  }
  return true;
}

function debounce(func, wait) {
  let timeout;
  return function executedFunction(...args) {
    const later = () => {
      clearTimeout(timeout);
      func(...args);
    };
    clearTimeout(timeout);
    timeout = setTimeout(later, wait);
  };
}

function getEstadoBadgeClass(estado) {
  const badges = {
    pending: 'badge-warning',
    lista: 'badge-info',
    aprobada: 'badge-success',
    exportada: 'badge-primary',
    rechazada: 'badge-danger'
  };

  return badges[estado] || 'badge-secondary';
}

function getEstadoLabel(estado) {
  const labels = {
    pending: 'Pendiente',
    lista: 'Lista',
    aprobada: 'Aprobada',
    exportada: 'Exportada',
    rechazada: 'Rechazada'
  };

  return labels[estado] || estado;
}

function validateEmail(email) {
  const re = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
  return re.test(email);
}

function validateRNC(rnc) {
  const cleaned = rnc.replace(/\D/g, '');
  return cleaned.length === 9;
}

function validateNCF(ncf) {
  const cleaned = ncf.replace(/\s/g, '').toUpperCase();
  return /^[A-Z]\d{10}$/.test(cleaned);
}
