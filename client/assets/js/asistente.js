let currentUser = null;
let facturas = [];
let empresas = [];
let currentFacturaIndex = 0;
let facturasActuales = [];
let ultimaFacturaMarcada = null;
let timerDeshacer = null;

// ========== INICIALIZACIÓN ==========
document.addEventListener('DOMContentLoaded', () => {
  if (!requireAuth()) return;

  currentUser = getUser();
  if (!['asistente', 'contable', 'super_admin'].includes(currentUser.rol)) {
    showToast('Acceso denegado', 'error');
    window.location.href = '/';
    return;
  }

  loadDashboard();
  inicializarAtajosTeclado();
  actualizarContadorProgreso();

  document.getElementById('logoutBtn')?.addEventListener('click', handleLogout);
  document.getElementById('filterEstado')?.addEventListener('change', filterFacturas);
});

// ========== ATAJOS DE TECLADO ==========
function inicializarAtajosTeclado() {
  document.addEventListener('keydown', (e) => {
    const modal = document.getElementById('facturaModal');
    const isModalOpen = modal && modal.classList.contains('show');

    if (isModalOpen) {
      handleKeyboardShortcuts(e);
    } else if (e.key === '?') {
      e.preventDefault();
      mostrarAyudaAtajos();
    }
  });
}

function handleKeyboardShortcuts(e) {
  if (e.key === 'Escape') {
    e.preventDefault();
    closeModal();
    return;
  }

  if (e.key === 'Enter' && e.ctrlKey) {
    e.preventDefault();
    guardarYCerrar();
    return;
  }

  if (e.key === 'Enter' && !e.ctrlKey) {
    const target = e.target;
    if (target.tagName === 'TEXTAREA' || target.tagName === 'INPUT') {
      return;
    }
    e.preventDefault();
    guardarYSiguiente();
    return;
  }

  if (e.key === 'r' || e.key === 'R') {
    e.preventDefault();
    rechazarFacturaActual();
    return;
  }

  if (e.key === 's' || e.key === 'S') {
    e.preventDefault();
    saltarFacturaActual();
    return;
  }

  if (e.key === 'ArrowLeft') {
    e.preventDefault();
    navegarFactura('anterior');
    return;
  }

  if (e.key === 'ArrowRight') {
    e.preventDefault();
    navegarFactura('siguiente');
    return;
  }

  if (e.key === '?') {
    e.preventDefault();
    mostrarAyudaAtajos();
    return;
  }
}

function mostrarAyudaAtajos() {
  const existingHelp = document.getElementById('keyboardHelp');
  if (existingHelp) {
    existingHelp.remove();
    return;
  }

  const helpPanel = document.createElement('div');
  helpPanel.id = 'keyboardHelp';
  helpPanel.className = 'keyboard-shortcuts-panel';
  helpPanel.innerHTML = `
    <div class="shortcuts-content">
      <div class="shortcuts-header">
        <h3>⌨️ Atajos de Teclado</h3>
        <button onclick="document.getElementById('keyboardHelp').remove()">×</button>
      </div>
      <div class="shortcuts-list">
        <div class="shortcut-item">
          <kbd>Enter</kbd>
          <span>Guardar + Marcar como lista + Siguiente</span>
        </div>
        <div class="shortcut-item">
          <kbd>Ctrl</kbd> + <kbd>Enter</kbd>
          <span>Marcar lista + Cerrar modal</span>
        </div>
        <div class="shortcut-item">
          <kbd>R</kbd>
          <span>Rechazar factura</span>
        </div>
        <div class="shortcut-item">
          <kbd>S</kbd>
          <span>Saltar factura (revisar después)</span>
        </div>
        <div class="shortcut-item">
          <kbd>←</kbd> / <kbd>→</kbd>
          <span>Navegar entre facturas</span>
        </div>
        <div class="shortcut-item">
          <kbd>Esc</kbd>
          <span>Cerrar modal sin guardar</span>
        </div>
        <div class="shortcut-item">
          <kbd>?</kbd>
          <span>Mostrar/ocultar esta ayuda</span>
        </div>
      </div>
    </div>
  `;
  document.body.appendChild(helpPanel);
}

async function guardarYSiguiente() {
  const formElement = document.getElementById('facturaForm');
  if (!formElement) return;

  await saveFactura({ preventDefault: () => {} });

  setTimeout(() => {
    navegarFactura('siguiente');
  }, 300);
}

async function guardarYCerrar() {
  await saveFactura({ preventDefault: () => {} });
  setTimeout(() => {
    closeModal();
  }, 300);
}

