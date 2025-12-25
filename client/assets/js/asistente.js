let currentUser = null;
let facturas = [];
let facturasAgrupadas = {
  alta_confianza: [],
  media_confianza: [],
  baja_confianza: [],
  listas: []
};
let empresas = [];
let currentFacturaIndex = 0;
let currentZoom = 1;
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
});

// ========== ATAJOS DE TECLADO ==========
function inicializarAtajosTeclado() {
  document.addEventListener('keydown', (e) => {
    const modal = document.getElementById('validacionModal');
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
  // No interceptar si está escribiendo en un campo
  const target = e.target;
  const isTyping = target.tagName === 'TEXTAREA' || 
                   (target.tagName === 'INPUT' && target.type !== 'date');

  if (e.key === 'Escape') {
    e.preventDefault();
    closeSplitModal();
    return;
  }

  if (e.key === 'Enter' && e.ctrlKey) {
    e.preventDefault();
    guardarYCerrar();
    return;
  }

  if (e.key === 'Enter' && !e.ctrlKey && !isTyping) {
    e.preventDefault();
    guardarYSiguiente();
    return;
  }

  if ((e.key === 'r' || e.key === 'R') && !isTyping) {
    e.preventDefault();
    rechazarFactura();
    return;
  }

  if ((e.key === 's' || e.key === 'S') && !isTyping) {
    e.preventDefault();
    saltarFactura();
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
  await marcarListaModal();
  if (currentFacturaIndex < facturasActuales.length - 1) {
    setTimeout(() => navegarFactura('siguiente'), 300);
  } else {
    setTimeout(() => closeSplitModal(), 300);
  }
}

async function guardarYCerrar() {
  await marcarListaModal();
  setTimeout(() => closeSplitModal(), 300);
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

  if (timerDeshacer) {
    clearInterval(timerDeshacer);
  }

  ultimaFacturaMarcada = { id: facturaId, timestamp: Date.now() };

  const banner = document.createElement('div');
  banner.id = 'undoBanner';
  banner.className = 'undo-banner';
  banner.innerHTML = `
    <span>✓ Factura #${facturaId} marcada como lista</span>
    <button onclick="deshacerMarcar()" class="btn-undo">⏮️ Deshacer (<span id="undoTimer">8</span>s)</button>
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
    await fetchAPI(`/asistente/facturas/${ultimaFacturaMarcada.id}`, {
      method: 'PUT',
      body: JSON.stringify({ estado: 'pending' })
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

    if (response.success && response.data) {
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
                <li>Empresa: ${dup.empresa_nombre || 'N/A'}</li>
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
    alertContainer.style.display = 'none';
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
      facturasAgrupadas = dashboardData.data.facturas_agrupadas || {
        alta_confianza: [],
        media_confianza: [],
        baja_confianza: [],
        listas: []
      };

      mostrarResumenSesion();
      displayFacturasAgrupadas();
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
  document.getElementById('facturasAprobadas').textContent = facturasStats.aprobadas || 0;
}

function mostrarResumenSesion() {
  const listas = facturasAgrupadas.listas || [];
  const sessionSummary = document.getElementById('sessionSummary');
  
  if (listas.length > 0) {
    document.getElementById('facturasListasCount').textContent = listas.length;
    sessionSummary.style.display = 'block';
  } else {
    sessionSummary.style.display = 'none';
  }
}

function displayFacturasAgrupadas() {
  displayFacturasSeccion(
    facturasAgrupadas.alta_confianza || [],
    'facturasAltaConfianza',
    'countAltaConfianza',
    'high'
  );

  displayFacturasSeccion(
    facturasAgrupadas.media_confianza || [],
    'facturasMediaConfianza',
    'countMediaConfianza',
    'medium'
  );

  displayFacturasSeccion(
    facturasAgrupadas.baja_confianza || [],
    'facturasBajaConfianza',
    'countBajaConfianza',
    'low'
  );
}

function displayFacturasSeccion(facturas, containerId, countId, confidenceLevel) {
  const container = document.getElementById(containerId);
  const countBadge = document.getElementById(countId);

  if (!container) return;

  countBadge.textContent = facturas.length;

  if (facturas.length === 0) {
    container.innerHTML = '<div class="empty-message">No hay facturas en esta categoría</div>';
    return;
  }

  container.innerHTML = facturas.map((factura, index) => {
    const badges = [];
    if (factura.saltada) badges.push('<span class="badge-mini">⏭️</span>');
    if (factura.notas) badges.push('<span class="badge-mini">💬</span>');
    
    return `
    <div class="factura-card" onclick="abrirValidacionSeccion('${confidenceLevel}', ${index})">
      <div class="factura-card-header">
        <div class="factura-empresa">
          ${factura.empresa_nombre || 'Sin empresa'}
          ${badges.join(' ')}
        </div>
        <div class="factura-confidence ${confidenceLevel}">
          ${(factura.confidence_score || 0).toFixed(0)}%
        </div>
      </div>
      
      <div class="factura-info-row">
        <span class="factura-info-label">Fecha:</span>
        <span class="factura-info-value">${formatDate(factura.fecha_factura)}</span>
      </div>
      
      <div class="factura-info-row">
        <span class="factura-info-label">NCF:</span>
        <span class="factura-info-value">${factura.ncf || '-'}</span>
      </div>
      
      <div class="factura-info-row">
        <span class="factura-info-label">Proveedor:</span>
        <span class="factura-info-value">${factura.proveedor || '-'}</span>
      </div>
      
      <div class="factura-total">
        ${formatCurrency(factura.total_pagado)}
      </div>
    </div>
  `}).join('');
}

// ========== MODAL SPLIT VIEW ==========
function abrirValidacionSeccion(seccion, index) {
  const seccionMap = {
    'high': facturasAgrupadas.alta_confianza,
    'medium': facturasAgrupadas.media_confianza,
    'low': facturasAgrupadas.baja_confianza
  };

  facturasActuales = seccionMap[seccion] || [];
  
  if (facturasActuales.length === 0) {
    showToast('No hay facturas disponibles', 'error');
    return;
  }

  currentFacturaIndex = index;
  mostrarFacturaEnModal(currentFacturaIndex);
  document.getElementById('validacionModal').classList.add('show');
}

function mostrarFacturaEnModal(index) {
  const factura = facturasActuales[index];
  if (!factura) return;

  const confidence = factura.confidence_score || 0;
  let nivelLabel = '';
  let nivelClass = '';
  
  if (confidence >= 95) {
    nivelLabel = '🟢 Revisión Rápida';
    nivelClass = 'high';
  } else if (confidence >= 80) {
    nivelLabel = '🟡 Validar Campos';
    nivelClass = 'medium';
  } else {
    nivelLabel = '🔴 Revisar Completo';
    nivelClass = 'low';
  }

  document.getElementById('nivelConfianzaBadge').textContent = nivelLabel;
  document.getElementById('facturaCounter').textContent = `(${index + 1} de ${facturasActuales.length})`;

  document.getElementById('infoEmpresa').textContent = factura.empresa_nombre || '-';
  document.getElementById('infoFecha').value = factura.fecha_factura || '';
  document.getElementById('infoNCF').value = factura.ncf || '';
  document.getElementById('infoRNC').value = factura.rnc || '';
  document.getElementById('infoProveedor').value = factura.proveedor || '';
  document.getElementById('infoITBIS').value = factura.itbis || '';
  document.getElementById('infoTotal').value = factura.total_pagado || '';
  document.getElementById('infoNotas').value = factura.notas || '';

  const badge = document.getElementById('confidenceBadge');
  document.getElementById('confidenceValue').textContent = confidence.toFixed(0);
  badge.className = 'confidence-badge ' + nivelClass;

  document.getElementById('imagePlaceholder').style.display = 'flex';
  document.getElementById('facturaImage').style.display = 'none';

  resetZoom();

  document.getElementById('btnAnterior').disabled = index === 0;
  document.getElementById('btnSiguiente').disabled = index === facturasActuales.length - 1;

  document.getElementById('validationAlert').style.display = 'none';

  // Check duplicados
  if (factura.ncf) {
    checkDuplicado(factura.ncf, factura.id);
  }
}

function navegarFactura(direccion) {
  if (direccion === 'siguiente' && currentFacturaIndex < facturasActuales.length - 1) {
    currentFacturaIndex++;
    mostrarFacturaEnModal(currentFacturaIndex);
  } else if (direccion === 'anterior' && currentFacturaIndex > 0) {
    currentFacturaIndex--;
    mostrarFacturaEnModal(currentFacturaIndex);
  }
}

function closeSplitModal() {
  document.getElementById('validacionModal').classList.remove('show');
  resetZoom();
}

// ========== ZOOM DE IMAGEN ==========
function zoomIn() {
  currentZoom += 0.2;
  if (currentZoom > 3) currentZoom = 3;
  applyZoom();
}

function zoomOut() {
  currentZoom -= 0.2;
  if (currentZoom < 0.5) currentZoom = 0.5;
  applyZoom();
}

function resetZoom() {
  currentZoom = 1;
  applyZoom();
}

function applyZoom() {
  const img = document.getElementById('facturaImage');
  img.style.transform = `scale(${currentZoom})`;
}

// ========== MARCAR COMO LISTA ==========
async function marcarListaModal() {
  const factura = facturasActuales[currentFacturaIndex];
  
  const datosActualizados = {
    fecha_factura: document.getElementById('infoFecha').value || null,
    ncf: document.getElementById('infoNCF').value || null,
    rnc: document.getElementById('infoRNC').value || null,
    proveedor: document.getElementById('infoProveedor').value || null,
    itbis: document.getElementById('infoITBIS').value ? parseFloat(document.getElementById('infoITBIS').value) : null,
    total_pagado: document.getElementById('infoTotal').value ? parseFloat(document.getElementById('infoTotal').value) : null,
    notas: document.getElementById('infoNotas').value || null,
    estado: 'lista'
  };

  try {
    await fetchAPI(`/asistente/facturas/${factura.id}`, {
      method: 'PUT',
      body: JSON.stringify(datosActualizados)
    });

    showToast('✓ Factura marcada como lista', 'success');
    incrementarProgreso();
    mostrarBannerDeshacer(factura.id);
    loadDashboard();
  } catch (error) {
    showToast('Error: ' + error.message, 'error');
  }
}

async function rechazarFactura() {
  const factura = facturasActuales[currentFacturaIndex];
  
  if (!confirm('¿Está seguro de rechazar esta factura?')) {
    return;
  }

  try {
    await fetchAPI(`/asistente/facturas/${factura.id}`, {
      method: 'PUT',
      body: JSON.stringify({ estado: 'rechazada' })
    });

    showToast('Factura rechazada', 'success');
    
    if (currentFacturaIndex < facturasActuales.length - 1) {
      navegarFactura('siguiente');
    } else {
      closeSplitModal();
    }
    
    loadDashboard();
  } catch (error) {
    showToast('Error: ' + error.message, 'error');
  }
}

async function saltarFactura() {
  const factura = facturasActuales[currentFacturaIndex];

  try {
    await fetchAPI(`/asistente/facturas/${factura.id}`, {
      method: 'PUT',
      body: JSON.stringify({ saltada: true })
    });

    showToast('Factura saltada (se revisará después)', 'info');
    
    if (currentFacturaIndex < facturasActuales.length - 1) {
      navegarFactura('siguiente');
    } else {
      closeSplitModal();
    }
    
    loadDashboard();
  } catch (error) {
    showToast('Error: ' + error.message, 'error');
  }
}

// ========== APROBACIÓN EN LOTE ==========
function mostrarConfirmacionLote() {
  const listas = facturasAgrupadas.listas || [];
  
  if (listas.length === 0) {
    showToast('No hay facturas listas para aprobar', 'warning');
    return;
  }

  const porEmpresa = {};
  listas.forEach(f => {
    const empresa = f.empresa_nombre || 'Sin empresa';
    if (!porEmpresa[empresa]) {
      porEmpresa[empresa] = { count: 0, monto: 0 };
    }
    porEmpresa[empresa].count++;
    porEmpresa[empresa].monto += parseFloat(f.total_pagado) || 0;
  });

  document.getElementById('totalFacturasLote').textContent = listas.length;

  const resumenEmpresas = document.getElementById('resumenEmpresas');
  resumenEmpresas.innerHTML = Object.entries(porEmpresa)
    .map(([empresa, data]) => `
      <div class="resumen-empresa-item">
        <span><strong>${empresa}</strong></span>
        <span>${data.count} factura${data.count > 1 ? 's' : ''} - ${formatCurrency(data.monto)}</span>
      </div>
    `).join('');

  document.getElementById('confirmacionLoteModal').classList.add('show');
}

function cerrarConfirmacionLote() {
  document.getElementById('confirmacionLoteModal').classList.remove('show');
}

async function confirmarAprobacionLote() {
  const listas = facturasAgrupadas.listas || [];
  
  if (listas.length === 0) {
    showToast('No hay facturas para aprobar', 'error');
    return;
  }

  const facturasIds = listas.map(f => f.id);

  try {
    const response = await fetchAPI('/asistente/aprobar-lote', {
      method: 'POST',
      body: JSON.stringify({ facturas_ids: facturasIds })
    });

    if (response.success) {
      showToast(`✅ ${response.data.aprobadas} facturas aprobadas correctamente`, 'success');
      
      // Limpiar sesión
      localStorage.removeItem('sesion_procesadas');
      
      cerrarConfirmacionLote();
      loadDashboard();
    }
  } catch (error) {
    showToast('Error al aprobar lote: ' + error.message, 'error');
  }
}

function handleLogout() {
  clearAuth();
  window.location.href = '/';
}