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
let facturasActuales = []; // Array de facturas que se está visualizando

document.addEventListener('DOMContentLoaded', () => {
  if (!requireAuth()) return;

  currentUser = getUser();
  if (!['asistente', 'contable', 'super_admin'].includes(currentUser.rol)) {
    showToast('Acceso denegado', 'error');
    window.location.href = '/';
    return;
  }

  loadDashboard();

  document.getElementById('logoutBtn')?.addEventListener('click', handleLogout);
});

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

      // Mostrar resumen de sesión si hay facturas listas
      mostrarResumenSesion();

      // Mostrar facturas agrupadas
      displayFacturasAgrupadas();
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
    const totalMonto = listas.reduce((sum, f) => sum + (parseFloat(f.total_pagado) || 0), 0);
    
    document.getElementById('facturasListasCount').textContent = listas.length;
    document.getElementById('totalListasAmount').textContent = formatCurrency(totalMonto);
    
    sessionSummary.style.display = 'block';
  } else {
    sessionSummary.style.display = 'none';
  }
}

function displayFacturasAgrupadas() {
  // Alta confianza
  displayFacturasSeccion(
    facturasAgrupadas.alta_confianza || [],
    'facturasAltaConfianza',
    'countAltaConfianza',
    'high'
  );

  // Media confianza
  displayFacturasSeccion(
    facturasAgrupadas.media_confianza || [],
    'facturasMediaConfianza',
    'countMediaConfianza',
    'medium'
  );

  // Baja confianza
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

  container.innerHTML = facturas.map((factura, index) => `
    <div class="factura-card" onclick="abrirValidacionSeccion('${confidenceLevel}', ${index})">
      <div class="factura-card-header">
        <div class="factura-empresa">${factura.empresa_nombre || 'Sin empresa'}</div>
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
  `).join('');
}

// ============================================
// MODAL SPLIT VIEW
// ============================================

