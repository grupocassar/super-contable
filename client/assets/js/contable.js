let currentUser = null;
let empresas = [];
let asistentes = [];
let facturas = [];

// Variables para modal unificado
let currentFacturaIdInModal = null; 
let currentPlanInfo = null;

// ============================================
// VARIABLES PARA LUPA INTELIGENTE
// ============================================
let zoomLevelLupa = 3.5;
const MIN_ZOOM_LUPA = 2;
const MAX_ZOOM_LUPA = 8;
const ZOOM_STEP_LUPA = 0.5;

document.addEventListener('DOMContentLoaded', () => {
  if (!requireAuth()) return;

  currentUser = getUser();
  if (currentUser.role !== 'contable' && currentUser.role !== 'super_admin') {
    showToast('Acceso denegado', 'error');
    window.location.href = '/';
    return;
  }

  loadDashboard();

  document.getElementById('logoutBtn')?.addEventListener('click', handleLogout);
  document.getElementById('createEmpresaBtn')?.addEventListener('click', showCreateEmpresaModal);
  
  document.getElementById('empresaForm')?.addEventListener('submit', saveEmpresa);
  document.getElementById('asistenteForm')?.addEventListener('submit', saveAsistente);

  document.getElementById('filterEmpresa')?.addEventListener('change', applyDynamicFilters);
  document.getElementById('filterEstado')?.addEventListener('change', applyDynamicFilters);
  document.getElementById('filterSearch')?.addEventListener('input', applyDynamicFilters);
});

async function loadDashboard() {
  try {
    const [dashboardData, empresasData, facturasData, asistentesData, planData] = await Promise.all([
      fetchAPI('/contable/dashboard'),
      fetchAPI('/contable/empresas'),
      fetchAPI('/contable/facturas'),
      fetchAPI('/contable/asistentes'),
      fetchAPI('/contable/plan-consumo')
    ]);

    if (planData && planData.success) {
      currentPlanInfo = planData.data;
      mostrarWidgetConsumo(planData.data);
    }

    if (dashboardData.success) {
      displayStats(dashboardData.data.stats);
    }

    if (empresasData.success) {
      empresas = empresasData.data;
      displayEmpresas(empresas);
      populateCompanyFilter();
    }

    if (asistentesData.success) {
      asistentes = asistentesData.data;
      displayAsistentes(asistentes);
    }

    if (facturasData.success) {
      facturas = facturasData.data;
      if (window.location.pathname.includes('facturas.html')) {
        applyDynamicFilters(); 
      } else {
        renderFacturasTable(facturas.slice(0, 10)); 
      }
    }
  } catch (error) {
    console.error('Error en carga inicial:', error);
  }
}

function populateCompanyFilter() {
  const select = document.getElementById('filterEmpresa');
  if (!select) return;
  const currentSelection = select.value;
  select.innerHTML = '<option value="">Todas las empresas</option>';
  empresas.forEach(emp => {
    const opt = document.createElement('option');
    opt.value = emp.id;
    opt.textContent = emp.nombre;
    select.appendChild(opt);
  });
  select.value = currentSelection;
}

function applyDynamicFilters() {
  const empresaId = document.getElementById('filterEmpresa')?.value;
  const estado = document.getElementById('filterEstado')?.value;
  const searchText = document.getElementById('filterSearch')?.value?.toLowerCase();

  let filtradas = [...facturas];

  if (empresaId) filtradas = filtradas.filter(f => f.empresa_id == empresaId);
  
  if (estado) {
    if (estado === 'activas') {
      filtradas = filtradas.filter(f => f.estado !== 'exportada');
    } else if (estado === 'exportada') {
      filtradas = filtradas.filter(f => f.estado === 'exportada');
    } else {
      filtradas = filtradas.filter(f => f.estado === estado);
    }
  }

  if (searchText) {
    const term = searchText.trim().toLowerCase();
    filtradas = filtradas.filter(f => {
      const ncf = (f.ncf || "").toLowerCase();
      const proveedor = (f.proveedor || "").toLowerCase();
      const rnc = (f.rnc || "").toLowerCase();
      const id = (f.id || "").toString();
      return ncf.includes(term) || proveedor.includes(term) || rnc.includes(term) || id.includes(term);
    });
  }

  renderFacturasTable(filtradas);
}