async function rechazarFacturaActual() {
  const id = document.getElementById('facturaId').value;
  if (!id) return;

  if (!confirm('¿Está seguro de rechazar esta factura?')) {
    return;
  }

  try {
    await fetchAPI(`/asistente/facturas/${id}/rechazar`, {
      method: 'POST'
    });

    showToast('Factura rechazada', 'success');
    closeModal();
    loadDashboard();
  } catch (error) {
    showToast('Error: ' + error.message, 'error');
  }
}

async function saltarFacturaActual() {
  const id = document.getElementById('facturaId').value;
  if (!id) return;

  try {
    await fetchAPI(`/asistente/facturas/${id}`, {
      method: 'PUT',
      body: JSON.stringify({ saltada: true })
    });

    showToast('Factura saltada (se revisará después)', 'info');
    navegarFactura('siguiente');
  } catch (error) {
    showToast('Error: ' + error.message, 'error');
  }
}

function navegarFactura(direccion) {
  if (direccion === 'siguiente') {
    currentFacturaIndex = (currentFacturaIndex + 1) % facturasActuales.length;
  } else if (direccion === 'anterior') {
    currentFacturaIndex = (currentFacturaIndex - 1 + facturasActuales.length) % facturasActuales.length;
  }

  if (facturasActuales.length > 0) {
    const factura = facturasActuales[currentFacturaIndex];
    cargarFacturaEnModal(factura);
  }
}

function cargarFacturaEnModal(factura) {
  document.getElementById('facturaId').value = factura.id;
  document.getElementById('facturaFecha').value = factura.fecha_factura || '';
  document.getElementById('facturaNCF').value = factura.ncf || '';
  document.getElementById('facturaRNC').value = factura.rnc || '';
  document.getElementById('facturaProveedor').value = factura.proveedor || '';
  document.getElementById('facturaITBIS').value = factura.itbis || '';
  document.getElementById('facturaTotal').value = factura.total_pagado || '';
  document.getElementById('facturaNotas').value = factura.notas || '';

  if (factura.ncf) {
    checkDuplicado(factura.ncf, factura.id);
  }
}

// ========== CONTADOR DE PROGRESO ==========
function inicializarSesion() {
  const hoy = new Date().toDateString();
  const sesionFecha = localStorage.getItem('sesion_fecha');

  if (sesionFecha !== hoy) {
    localStorage.setItem('sesion_fecha', hoy);
    localStorage.setItem('sesion_inicio', new Date().toISOString());
    localStorage.setItem('sesion_procesadas', '0');
  }
}

function incrementarProgreso() {
  inicializarSesion();
  let procesadas = parseInt(localStorage.getItem('sesion_procesadas') || '0');
  procesadas++;
  localStorage.setItem('sesion_procesadas', procesadas.toString());
  actualizarContadorProgreso();
}

function actualizarContadorProgreso() {
  const containerHTML = document.getElementById('progressContainer');
  if (!containerHTML) return;

  inicializarSesion();

  const procesadas = parseInt(localStorage.getItem('sesion_procesadas') || '0');
  const inicio = localStorage.getItem('sesion_inicio');
  const pendientes = parseInt(document.getElementById('facturasPendientes')?.textContent || '0');
  const total = pendientes + procesadas;

  if (total === 0) {
    containerHTML.style.display = 'none';
    return;
  }

  containerHTML.style.display = 'block';

  const porcentaje = Math.round((procesadas / total) * 100);

  let tiempoTrabajo = '';
  let ritmo = '';
  let estimado = '';

  if (inicio && procesadas > 0) {
    const inicioDate = new Date(inicio);
    const ahora = new Date();
    const minutosTranscurridos = Math.round((ahora - inicioDate) / 60000);

    const horas = Math.floor(minutosTranscurridos / 60);
    const minutos = minutosTranscurridos % 60;
    tiempoTrabajo = horas > 0 ? `${horas}h ${minutos}min` : `${minutos}min`;

    const ritmoMin = minutosTranscurridos / procesadas;
    ritmo = `${ritmoMin.toFixed(1)} min/factura`;

    const minutosRestantes = Math.round(pendientes * ritmoMin);
    const horasRestantes = Math.floor(minutosRestantes / 60);
    const minutosRestantesMod = minutosRestantes % 60;
    estimado = horasRestantes > 0 ? `~${horasRestantes}h ${minutosRestantesMod}min` : `~${minutosRestantes}min`;
  }

  containerHTML.innerHTML = `
    <div class="progress-card">
      <h3>📊 Progreso de Hoy</h3>
      <div class="progress-bar-container">
        <div class="progress-bar" style="width: ${porcentaje}%"></div>
      </div>
      <div class="progress-stats">
        <span>${procesadas}/${total} (${porcentaje}%)</span>
      </div>
      ${tiempoTrabajo ? `
        <div class="progress-details">
          <div class="progress-detail-item">
            <span class="detail-label">⏱️ Tiempo:</span>
            <span class="detail-value">${tiempoTrabajo}</span>
          </div>
          <div class="progress-detail-item">
            <span class="detail-label">📈 Ritmo:</span>
            <span class="detail-value">${ritmo}</span>
          </div>
          <div class="progress-detail-item">
            <span class="detail-label">⏰ Estimado:</span>
            <span class="detail-value">${estimado}</span>
          </div>
        </div>
      ` : ''}
    </div>
  `;
}