function abrirValidacionSeccion(seccion, index) {
  // Mapear sección a array de facturas
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

  // Determinar nivel de confianza
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

  // Actualizar badge de nivel
  document.getElementById('nivelConfianzaBadge').textContent = nivelLabel;

  // Actualizar contador
  document.getElementById('facturaCounter').textContent = 
    `(${index + 1} de ${facturasActuales.length})`;

  // Actualizar empresa
  document.getElementById('infoEmpresa').textContent = factura.empresa_nombre || '-';

  // Actualizar campos editables
  document.getElementById('infoFecha').value = factura.fecha_factura || '';
  document.getElementById('infoNCF').value = factura.ncf || '';
  document.getElementById('infoRNC').value = factura.rnc || '';
  document.getElementById('infoProveedor').value = factura.proveedor || '';
  document.getElementById('infoITBIS').value = factura.itbis || '';
  document.getElementById('infoTotal').value = factura.total_pagado || '';

  // Actualizar badge de confianza
  const badge = document.getElementById('confidenceBadge');
  document.getElementById('confidenceValue').textContent = confidence.toFixed(0);
  
  badge.className = 'confidence-badge ' + nivelClass;

  // Mostrar placeholder de imagen
  document.getElementById('imagePlaceholder').style.display = 'flex';
  document.getElementById('facturaImage').style.display = 'none';

  // Resetear zoom
  resetZoom();

  // Actualizar botones de navegación
  document.getElementById('btnAnterior').disabled = index === 0;
  document.getElementById('btnSiguiente').disabled = index === facturasActuales.length - 1;

  // Ocultar alerta al abrir
  document.getElementById('validationAlert').style.display = 'none';
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

// ============================================
// ZOOM DE IMAGEN
// ============================================

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

// ============================================
// MARCAR COMO LISTA (NO APROBAR)
// ============================================

async function marcarListaModal() {
  const factura = facturasActuales[currentFacturaIndex];
  
  const datosActualizados = {
    fecha_factura: document.getElementById('infoFecha').value || null,
    ncf: document.getElementById('infoNCF').value || null,
    rnc: document.getElementById('infoRNC').value || null,
    proveedor: document.getElementById('infoProveedor').value || null,
    itbis: document.getElementById('infoITBIS').value ? parseFloat(document.getElementById('infoITBIS').value) : null,
    total_pagado: document.getElementById('infoTotal').value ? parseFloat(document.getElementById('infoTotal').value) : null,
    estado: 'lista'  // CLAVE: Marcar como "lista", no "aprobada"
  };

  try {
    await fetchAPI(`/asistente/facturas/${factura.id}`, {
      method: 'PUT',
      body: JSON.stringify(datosActualizados)
    });

    showToast('✓ Factura marcada como lista', 'success');
    
    // Ir a siguiente o cerrar modal
    if (currentFacturaIndex < facturasActuales.length - 1) {
      navegarFactura('siguiente');
    } else {
      closeSplitModal();
    }
    
    // Recargar dashboard
    loadDashboard();
  } catch (error) {
    showToast('Error: ' + error.message, 'error');
  }
}

async function rechazarFactura() {
  const factura = facturasActuales[currentFacturaIndex];
  
  if (!confirm('¿Está seguro de rechazar esta factura? Se solicitará al usuario que envíe una nueva foto.')) {
    return;
  }

  try {
    await fetchAPI(`/asistente/facturas/${factura.id}`, {
      method: 'PUT',
      body: JSON.stringify({ estado: 'rechazada' })
    });

    showToast('Factura rechazada', 'success');
    
    // Ir a siguiente o cerrar modal
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

// ============================================
// APROBACIÓN EN LOTE
// ============================================

function mostrarConfirmacionLote() {
  const listas = facturasAgrupadas.listas || [];
  
  if (listas.length === 0) {
    showToast('No hay facturas listas para aprobar', 'warning');
    return;
  }

  // Calcular totales
  const totalMonto = listas.reduce((sum, f) => sum + (parseFloat(f.total_pagado) || 0), 0);
  
  // Agrupar por empresa
  const porEmpresa = {};
  listas.forEach(f => {
    const empresa = f.empresa_nombre || 'Sin empresa';
    if (!porEmpresa[empresa]) {
      porEmpresa[empresa] = {
        count: 0,
        monto: 0
      };
    }
    porEmpresa[empresa].count++;
    porEmpresa[empresa].monto += parseFloat(f.total_pagado) || 0;
  });

  // Actualizar modal
  document.getElementById('totalFacturasLote').textContent = listas.length;
  document.getElementById('totalMontoLote').textContent = formatCurrency(totalMonto);

  // Mostrar por empresa
  const resumenEmpresas = document.getElementById('resumenEmpresas');
  resumenEmpresas.innerHTML = Object.entries(porEmpresa)
    .map(([empresa, data]) => `
      <div class="resumen-empresa-item">
        <span><strong>${empresa}</strong></span>
        <span>${data.count} facturas - ${formatCurrency(data.monto)}</span>
      </div>
    `).join('');

  // Mostrar modal
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
      cerrarConfirmacionLote();
      loadDashboard();
    }
  } catch (error) {
    showToast('Error al aprobar lote: ' + error.message, 'error');
  }
}

// ============================================
// NAVEGACIÓN CON TECLADO
// ============================================

document.addEventListener('keydown', (e) => {
  const modal = document.getElementById('validacionModal');
  if (!modal.classList.contains('show')) return;

  if (e.key === 'ArrowRight') {
    navegarFactura('siguiente');
  } else if (e.key === 'ArrowLeft') {
    navegarFactura('anterior');
  } else if (e.key === 'Escape') {
    closeSplitModal();
  } else if (e.key === 'Enter' && e.ctrlKey) {
    // Ctrl + Enter = Marcar lista y siguiente
    marcarListaModal();
  }
});

function handleLogout() {
  clearAuth();
  window.location.href = '/';
}