function renderFacturasTable(lista) {
  const tbody = document.getElementById('facturasTableBody');
  if (!tbody) return;

  if (lista.length === 0) {
    tbody.innerHTML = '<tr><td colspan="10" class="text-center">No se encontraron facturas</td></tr>';
    return;
  }

  tbody.innerHTML = lista.map(f => {
    const fechaFormatted = f.fecha_factura ? f.fecha_factura.split('T')[0] : '';
    
    const notaColumn = f.notas && f.notas.trim() !== '' ? `
      <span class="nota-badge" 
            onclick="abrirModalFactura(${f.id})"
            title="Ver nota de asistente">
        💬
      </span>
    ` : '';

    return `
    <tr data-id="${f.id}">
      <td class="nota-column">${notaColumn}</td>
      <td class="text-center">
        <button class="btn-view-icon" 
                title="Ver Detalle Completo"
                onmouseenter="showImagePreview(${f.id}, '${f.archivo_url || f.drive_url}')" 
                onclick="abrirModalFactura(${f.id})">
          <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M1 12s4-8 11-8 11 8 11 8-4 8-11 8-11-8-11-8z"></path><circle cx="12" cy="12" r="3"></circle></svg>
        </button>
      </td>
      <td class="td-editable">
        <input type="date" class="cell-input" value="${fechaFormatted}" 
               onblur="saveField(${f.id}, 'fecha_factura', this.value)">
      </td>
      <td style="font-weight: 600; color: #1e293b; font-size: 12px; max-width: 150px; overflow: hidden; text-overflow: ellipsis; white-space: nowrap;">
        ${f.empresa_nombre || '-'}
      </td>
      <td class="td-editable">
        <input type="text" class="cell-input" style="font-family: monospace; font-size: 12px;" value="${f.rnc || ''}" 
               placeholder="RNC..."
               onblur="saveField(${f.id}, 'rnc', this.value)">
      </td>
      <td class="td-editable">
        <input type="text" class="cell-input" style="font-family: monospace; font-size: 12px;" value="${f.ncf || ''}" 
               placeholder="NCF..."
               onblur="saveField(${f.id}, 'ncf', this.value)">
      </td>
      <td class="td-editable">
        <input type="text" class="cell-input" value="${f.proveedor || ''}" 
               placeholder="Proveedor..."
               onblur="saveField(${f.id}, 'proveedor', this.value)">
      </td>
      <td class="td-editable">
        <input type="number" class="cell-input text-right" style="color: #64748b;" value="${f.itbis || 0}" 
               onblur="saveField(${f.id}, 'itbis', this.value)">
      </td>
      <td class="td-editable">
        <input type="number" class="cell-input text-right" style="font-weight: bold;" value="${f.total_pagado || 0}" 
               onblur="saveField(${f.id}, 'total_pagado', this.value)">
      </td>
      <td class="text-center">
        <span class="badge-status bg-${f.estado.toLowerCase()}">${f.estado.toUpperCase()}</span>
      </td>
    </tr>
  `}).join('');
}

// ============================================
// MODAL UNIFICADO CON LUPA INTELIGENTE
// ============================================

function abrirModalFactura(facturaId) {
  const factura = facturas.find(f => f.id === facturaId);
  if (!factura) return;

  currentFacturaIdInModal = facturaId;

  document.getElementById('facturaModalTitle').textContent = `Factura #${factura.id}`;
  document.getElementById('facturaEmpresa').textContent = factura.empresa_nombre || 'Sin empresa';
  
  const fechaFormatted = factura.fecha_factura ? factura.fecha_factura.split('T')[0] : '';
  document.getElementById('modalFechaInput').value = fechaFormatted;
  document.getElementById('modalRNCInput').value = factura.rnc || '';
  document.getElementById('modalNCFInput').value = factura.ncf || '';
  document.getElementById('modalProveedorInput').value = factura.proveedor || '';
  document.getElementById('modalITBISInput').value = factura.itbis || 0;
  document.getElementById('modalTotalInput').value = factura.total_pagado || 0;

  const imgEl = document.getElementById('facturaImage');
  const placeholderEl = document.getElementById('facturaImagePlaceholder');
  
  let facturaUrl = factura.archivo_url || factura.drive_url;
  if (facturaUrl && facturaUrl.includes('drive.google.com') && facturaUrl.includes('id=')) {
      const fileId = facturaUrl.split('id=')[1];
      facturaUrl = `https://drive.google.com/thumbnail?id=${fileId}&sz=w1000`;
  }

  if (imgEl && placeholderEl) {
    if (facturaUrl) {
        imgEl.src = facturaUrl;
        imgEl.style.display = 'block';
        placeholderEl.style.display = 'none';
        
        // ✅ SOLUCIÓN: Verificar si imagen ya está cargada (caché) o esperar carga
        if (imgEl.complete && imgEl.naturalWidth > 0) {
          // Imagen ya cargada (caché)
          setTimeout(() => {
            inicializarLupaFactura();
            crearIndicadorZoom();
          }, 100);
        } else {
          // Imagen cargando por primera vez
          imgEl.onload = function() {
            setTimeout(() => {
              inicializarLupaFactura();
              crearIndicadorZoom();
            }, 100);
          };
        }
    } else {
        imgEl.style.display = 'none';
        placeholderEl.style.display = 'flex';
    }
  }

  const notaAsistenteContainer = document.getElementById('notaAsistenteContainer');
  const notaAsistenteContenido = document.getElementById('notaAsistenteContenido');
  
  if (factura.notas && factura.notas.trim() !== '') {
    notaAsistenteContenido.textContent = factura.notas;
    notaAsistenteContainer.style.display = 'block';
  } else {
    notaAsistenteContainer.style.display = 'none';
  }

  const btnAprobar = document.getElementById('btnAprobarFactura');
  const btnRechazar = document.getElementById('btnRechazarFactura');

  if (btnAprobar) {
    btnAprobar.onclick = () => actualizarEstadoFactura(factura.id, 'aprobada');
  }
  
  if (btnRechazar) {
    btnRechazar.onclick = () => actualizarEstadoFactura(factura.id, 'rechazada');
  }

  document.getElementById('facturaModal').classList.add('show');
  
  // Reset zoom inicial
  zoomLevelLupa = 3.5;
}