// ========== DESHACER MARCADO ==========
function mostrarBannerDeshacer(facturaId) {
  const existingBanner = document.getElementById('undoBanner');
  if (existingBanner) {
    existingBanner.remove();
  }

  ultimaFacturaMarcada = { id: facturaId, timestamp: Date.now() };

  const banner = document.createElement('div');
  banner.id = 'undoBanner';
  banner.className = 'undo-banner';
  banner.innerHTML = `
    <span>✓ Factura #${facturaId} marcada como lista</span>
    <button onclick="deshacerMarcar()" class="btn-undo">⏮️ Deshacer</button>
    <span id="undoTimer">8</span>
  `;
  document.body.appendChild(banner);

  let segundos = 8;
  timerDeshacer = setInterval(() => {
    segundos--;
    const timerEl = document.getElementById('undoTimer');
    if (timerEl) {
      timerEl.textContent = segundos;
    }

    if (segundos <= 0) {
      clearInterval(timerDeshacer);
      banner.remove();
      ultimaFacturaMarcada = null;
    }
  }, 1000);
}

async function deshacerMarcar() {
  if (!ultimaFacturaMarcada) return;

  const ahora = Date.now();
  if (ahora - ultimaFacturaMarcada.timestamp > 8000) {
    showToast('Tiempo para deshacer expirado', 'error');
    return;
  }

  try {
    await fetchAPI(`/asistente/facturas/${ultimaFacturaMarcada.id}/desmarcar`, {
      method: 'POST'
    });

    showToast('✓ Factura desmarcada', 'success');

    const banner = document.getElementById('undoBanner');
    if (banner) banner.remove();

    clearInterval(timerDeshacer);
    ultimaFacturaMarcada = null;

    loadDashboard();
  } catch (error) {
    showToast('Error: ' + error.message, 'error');
  }
}

// ========== DETECCIÓN DE DUPLICADOS ==========
async function checkDuplicado(ncf, currentId) {
  const alertContainer = document.getElementById('duplicadoAlert');
  if (!alertContainer) return;

  if (!ncf || ncf.trim() === '') {
    alertContainer.style.display = 'none';
    return;
  }

  try {
    const response = await fetchAPI(`/asistente/facturas/check-duplicado?ncf=${encodeURIComponent(ncf)}`);

    if (response.success) {
      const duplicados = response.data.filter(f => f.id != currentId);

      if (duplicados.length > 0) {
        const dup = duplicados[0];
        alertContainer.innerHTML = `
          <div class="alert-duplicado">
            <div class="alert-icon">⚠️</div>
            <div class="alert-content">
              <strong>Posible duplicado detectado</strong>
              <p>Ya existe factura con NCF ${ncf}</p>
              <ul>
                <li>Fecha: ${formatDate(dup.fecha_factura)}</li>
                <li>Empresa: ${dup.empresa_nombre}</li>
                <li>Monto: ${formatCurrency(dup.total_pagado)}</li>
                <li>Estado: ${getEstadoLabel(dup.estado)}</li>
              </ul>
            </div>
          </div>
        `;
        alertContainer.style.display = 'block';
      } else {
        alertContainer.style.display = 'none';
      }
    }
  } catch (error) {
    console.error('Error checking duplicado:', error);
  }
}

// ========== FUNCIONES PRINCIPALES ==========
async function loadDashboard() {
  try {
    const dashboardData = await fetchAPI('/asistente/dashboard');

    if (dashboardData.success) {
      displayStats(dashboardData.data.stats);
      empresas = dashboardData.data.empresas || [];
      facturas = dashboardData.data.facturas_recientes || [];
      facturasActuales = facturas.filter(f => f.estado === 'pending' || f.estado === 'lista');
      displayFacturas(facturas);
      actualizarContadorProgreso();
    }
  } catch (error) {
    showToast('Error al cargar dashboard: ' + error.message, 'error');
  }
}

function displayStats(stats) {
  document.getElementById('totalEmpresas').textContent = stats.total_empresas || 0;

  const facturasStats = stats.facturas || {};
  document.getElementById('facturasPendientes').textContent = facturasStats.pendientes || 0;
  document.getElementById('facturasListas').textContent = facturasStats.listas || 0;
}