function cerrarModalFactura() {
  document.getElementById('facturaModal').classList.remove('show');
  zoomLevelLupa = 3.5;
  currentFacturaIdInModal = null;
  
  // Limpiar lupa e indicador
  const lupa = document.getElementById('lupaFacturaLens');
  const indicador = document.getElementById('zoomIndicador');
  const hint = document.getElementById('lupaHintFactura');
  if (lupa) lupa.remove();
  if (indicador) indicador.remove();
  if (hint) hint.remove();
}

// ============================================
// SISTEMA DE LUPA INTELIGENTE
// ============================================

function inicializarLupaFactura() {
  const container = document.getElementById('imageContainerFactura');
  const img = document.getElementById('facturaImage');
  
  if (!container || !img) {
    console.warn('❌ Container o imagen no encontrados');
    return;
  }
  
  // Verificar que imagen esté cargada
  if (!img.complete || img.naturalWidth === 0) {
    console.warn('⏳ Imagen aún no cargada completamente');
    return;
  }
  
  console.log('🔍 Inicializando lupa inteligente...');
  
  // Crear lupa si no existe
  let lupa = document.getElementById('lupaFacturaLens');
  if (!lupa) {
    lupa = document.createElement('div');
    lupa.id = 'lupaFacturaLens';
    lupa.style.cssText = `
      position: absolute;
      border: 4px solid #3b82f6;
      border-radius: 50%;
      width: 180px;
      height: 180px;
      pointer-events: none;
      background-repeat: no-repeat;
      box-shadow: 0 8px 24px rgba(0, 0, 0, 0.6),
                  inset 0 0 0 2px rgba(255, 255, 255, 0.2);
      display: none;
      z-index: 100;
    `;
    container.appendChild(lupa);
  }
  
  // Crear hint visual si no existe
  let hint = document.getElementById('lupaHintFactura');
  if (!hint) {
    hint = document.createElement('div');
    hint.id = 'lupaHintFactura';
    hint.style.cssText = `
      position: absolute;
      bottom: 10px;
      left: 50%;
      transform: translateX(-50%);
      background: rgba(59, 130, 246, 0.95);
      color: white;
      padding: 6px 12px;
      border-radius: 6px;
      font-size: 0.75rem;
      font-weight: 600;
      pointer-events: none;
      z-index: 101;
      display: none;
      white-space: nowrap;
    `;
    hint.textContent = '🔍 Scroll para ajustar zoom';
    container.appendChild(hint);
  }
  
  // Event listeners
  container.addEventListener('mouseenter', function() {
    lupa.style.display = 'block';
    hint.style.display = 'block';
    setTimeout(() => { hint.style.display = 'none'; }, 2000);
  });
  
  container.addEventListener('mouseleave', function() {
    lupa.style.display = 'none';
  });
  
  container.addEventListener('mousemove', function(e) {
    const containerRect = container.getBoundingClientRect();
    const imgRect = img.getBoundingClientRect();
    
    const mouseX = e.clientX - containerRect.left;
    const mouseY = e.clientY - containerRect.top;
    
    lupa.style.left = (mouseX - 90) + 'px';
    lupa.style.top = (mouseY - 90) + 'px';
    
    const imgX = e.clientX - imgRect.left;
    const imgY = e.clientY - imgRect.top;
    
    const imgWidth = img.clientWidth;
    const imgHeight = img.clientHeight;
    
    const percentX = (imgX / imgWidth) * 100;
    const percentY = (imgY / imgHeight) * 100;
    
    lupa.style.backgroundImage = `url('${img.src}')`;
    lupa.style.backgroundSize = `${imgWidth * zoomLevelLupa}px ${imgHeight * zoomLevelLupa}px`;
    
    const bgPosX = -((percentX / 100) * imgWidth * zoomLevelLupa - 90);
    const bgPosY = -((percentY / 100) * imgHeight * zoomLevelLupa - 90);
    
    lupa.style.backgroundPosition = `${bgPosX}px ${bgPosY}px`;
  });
  
  container.addEventListener('wheel', function(e) {
    e.preventDefault();
    
    if (e.deltaY < 0) {
      zoomLevelLupa = Math.min(zoomLevelLupa + ZOOM_STEP_LUPA, MAX_ZOOM_LUPA);
    } else {
      zoomLevelLupa = Math.max(zoomLevelLupa - ZOOM_STEP_LUPA, MIN_ZOOM_LUPA);
    }
    
    actualizarIndicadorZoom();
    
    hint.style.display = 'block';
    hint.textContent = `🔍 Zoom: ${zoomLevelLupa.toFixed(1)}x`;
    setTimeout(() => { hint.style.display = 'none'; }, 1000);
  }, { passive: false });
  
  container.addEventListener('dblclick', function() {
    zoomLevelLupa = 3.5;
    actualizarIndicadorZoom();
    
    hint.style.display = 'block';
    hint.textContent = '↺ Zoom reseteado a 3.5x';
    setTimeout(() => { hint.style.display = 'none'; }, 1500);
  });
  
  console.log('✅ Lupa inicializada correctamente');
}

function crearIndicadorZoom() {
  let indicador = document.getElementById('zoomIndicador');
  if (!indicador) {
    indicador = document.createElement('div');
    indicador.id = 'zoomIndicador';
    indicador.style.cssText = `
      position: absolute;
      top: 10px;
      right: 10px;
      background: rgba(30, 41, 59, 0.9);
      color: white;
      padding: 8px 14px;
      border-radius: 8px;
      font-size: 0.85rem;
      font-weight: 700;
      z-index: 102;
      box-shadow: 0 4px 12px rgba(0, 0, 0, 0.3);
      border: 1px solid rgba(59, 130, 246, 0.5);
    `;
    
    const container = document.getElementById('imageContainerFactura');
    if (container) container.appendChild(indicador);
  }
  
  actualizarIndicadorZoom();
}

function actualizarIndicadorZoom() {
  const indicador = document.getElementById('zoomIndicador');
  if (indicador) {
    indicador.textContent = `🔍 Zoom: ${zoomLevelLupa.toFixed(1)}x`;
  }
}

// ============================================
// FUNCIONES AUXILIARES MODAL
// ============================================

async function eliminarFacturaActual() {
  if (!currentFacturaIdInModal) return;

  if (!confirm('⚠️ ¿Estás seguro de eliminar esta factura permanentemente?\n\nEsta acción no se puede deshacer.')) {
    return;
  }

  try {
    const response = await fetchAPI(`/contable/facturas/${currentFacturaIdInModal}`, {
      method: 'DELETE'
    });

    if (response.success) {
      showToast('🗑️ Factura eliminada', 'success');
      facturas = facturas.filter(f => f.id !== currentFacturaIdInModal);
      cerrarModalFactura();
      
      if (window.location.pathname.includes('facturas.html')) {
        applyDynamicFilters();
      } else {
        loadDashboard();
      }
    }
  } catch (error) {
    showToast('Error al eliminar factura', 'error');
  }
}

async function saveFieldFromModal(field, value) {
  if (!currentFacturaIdInModal) return;
  
  const factura = facturas.find(f => f.id === currentFacturaIdInModal);
  if (factura && factura[field] == value) return;

  try {
    const response = await fetchAPI(`/contable/facturas/${currentFacturaIdInModal}`, {
      method: 'PUT',
      body: JSON.stringify({ [field]: value })
    });

    if (response.success) {
      if (factura) factura[field] = value;
      showToast('✓ Guardado', 'success');
      
      if (window.location.pathname.includes('facturas.html')) {
         applyDynamicFilters(); 
      } else {
          loadDashboard();
      }
    }
  } catch (error) {
    showToast('Error al guardar', 'error');
  }
}