function displayFacturas(facturas) {
  const tbody = document.getElementById('facturasTableBody');

  if (!tbody) return;

  if (facturas.length === 0) {
    tbody.innerHTML = `
      <tr>
        <td colspan="8" class="text-center">
          <div class="empty-state">
            <div class="empty-state-icon">📄</div>
            <p>No hay facturas asignadas</p>
          </div>
        </td>
      </tr>
    `;
    return;
  }

  tbody.innerHTML = facturas.map(factura => `
    <tr>
      <td>${factura.id}</td>
      <td>
        ${factura.empresa_nombre || '-'}
        ${factura.saltada ? '<span class="badge badge-warning" style="margin-left: 5px;">⏭️</span>' : ''}
        ${factura.notas ? '<span class="badge badge-info" style="margin-left: 5px;">💬</span>' : ''}
      </td>
      <td>${formatDate(factura.fecha_factura)}</td>
      <td>${factura.ncf || '-'}</td>
      <td>${factura.proveedor || '-'}</td>
      <td>${formatCurrency(factura.total_pagado)}</td>
      <td>
        <span class="badge ${getEstadoBadgeClass(factura.estado)}">
          ${getEstadoLabel(factura.estado)}
        </span>
      </td>
      <td>
        <div class="actions">
          ${factura.estado === 'pending' || factura.estado === 'lista' ? `
            <button class="btn btn-sm btn-primary" onclick="editFactura(${factura.id})">
              Editar
            </button>
            <button class="btn btn-sm btn-secondary" onclick="aprobarFactura(${factura.id})">
              Aprobar
            </button>
          ` : ''}
          ${factura.drive_url ? `
            <a href="${factura.drive_url}" target="_blank" class="btn btn-sm btn-outline">
              Ver
            </a>
          ` : ''}
        </div>
      </td>
    </tr>
  `).join('');
}

async function filterFacturas() {
  const estado = document.getElementById('filterEstado').value;

  try {
    const params = new URLSearchParams();
    if (estado) params.append('estado', estado);

    const response = await fetchAPI(`/asistente/facturas?${params.toString()}`);

    if (response.success) {
      facturas = response.data;
      facturasActuales = facturas.filter(f => f.estado === 'pending' || f.estado === 'lista');
      displayFacturas(facturas);
    }
  } catch (error) {
    showToast('Error al filtrar facturas: ' + error.message, 'error');
  }
}

function editFactura(id) {
  const factura = facturas.find(f => f.id === id);
  if (!factura) return;

  currentFacturaIndex = facturasActuales.findIndex(f => f.id === id);
  if (currentFacturaIndex === -1) currentFacturaIndex = 0;

  document.getElementById('modalTitle').textContent = `Editar Factura #${factura.id}`;
  cargarFacturaEnModal(factura);

  document.getElementById('facturaModal').classList.add('show');
}

function closeModal() {
  const modal = document.getElementById('facturaModal');
  modal.classList.remove('show');

  const helpPanel = document.getElementById('keyboardHelp');
  if (helpPanel) helpPanel.remove();
}

async function saveFactura(e) {
  e.preventDefault();

  const id = document.getElementById('facturaId').value;
  const formData = {
    fecha_factura: document.getElementById('facturaFecha').value,
    ncf: document.getElementById('facturaNCF').value,
    rnc: document.getElementById('facturaRNC').value,
    proveedor: document.getElementById('facturaProveedor').value,
    itbis: parseFloat(document.getElementById('facturaITBIS').value) || 0,
    total_pagado: parseFloat(document.getElementById('facturaTotal').value) || 0,
    notas: document.getElementById('facturaNotas').value || '',
    estado: 'lista'
  };

  try {
    await fetchAPI(`/asistente/facturas/${id}`, {
      method: 'PUT',
      body: JSON.stringify(formData)
    });

    showToast('Factura actualizada', 'success');
    incrementarProgreso();
    mostrarBannerDeshacer(id);

    loadDashboard();
  } catch (error) {
    showToast('Error: ' + error.message, 'error');
  }
}

async function aprobarFactura(id) {
  if (!confirm('¿Está seguro de aprobar esta factura?')) {
    return;
  }

  try {
    await fetchAPI(`/asistente/facturas/${id}/aprobar`, {
      method: 'POST'
    });

    showToast('Factura aprobada', 'success');
    loadDashboard();
  } catch (error) {
    showToast('Error: ' + error.message, 'error');
  }
}

function handleLogout() {
  clearAuth();
  window.location.href = '/';
}