async function actualizarEstadoFactura(facturaId, nuevoEstado) {
  try {
    const response = await fetchAPI(`/contable/facturas/${facturaId}`, {
      method: 'PUT',
      body: JSON.stringify({ estado: nuevoEstado })
    });

    if (response.success) {
      showToast(`Factura ${nuevoEstado}`, 'success');
      
      const f = facturas.find(x => x.id === facturaId);
      if (f) f.estado = nuevoEstado;

      cerrarModalFactura();
      
      if (window.location.pathname.includes('facturas.html')) {
          applyDynamicFilters();
      } else {
          loadDashboard();
      }
    }
  } catch (error) {
    showToast('Error al actualizar estado', 'error');
  }
}

// ============================================
// GUARDADO DE CAMPOS
// ============================================

async function saveField(facturaId, field, value) {
  const factura = facturas.find(f => f.id === facturaId);
  if (factura && factura[field] == value) return; 

  try {
    const response = await fetchAPI(`/contable/facturas/${facturaId}`, {
      method: 'PUT',
      body: JSON.stringify({ [field]: value })
    });

    if (response.success) {
      if (factura) factura[field] = value;
      showToast('✓ Guardado', 'success');
    }
  } catch (error) {
    showToast('Error al guardar', 'error');
    loadDashboard(); 
  }
}

function showImagePreview(id, url) {
    if (!url || url === 'undefined' || url === 'null') return;

    if (url.includes('drive.google.com') && url.includes('id=')) {
        const fileId = url.split('id=')[1];
        url = `https://drive.google.com/thumbnail?id=${fileId}&sz=w400`;
    }

    let preview = document.getElementById('hover-preview-container');
    if (!preview) {
        preview = document.createElement('div');
        preview.id = 'hover-preview-container';
        preview.style.cssText = `
            position: fixed;
            right: 30px;
            top: 50%;
            transform: translateY(-50%);
            width: 420px;
            background: white;
            box-shadow: 0 15px 45px rgba(0,0,0,0.4);
            border-radius: 12px;
            z-index: 10000;
            padding: 15px;
            border: 1px solid #e2e8f0;
            pointer-events: none;
            display: none;
        `;
        document.body.appendChild(preview);
    }

    preview.innerHTML = `
        <div style="font-size: 11px; font-weight: bold; color: #64748b; margin-bottom: 8px; border-bottom: 1px solid #f1f5f9; padding-bottom: 5px; text-transform: uppercase;">
            Vista Rápida - Factura #${id}
        </div>
        <img src="${url}" style="width:100%; border-radius:8px; display: block;">
    `;
    preview.style.display = 'block';

    const row = document.querySelector(`tr[data-id="${id}"]`);
    if (row) {
        row.onmouseleave = () => {
            preview.style.display = 'none';
        };
    }
}

// ==========================================
// GESTIÓN DE PLANES
// ==========================================

function mostrarWidgetConsumo(datos) {
  const container = document.getElementById('plan-consumo-widget');
  if (!container) return;

  const { plan, limite_facturas, zona_gracia, facturas_procesadas, porcentaje, estado_alerta } = datos;

  const colorBarra = {
    'normal': '#10b981', 'advertencia': '#f59e0b', 'critico': '#ef4444', 'bloqueado': '#991b1b'
  }[estado_alerta.nivel] || '#10b981';

  container.innerHTML = `
    <div class="plan-consumo-card">
      <div class="plan-header">
        <div>
          <h3 id="widgetPlanNombre">${plan}</h3>
          <p class="plan-precio" style="font-size: 0.8rem; color: var(--text-secondary)">Suscripción Activa</p>
        </div>
        <span class="badge-${estado_alerta.nivel}">${estado_alerta.mensaje}</span>
      </div>
      
      <div class="consumo-info">
        <div class="consumo-numeros">
          <span class="consumo-actual">${facturas_procesadas.toLocaleString()}</span>
          <span class="consumo-separador">/</span>
          <span class="consumo-limite">${limite_facturas.toLocaleString()}</span>
          <span class="consumo-label">facturas</span>
        </div>
        
        <div class="barra-progreso">
          <div class="barra-progreso-fill" style="width: ${Math.min(porcentaje, 100)}%; background-color: ${colorBarra}"></div>
        </div>
        
        <div style="margin-top: 1.25rem;">
            <button onclick="verPlanes()" class="btn btn-sm btn-primary w-full" style="justify-content: center; font-weight: 600;">
                Gestionar Plan / Ver Mejoras
            </button>
        </div>
      </div>
    </div>
  `;
}

function verPlanes() {
    if (!currentPlanInfo) return;
    const planActual = currentPlanInfo.plan;

    const planes = [
        {
            id: 'STARTER',
            nombre: 'Starter',
            emoji: '🥉',
            precio: 135,
            facturas: 800,
            gracia: 50,
            features: ['1 Usuario Asistente', 'OCR IA Estándar', 'Exportación 606'],
            color: '#64748b'
        },
        {
            id: 'PROFESSIONAL',
            nombre: 'Professional',
            emoji: '🥈',
            precio: 195,
            facturas: 1500,
            gracia: 100,
            features: ['Usuarios Ilimitados', 'SLA 99% Uptime', 'Dashboard Real-time', 'Soporte Prioritario'],
            color: '#3b82f6',
            recomendado: true
        },
        {
            id: 'BUSINESS',
            nombre: 'Business',
            emoji: '🥇',
            precio: 450,
            facturas: 6000,
            gracia: 500,
            features: ['Soporte 24/7 Dedicado', 'Consultoría Mensual', 'Reportes Custom', 'API Access'],
            color: '#f59e0b'
        }
    ];

    const modalHtml = `
        <div id="planesModal" style="position: fixed; inset: 0; background: rgba(15, 23, 42, 0.8); display: flex; align-items: center; justify-content: center; z-index: 10000; backdrop-filter: blur(4px);" onclick="this.remove()">
            <div style="background: #f8fafc; padding: 2.5rem; border-radius: 1.5rem; max-width: 900px; width: 95%; max-height: 90vh; overflow-y: auto; box-shadow: 0 25px 50px -12px rgba(0,0,0,0.5);" onclick="event.stopPropagation()">
                
                <div style="text-align: center; margin-bottom: 2.5rem;">
                    <h2 style="font-size: 2rem; font-weight: 800; color: #1e293b; margin: 0;">Gestión de Suscripción</h2>
                    <p style="color: #64748b; margin-top: 0.5rem;">Potencia tu firma contable con los planes de Super Contable.</p>
                </div>

                <div style="display: grid; grid-template-columns: repeat(auto-fit, minmax(260px, 1fr)); gap: 1.5rem;">
                    ${planes.map(p => {
                        const esActual = p.id === planActual;
                        const idxActual = planes.findIndex(x => x.id === planActual);
                        const idxP = planes.findIndex(x => x.id === p.id);
                        const esUpgrade = idxP > idxActual;
                        
                        return `
                        <div style="background: white; border: 2px solid ${esActual ? p.color : '#e2e8f0'}; border-radius: 1.25rem; padding: 2rem; display: flex; flex-direction: column; position: relative; ${p.recomendado ? 'box-shadow: 0 10px 25px -5px rgba(59, 130, 246, 0.1);' : ''}">
                            ${p.recomendado ? `<span style="position: absolute; top: -12px; left: 50%; transform: translateX(-50%); background: #3b82f6; color: white; padding: 4px 12px; border-radius: 20px; font-size: 0.7rem; font-weight: bold; text-transform: uppercase;">Más popular</span>` : ''}
                            
                            <div style="margin-bottom: 1.5rem;">
                                <span style="font-size: 2rem;">${p.emoji}</span>
                                <h3 style="font-size: 1.25rem; font-weight: 700; color: #1e293b; margin-top: 0.5rem;">${p.nombre}</h3>
                                <div style="display: flex; align-items: baseline; margin-top: 0.5rem;">
                                    <span style="font-size: 2rem; font-weight: 800; color: #1e293b;">$${p.precio}</span>
                                    <span style="color: #64748b; margin-left: 0.25rem;">/mes</span>
                                </div>
                            </div>

                            <div style="background: #f1f5f9; padding: 1rem; border-radius: 0.75rem; margin-bottom: 1.5rem;">
                                <div style="font-weight: 700; color: #1e293b;">${p.facturas.toLocaleString()} facturas</div>
                                <div style="font-size: 0.8rem; color: #64748b;">+${p.gracia} zona de gracia</div>
                            </div>

                            <ul style="list-style: none; padding: 0; margin: 0 0 2rem 0; flex-grow: 1;">
                                ${p.features.map(f => `
                                    <li style="display: flex; gap: 0.5rem; font-size: 0.875rem; color: #475569; margin-bottom: 0.75rem;">
                                        <span style="color: ${p.color}">✓</span> ${f}
                                    </li>
                                `).join('')}
                            </ul>

                            ${esActual ? `
                                <button disabled style="width: 100%; padding: 0.85rem; border-radius: 0.75rem; border: 2px solid #e2e8f0; background: #f8fafc; color: #94a3b8; font-weight: 700; cursor: not-allowed;">
                                    Plan Actual
                                </button>
                            ` : esUpgrade ? `
                                <button onclick="ejecutarSolicitudCambio('${p.id}', '${p.nombre}', true)" style="width: 100%; padding: 0.85rem; border-radius: 0.75rem; border: none; background: ${p.color}; color: white; font-weight: 700; cursor: pointer; transition: transform 0.2s;" onmouseover="this.style.transform='scale(1.02)'" onmouseout="this.style.transform='scale(1)'">
                                    Solicitar Upgrade
                                </button>
                            ` : `
                                <button onclick="ejecutarSolicitudCambio('${p.id}', '${p.nombre}', false)" style="width: 100%; padding: 0.85rem; border-radius: 0.75rem; border: 1px solid #e2e8f0; background: white; color: #64748b; font-size: 0.85rem; font-weight: 600; cursor: pointer;">
                                    Solicitar Cambio
                                </button>
                            `}
                        </div>
                        `;
                    }).join('')}
                </div>

                <div style="margin-top: 2rem; text-align: center;">
                    <button onclick="document.getElementById('planesModal').remove()" style="color: #64748b; background: none; border: none; cursor: pointer; font-size: 0.9rem; text-decoration: underline;">Cerrar ventana</button>
                </div>
            </div>
        </div>
    `;
    document.body.insertAdjacentHTML('beforeend', modalHtml);
}

async function ejecutarSolicitudCambio(planId, planNombre, esUpgrade) {
    const tipoAccion = esUpgrade ? 'Upgrade' : 'Cambio';
    const verboAccion = esUpgrade ? 'mejorar al plan' : 'solicitar el cambio al plan';
    
    if (!confirm(`¿Confirmas que deseas ${verboAccion} ${planNombre}?\n\nUn administrador validará la solicitud y se activarán los nuevos límites de inmediato.`)) return;

    const mensajeSistema = `Solicitud de ${tipoAccion} al plan ${planNombre} gestionada desde la matriz profesional de planes.`;

    try {
        const response = await fetchAPI('/contable/solicitar-upgrade', {
            method: 'POST',
            body: JSON.stringify({ 
                plan_solicitado: planId,
                mensaje: mensajeSistema
            })
        });
        
        if (response.success) {
            showToast(`Solicitud de ${tipoAccion} enviada correctamente`, 'success');
            document.getElementById('planesModal')?.remove();
            
            const subject = encodeURIComponent(`Solicitud de ${tipoAccion}: Plan ${planNombre}`);
            const body = encodeURIComponent(`Hola, acabo de solicitar formalmente un ${tipoAccion} al plan ${planNombre} desde mi panel de control. Por favor, procedan con la aprobación.`);
            window.location.href = `mailto:soporte@supercontable.com?subject=${subject}&body=${body}`;
        }
    } catch (error) {
        showToast(error.message, 'error');
    }
}

// ==========================================
// FUNCIONES DE ESTADÍSTICAS Y MANTENIMIENTO
// ==========================================

function displayStats(stats) {
  safeUpdate('totalEmpresas', stats.total_empresas || 0);
  safeUpdate('totalAsistentes', stats.total_asistentes || 0);
  safeUpdate('facturasPendientes', stats.facturas?.pendientes || 0);
  safeUpdate('facturasAprobadas', stats.facturas?.aprobadas || 0);
}

function displayEmpresas(lista) {
  const tbody = document.getElementById('empresasTableBody');
  if (!tbody) return;
  tbody.innerHTML = lista.map(empresa => `
    <tr>
      <td><strong>${empresa.nombre}</strong><br><small>${empresa.codigo_corto}</small></td>
      <td>${empresa.rnc || '-'}</td>
      <td>${empresa.stats?.listas || 0}</td>
      <td><span class="badge ${empresa.activa !== false ? 'badge-success' : 'badge-danger'}">${empresa.activa !== false ? 'Activa' : 'Inactiva'}</span></td>
      <td><button class="btn btn-sm btn-outline-primary" onclick="editEmpresa(${empresa.id})">Editar</button></td>
    </tr>
  `).join('');
}

function displayAsistentes(lista) {
  const tbody = document.getElementById('asistentesTableBody');
  if (!tbody) return;
  if (lista.length === 0) {
    tbody.innerHTML = '<tr><td colspan="3" class="text-center">No hay asistentes registrados</td></tr>';
    return;
  }
  tbody.innerHTML = lista.map(asistente => `
    <tr>
      <td><strong>${asistente.nombre_completo}</strong></td>
      <td>${asistente.email}</td>
      <td>
        <div class="actions">
          <button class="btn btn-sm btn-outline-primary" onclick="editAsistente(${asistente.id})">Editar</button>
          <button class="btn btn-sm btn-primary" onclick="showAssignModal(${asistente.id}, '${asistente.nombre_completo}')">Asignar</button>
        </div>
      </td>
    </tr>
  `).join('');
}

function showCreateEmpresaModal() {
  const modal = document.getElementById('empresaModal');
  if (modal) {
    document.getElementById('empresaForm')?.reset();
    document.getElementById('empresaId').value = '';
    safeUpdate('modalTitle', 'Crear Empresa');
    modal.classList.add('show');
  }
}

async function saveEmpresa(e) {
  e.preventDefault();
  const id = document.getElementById('empresaId').value;
  const formData = { nombre: document.getElementById('empresaNombre').value, rnc: document.getElementById('empresaRNC').value };
  try {
    const method = id ? 'PUT' : 'POST';
    const url = id ? `/contable/empresas/${id}` : '/contable/empresas';
    await fetchAPI(url, { method, body: JSON.stringify(formData) });
    showToast('Empresa guardada', 'success');
    closeModal('empresaModal');
    loadDashboard();
  } catch (error) { showToast(error.message, 'error'); }
}

async function editEmpresa(id) {
  const empresa = empresas.find(e => e.id === id);
  if (!empresa) return;
  const modal = document.getElementById('empresaModal');
  if (!modal) return;
  document.getElementById('empresaId').value = id;
  safeUpdate('modalTitle', 'Editar Empresa');
  document.getElementById('empresaNombre').value = empresa.nombre;
  document.getElementById('empresaRNC').value = empresa.rnc || '';
  modal.classList.add('show');
}

function showCreateAsistenteModal() {
  const modal = document.getElementById('asistenteModal');
  if (modal) {
    document.getElementById('asistenteForm')?.reset();
    document.getElementById('asistenteId').value = '';
    safeUpdate('asistenteModalTitle', 'Nuevo Asistente');
    modal.classList.add('show');
  }
}

async function saveAsistente(e) {
  e.preventDefault();
  const id = document.getElementById('asistenteId').value;
  const formData = {
    nombre_completo: document.getElementById('asistenteNombre').value,
    email: document.getElementById('asistenteEmail').value,
    password: document.getElementById('asistentePassword').value
  };
  try {
    const method = id ? 'PUT' : 'POST';
    const url = id ? `/contable/asistentes/${id}` : '/contable/asistentes';
    await fetchAPI(url, { method, body: JSON.stringify(formData) });
    showToast(id ? 'Asistente actualizado' : 'Asistente creado', 'success');
    closeModal('asistenteModal');
    loadDashboard();
  } catch (error) { showToast(error.message, 'error'); }
}

function editAsistente(id) {
  const asistente = asistentes.find(a => a.id === id);
  if (!asistente) return;
  const modal = document.getElementById('asistenteModal');
  if (!modal) return;
  document.getElementById('asistenteId').value = asistente.id;
  safeUpdate('asistenteModalTitle', 'Editar Asistente');
  document.getElementById('asistenteNombre').value = asistente.nombre_completo;
  document.getElementById('asistenteEmail').value = asistente.email;
  document.getElementById('asistentePassword').required = false;
  modal.classList.add('show');
}

async function showAssignModal(asistenteId, nombre) {
  const modal = document.getElementById('assignModal');
  const listContainer = document.getElementById('companiesCheckboxList');
  if (!modal || !listContainer) return;
  document.getElementById('assignAsistenteId').value = asistenteId;
  safeUpdate('assignModalSub', `Asignar empresas a ${nombre}`);
  try {
    const response = await fetchAPI(`/contable/asistentes/${asistenteId}/empresas`);
    const asignadasIds = response.success ? response.data : [];
    listContainer.innerHTML = empresas.map(emp => `
      <label class="checkbox-item">
        <input type="checkbox" name="empresaCheck" value="${emp.id}" ${asignadasIds.includes(emp.id) ? 'checked' : ''}>
        <span>${emp.nombre}</span>
      </label>
    `).join('');
    modal.classList.add('show');
  } catch (error) { showToast(error.message, 'error'); }
}

async function saveAsignaciones() {
  const asistenteId = document.getElementById('assignAsistenteId').value;
  const checkboxes = document.querySelectorAll('input[name="empresaCheck"]:checked');
  const empresasIds = Array.from(checkboxes).map(cb => parseInt(cb.value));
  try {
    await fetchAPI(`/contable/asistentes/${asistenteId}/empresas`, { method: 'POST', body: JSON.stringify({ empresasIds }) });
    showToast('Asignaciones guardadas', 'success');
    closeModal('assignModal');
  } catch (error) { showToast(error.message, 'error'); }
}

function safeUpdate(id, value) {
  const el = document.getElementById(id);
  if (el) el.textContent = value;
}

function closeModal(id) {
  const modal = document.getElementById(id);
  if (modal) modal.classList.remove('show');
}

function handleLogout() {
  clearAuth();
  window.location.href = '/';
}