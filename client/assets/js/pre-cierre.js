/**
 * LÓGICA DE PRE-CIERRE FISCAL 606 - SUPER CONTABLE
 * Alineado con el "Gran Cambio" (Estructura 23 columnas + Gemini AI)
 * UPDATE: Sistema de columnas expandibles (14 base + 10 avanzadas)
 * UPDATE: Formato DGII 606 - Fecha atomizada (Periodo YYYYMM + Día DD)
 * UPDATE: Exportación con formato DGII 606 nativo
 */

let currentUser = null;
let facturas = [];
let facturasFiltradas = [];
let empresas = [];
let estadoActual = 'aprobada';
let columnasAvanzadasVisibles = false;

// ============================================
// CONSTANTES Y CONFIGURACIÓN
// ============================================

const CATEGORIAS_GASTO = [
  { value: '', label: '-- Seleccionar Tipo de Gasto --' },
  { value: '01', label: '01 - Gastos de personal' },
  { value: '02', label: '02 - Gastos por trabajos, suministros y servicios' },
  { value: '03', label: '03 - Arrendamientos' },
  { value: '04', label: '04 - Gastos de activos fijos' },
  { value: '05', label: '05 - Gastos de representación' },
  { value: '06', label: '06 - Otras deducciones admitidas' },
  { value: '07', label: '07 - Gastos financieros' },
  { value: '08', label: '08 - Gastos extraordinarios' },
  { value: '09', label: '09 - Compras y gastos que formarán parte del costo de venta' },
  { value: '10', label: '10 - Adquisiciones de activos' },
  { value: '11', label: '11 - Gastos de seguros' }
];

const FORMAS_PAGO = [
  { value: '', label: '-- Seleccionar --' },
  { value: '01', label: '01 - Efectivo' },
  { value: '02', label: '02 - Cheque' },
  { value: '03', label: '03 - Transferencia' },
  { value: '04', label: '04 - Tarjeta Crédito' },
  { value: '05', label: '05 - Tarjeta Débito' },
  { value: '06', label: '06 - Crédito' },
  { value: '07', label: '07 - Otros' }
];

const TIPOS_RETENCION_ISR = [
  { value: '', label: '-- Seleccionar --' },
  { value: '01', label: '01 - Alquileres' },
  { value: '02', label: '02 - Honorarios' },
  { value: '03', label: '03 - Otras rentas' },
  { value: '04', label: '04 - Rentas presuntas' },
  { value: '05', label: '05 - Intereses' },
  { value: '06', label: '06 - Premios' },
  { value: '07', label: '07 - Dividendos' }
];

// ============================================
// AUXILIARES
// ============================================

function formatCurrency(value) {
    return new Intl.NumberFormat('es-DO', { style: 'currency', currency: 'DOP' }).format(value || 0);
}

function safeSetText(id, text) {
    const el = document.getElementById(id);
    if (el) el.textContent = text;
}

function formatDateDDMMYYYY(isoDate) {
  if (!isoDate) return '';
  const parts = isoDate.split('-');
  if (parts.length !== 3) return isoDate; 
  return `${parts[2]}/${parts[1]}/${parts[0]}`;
}

// ========== FUNCIONES DGII 606 - FORMATO ATOMIZADO ==========

/**
 * Convierte fecha ISO a formato Periodo DGII (YYYYMM)
 * @param {string} isoDate - Fecha en formato ISO: "2025-07-16"
 * @returns {string} - Periodo: "202507"
 */
function formatPeriodo(isoDate) {
  if (!isoDate) return '';
  const parts = isoDate.split('-');
  if (parts.length !== 3) return '';
  return `${parts[0]}${parts[1]}`; // YYYYMM
}

/**
 * Convierte fecha ISO a formato Día DGII (DD)
 * @param {string} isoDate - Fecha en formato ISO: "2025-07-16"
 * @returns {string} - Día: "16"
 */
function formatDia(isoDate) {
  if (!isoDate) return '';
  const parts = isoDate.split('-');
  if (parts.length !== 3) return '';
  return parts[2]; // DD
}

/**
 * Reconstruye fecha ISO desde componentes DGII
 * @param {string} periodo - Periodo en formato YYYYMM: "202507"
 * @param {string} dia - Día en formato DD: "16"
 * @returns {string} - Fecha ISO: "2025-07-16"
 */
function reconstruirFechaISO(periodo, dia) {
  if (!periodo || !dia) return '';
  
  // Validar formato periodo (6 dígitos)
  if (!/^\d{6}$/.test(periodo)) return '';
  
  // Validar formato día (2 dígitos)
  if (!/^\d{2}$/.test(dia)) return '';
  
  const year = periodo.substring(0, 4);   // "2025"
  const month = periodo.substring(4, 6);  // "07"
  
  // Validar rangos
  const monthNum = parseInt(month, 10);
  const dayNum = parseInt(dia, 10);
  
  if (monthNum < 1 || monthNum > 12) return '';
  if (dayNum < 1 || dayNum > 31) return '';
  
  return `${year}-${month}-${dia}`; // "2025-07-16"
}

// ============================================
// INICIALIZACIÓN
// ============================================

document.addEventListener('DOMContentLoaded', () => {
  if (typeof requireAuth === 'function' && !requireAuth()) return;

  currentUser = typeof getUser === 'function' ? getUser() : null;
  if (!currentUser) {
      try { currentUser = JSON.parse(localStorage.getItem('user')); } catch(e){}
  }

  if (!currentUser || (currentUser.role !== 'contable' && currentUser.role !== 'super_admin')) {
    if(typeof showToast === 'function') showToast('Acceso denegado: Rol no autorizado', 'error');
    else alert('Acceso denegado');
    window.location.href = '/';
    return;
  }

  loadPreCierre();

  document.getElementById('logoutBtn')?.addEventListener('click', handleLogout);
  document.getElementById('periodoMes')?.addEventListener('change', recargarDatos);
  document.getElementById('periodoAnio')?.addEventListener('change', recargarDatos);

  const checkConfirm = document.getElementById('checkConfirmTodas');
  if (checkConfirm) {
      checkConfirm.addEventListener('change', function() {
        const btn = document.getElementById('btnConfirmarTodas');
        if(btn) btn.disabled = !this.checked;
      });
  }
  
  if(currentUser.email) safeSetText('userName', currentUser.email.split('@')[0].toUpperCase());
});

function showCompanyTooltip(e, name) {
    let tooltip = document.getElementById('company-name-tooltip');
    if (!tooltip) {
        tooltip = document.createElement('div');
        tooltip.id = 'company-name-tooltip';
        tooltip.className = 'company-tooltip';
        document.body.appendChild(tooltip);
    }
    tooltip.textContent = `Empresa: ${name}`;
    tooltip.classList.add('show');

    const rect = e.target.getBoundingClientRect();
    tooltip.style.left = `${rect.left + rect.width / 2}px`;
    tooltip.style.top = `${rect.top - 35}px`;
    tooltip.style.transform = 'translateX(-50%)';
}

function hideCompanyTooltip() {
    const tooltip = document.getElementById('company-name-tooltip');
    if (tooltip) tooltip.classList.remove('show');
}

async function recargarDatos() {
  await loadPreCierre();
}

// ============================================
// GESTIÓN DE VISTAS (PENDIENTES vs HISTÓRICO)
// ============================================

function cambiarVista(nuevoEstado) {
  estadoActual = nuevoEstado;
  
  const btnPendientes = document.getElementById('btnViewPendientes');
  const btnHistorico = document.getElementById('btnViewHistorico');
  const divExportar = document.getElementById('exportButtonsContainer');
  
  if (estadoActual === 'aprobada') {
    btnPendientes.classList.add('active');
    if(btnHistorico) btnHistorico.classList.remove('active');
    if(divExportar) divExportar.style.display = 'flex';
  } else {
    if(btnHistorico) btnHistorico.classList.add('active');
    btnPendientes.classList.remove('active');
    if(divExportar) divExportar.style.display = 'none';
  }

  loadPreCierre();
}

// ============================================
// TOGGLE COLUMNAS AVANZADAS
// ============================================

function toggleColumnasAvanzadas() {
  columnasAvanzadasVisibles = !columnasAvanzadasVisibles;
  
  const colsHeader = document.querySelectorAll('th.col-avanzado');
  const colsBody = document.querySelectorAll('td.col-avanzado');
  const icon = document.getElementById('toggleIcon');
  
  colsHeader.forEach(col => {
    col.style.display = columnasAvanzadasVisibles ? 'table-cell' : 'none';
  });
  
  colsBody.forEach(col => {
    col.style.display = columnasAvanzadasVisibles ? 'table-cell' : 'none';
  });
  
  if (icon) icon.textContent = columnasAvanzadasVisibles ? '◀️' : '▶️';
}

// ============================================
// CARGA DE DATOS
// ============================================

async function loadPreCierre() {
  try {
    const [empresasData, facturasData] = await Promise.all([
      fetchAPI('/contable/empresas'),
      fetchAPI(`/contable/facturas?estado=${estadoActual}`)
    ]);

    if (empresasData.success) {
      empresas = empresasData.data;
      llenarFiltroEmpresas();
    }

    if (facturasData.success) {
      facturas = facturasData.data;
      facturasFiltradas = [...facturas];
      
      aplicarFiltros(); 
      updateStatusBar();
      
      if (estadoActual === 'aprobada') {
        setTimeout(procesarSugerenciasMasivas, 1000);
      }
    }
  } catch (error) {
    console.error('Error cargando datos:', error);
    if(typeof showToast === 'function') showToast('Error de conexión con el servidor', 'error');
  }
}

// ============================================
// LÓGICA DE FILTRADO
// ============================================

function llenarFiltroEmpresas() {
  const select = document.getElementById('filterEmpresa');
  if (!select) return;
  const valorActual = select.value;
  select.innerHTML = '<option value="">Todas</option>';
  empresas.forEach(emp => {
    const option = document.createElement('option');
    option.value = emp.nombre;
    option.textContent = emp.nombre;
    select.appendChild(option);
  });
  select.value = valorActual;
}

function aplicarFiltros() {
  const fEmpresa = document.getElementById('filterEmpresa').value.toLowerCase();
  const fRNC = document.getElementById('filterRNC').value.toLowerCase();
  const fTipo = document.getElementById('filterTipo').value;
  const fNCF = document.getElementById('filterNCF').value.toLowerCase();
  const fProv = document.getElementById('filterProveedor').value.toLowerCase();
  const fGasto = document.getElementById('filterGasto').value;
  const fPago = document.getElementById('filterPago').value;

  facturasFiltradas = facturas.filter(f => {
    if (fEmpresa && !(f.empresa_nombre || '').toLowerCase().includes(fEmpresa)) return false;
    if (fRNC && !(f.rnc || '').toLowerCase().includes(fRNC)) return false;
    
    if (fTipo) {
        const rncLen = (f.rnc || '').replace(/-/g, '').length;
        if (fTipo === '1' && rncLen !== 9) return false;
        if (fTipo === '2' && rncLen !== 11) return false;
    }

    if (fNCF && !(f.ncf || '').toLowerCase().includes(fNCF)) return false;
    if (fProv && !(f.proveedor || '').toLowerCase().includes(fProv)) return false;
    
    if (fGasto) {
      if (fGasto === 'VACIO') { if (f.tipo_gasto) return false; }
      else if (f.tipo_gasto !== fGasto) return false;
    }
    
    if (fPago) {
      if (fPago === 'VACIO') { if (f.forma_pago) return false; }
      else if (f.forma_pago !== fPago) return false;
    }

    return true;
  });

  renderTabla();
}

// ============================================
// RENDERIZADO DE TABLA
// ============================================

function renderTabla() {
  const tbody = document.getElementById('preCierreTableBody');
  if (!tbody) return;

  if (facturasFiltradas.length === 0) {
    const msg = estadoActual === 'aprobada' ? 'No hay facturas pendientes' : 'No hay facturas en el histórico';
    const totalCols = columnasAvanzadasVisibles ? 26 : 16;
    tbody.innerHTML = `<tr><td colspan="${totalCols}" class="text-center" style="padding: 2rem; color: #64748b;">${msg}</td></tr>`;
    return;
  }

  const isReadOnly = estadoActual === 'exportada';
  const disabledAttr = isReadOnly ? 'disabled' : '';
  const inputClass = isReadOnly ? 'cell-input readonly' : 'cell-input';
  const displayStyle = columnasAvanzadasVisibles ? 'table-cell' : 'none';

  tbody.innerHTML = facturasFiltradas.map(f => {
    // Extraer componentes de fecha para formato DGII
    const periodo = formatPeriodo(f.fecha_factura);
    const dia = formatDia(f.fecha_factura);
    
    let tipoIdDisplay = '?';
    const rncClean = (f.rnc || '').replace(/-/g, '');
    if (rncClean.length === 9) tipoIdDisplay = '1';
    else if (rncClean.length === 11) tipoIdDisplay = '2';
    
    const anomalia = isReadOnly ? null : getAnomalia(f);
    const rowClass = anomalia ? `anomalia-${anomalia.tipo}` : (isReadOnly ? 'fila-historico' : '');

    let iconoHTML = '';
    if (!isReadOnly && anomalia) {
      if (anomalia.tipo === 'duplicado') {
        iconoHTML = `<span class="anomalia-clickeable" onclick="abrirComparacionDuplicados('${f.ncf}')" title="Ver duplicados">${anomalia.icono}</span>`;
      } else if (anomalia.tipo === 'sospechosa') {
        iconoHTML = `<span class="anomalia-clickeable" onclick="abrirComparacionSospechosas(${f.id})" title="Ver sospechosa">${anomalia.icono}</span>`;
      } else if (anomalia.tipo === 'fuera-periodo') {
        iconoHTML = `<span class="anomalia-clickeable" onclick="gestionarFueraDePeriodo(${f.id})" title="Sacar de este cierre">${anomalia.icono}</span>`;
      } else {
        iconoHTML = anomalia.icono;
      }
    } else if (isReadOnly) {
      iconoHTML = '<span title="Factura Archivada" style="opacity:0.5">🔒</span>';
    }

    const montoITBIS = f.itbis_facturado !== undefined ? f.itbis_facturado : (f.itbis || 0);

    return `
      <tr data-id="${f.id}" class="${rowClass}">
        <!-- ANOMALÍAS -->
        <td class="text-center">${iconoHTML}</td>
        
        <!-- RNC O CÉDULA -->
        <td onmouseenter="showCompanyTooltip(event, '${f.empresa_nombre || 'N/A'}')" onmouseleave="hideCompanyTooltip()">
          <input type="text" class="${inputClass}" value="${f.rnc || ''}" ${disabledAttr}
                 placeholder="XXX-XXXXX-X" onblur="saveField(${f.id}, 'rnc', this.value)">
        </td>
        
        <!-- TIPO ID -->
        <td class="text-center">
          <span class="badge-tipo-id">${tipoIdDisplay}</span>
        </td>
        
        <!-- TIPO DE GASTO (MOVIDO A POSICIÓN 3) -->
        <td class="td-select">
          <select class="cell-select select-tipo-gasto" data-factura-id="${f.id}" ${disabledAttr}
                  onchange="saveField(${f.id}, 'tipo_gasto', this.value)">
            ${CATEGORIAS_GASTO.map(cat => `<option value="${cat.value}" ${f.tipo_gasto === cat.value ? 'selected' : ''}>${cat.label}</option>`).join('')}
          </select>
        </td>
        
        <!-- NCF -->
        <td>
          <input type="text" class="${inputClass}" value="${f.ncf || ''}" ${disabledAttr}
                 onblur="saveNCFField(${f.id}, this.value)">
        </td>
        
        <!-- NCF MODIFICADO (AVANZADO) -->
        <td class="col-avanzado" style="display: ${displayStyle};">
          <input type="text" class="${inputClass}" value="${f.ncf_modificado || ''}" ${disabledAttr}
                 onblur="saveField(${f.id}, 'ncf_modificado', this.value)">
        </td>
        
        <!-- PERIODO (YYYYMM) - NUEVO -->
        <td>
          <input type="text" class="${inputClass}" value="${periodo}" ${disabledAttr}
                 placeholder="202412" maxlength="6" pattern="[0-9]{6}"
                 onblur="saveDateFieldAtomized(${f.id}, this.value, 'periodo')">
        </td>
        
        <!-- DÍA (DD) - NUEVO -->
        <td>
          <input type="text" class="${inputClass}" value="${dia}" ${disabledAttr}
                 placeholder="16" maxlength="2" pattern="[0-9]{2}"
                 onblur="saveDateFieldAtomized(${f.id}, this.value, 'dia')">
        </td>
        
        <!-- PROVEEDOR -->
        <td>
          <input type="text" class="${inputClass}" value="${f.proveedor || ''}" ${disabledAttr}
                 onblur="saveField(${f.id}, 'proveedor', this.value)">
        </td>
        
        <!-- MONTO SERVICIOS -->
        <td class="text-right">
          <input type="number" class="${inputClass} text-right" value="${f.monto_servicios || 0}" ${disabledAttr}
                 step="0.01" onblur="saveField(${f.id}, 'monto_servicios', this.value)">
        </td>
        
        <!-- MONTO BIENES -->
        <td class="text-right">
          <input type="number" class="${inputClass} text-right" value="${f.monto_bienes || 0}" ${disabledAttr}
                 step="0.01" onblur="saveField(${f.id}, 'monto_bienes', this.value)">
        </td>
        
        <!-- TOTAL FACTURADO (MOVIDO A POSICIÓN 11) -->
        <td class="text-right">
          <input type="number" class="cell-input text-right" value="${f.total_pagado || 0}" ${disabledAttr}
                 step="0.01" style="font-weight: 600;" onblur="saveField(${f.id}, 'total_pagado', this.value)">
        </td>
        
        <!-- ITBIS FACTURADO -->
        <td class="text-right">
          <input type="number" class="${inputClass} text-right" value="${montoITBIS}" ${disabledAttr}
                 step="0.01" onblur="saveField(${f.id}, 'itbis_facturado', this.value)">
        </td>
        
        <!-- ITBIS RETENIDO -->
        <td class="text-right">
          <input type="number" class="${inputClass} text-right" value="${f.itbis_retenido || 0}" ${disabledAttr}
                 step="0.01" onblur="saveField(${f.id}, 'itbis_retenido', this.value)">
        </td>
        
        <!-- RETENCIÓN ISR -->
        <td class="text-right">
          <input type="number" class="${inputClass} text-right" value="${f.monto_retencion_isr || 0}" ${disabledAttr}
                 step="0.01" onblur="saveField(${f.id}, 'monto_retencion_isr', this.value)">
        </td>
        
        <!-- FORMA DE PAGO -->
        <td class="td-select">
          <select class="cell-select" ${disabledAttr} onchange="saveField(${f.id}, 'forma_pago', this.value)">
            ${FORMAS_PAGO.map(fp => `<option value="${fp.value}" ${f.forma_pago === fp.value ? 'selected' : ''}>${fp.label}</option>`).join('')}
          </select>
        </td>
        
        <!-- ========== COLUMNAS AVANZADAS (RESTO) ========== -->
        <td class="col-avanzado text-right" style="display: ${displayStyle};">
          <input type="number" class="${inputClass} text-right" value="${f.itbis_proporcionalidad || 0}" ${disabledAttr}
                 step="0.01" onblur="saveField(${f.id}, 'itbis_proporcionalidad', this.value)">
        </td>
        <td class="col-avanzado text-right" style="display: ${displayStyle};">
          <input type="number" class="${inputClass} text-right" value="${f.itbis_costo || 0}" ${disabledAttr}
                 step="0.01" onblur="saveField(${f.id}, 'itbis_costo', this.value)">
        </td>
        <td class="col-avanzado text-right" style="display: ${displayStyle};">
          <input type="number" class="${inputClass} text-right" value="${f.itbis_adelantar || 0}" ${disabledAttr}
                 step="0.01" onblur="saveField(${f.id}, 'itbis_adelantar', this.value)">
        </td>
        <td class="col-avanzado text-right" style="display: ${displayStyle};">
          <input type="number" class="${inputClass} text-right" value="${f.itbis_percibido || 0}" ${disabledAttr}
                 step="0.01" onblur="saveField(${f.id}, 'itbis_percibido', this.value)">
        </td>
        <td class="col-avanzado" style="display: ${displayStyle};">
          <select class="cell-select" ${disabledAttr} onchange="saveField(${f.id}, 'tipo_retencion_isr', this.value)">
            ${TIPOS_RETENCION_ISR.map(t => `<option value="${t.value}" ${f.tipo_retencion_isr === t.value ? 'selected' : ''}>${t.label}</option>`).join('')}
          </select>
        </td>
        <td class="col-avanzado text-right" style="display: ${displayStyle};">
          <input type="number" class="${inputClass} text-right" value="${f.isr_percibido || 0}" ${disabledAttr}
                 step="0.01" onblur="saveField(${f.id}, 'isr_percibido', this.value)">
        </td>
        <td class="col-avanzado text-right" style="display: ${displayStyle};">
          <input type="number" class="${inputClass} text-right" value="${f.impuesto_selectivo || 0}" ${disabledAttr}
                 step="0.01" onblur="saveField(${f.id}, 'impuesto_selectivo', this.value)">
        </td>
        <td class="col-avanzado text-right" style="display: ${displayStyle};">
          <input type="number" class="${inputClass} text-right" value="${f.otros_impuestos || 0}" ${disabledAttr}
                 step="0.01" onblur="saveField(${f.id}, 'otros_impuestos', this.value)">
        </td>
        <td class="col-avanzado text-right" style="display: ${displayStyle};">
          <input type="number" class="${inputClass} text-right" value="${f.propina_legal || 0}" ${disabledAttr}
                 step="0.01" onblur="saveField(${f.id}, 'propina_legal', this.value)">
        </td>
      </tr>
    `;
  }).join('');
}

// ============================================
// GESTIÓN DE FECHAS / PERÍODOS
// ============================================

async function gestionarFueraDePeriodo(id) {
  const confirmacion = confirm("⚠️ Esta factura está fuera del período seleccionado.\n\n¿Deseas devolverla a 'Pendientes'?");
  if (confirmacion) {
    try {
      const response = await fetchAPI(`/contable/facturas/${id}`, { method: 'PUT', body: JSON.stringify({ estado: 'pending' }) });
      if (response.success) {
        facturas = facturas.filter(f => f.id !== id);
        aplicarFiltros();
        updateStatusBar();
        if(typeof showToast === 'function') showToast('↩️ Devuelta a Pendientes', 'success');
      }
    } catch (e) { if(typeof showToast === 'function') showToast('Error al procesar', 'error'); }
  }
}

// ============================================
// MEMORIA CONTABLE
// ============================================

async function aplicarMemoriaContable(facturaId, proveedor) {
  if (estadoActual === 'exportada') return; 
  if (!proveedor || proveedor.trim() === '') return false;
  const select = document.querySelector(`.select-tipo-gasto[data-factura-id="${facturaId}"]`);
  if (!select || select.value !== '') return false;

  try {
    const response = await fetchAPI(`/contable/facturas/sugerencia-gasto?proveedor=${encodeURIComponent(proveedor)}`);
    if (response.success && response.data) {
      const sugerencia = response.data.tipo_gasto;
      if (CATEGORIAS_GASTO.some(c => c.value === sugerencia)) {
        select.value = sugerencia;
        select.classList.add('sugerencia-activa');
        await saveField(facturaId, 'tipo_gasto', sugerencia, false);
        if(typeof showToast === 'function') showToast('✨ Clasificación sugerida aplicada', 'info');
        return true;
      }
    }
  } catch (error) { console.error('Error Memoria Contable:', error); }
  return false;
}

async function procesarSugerenciasMasivas() {
  if (estadoActual === 'exportada') return;
  const facturasSinGasto = facturas.filter(f => !f.tipo_gasto && f.proveedor);
  for (const f of facturasSinGasto) {
    await aplicarMemoriaContable(f.id, f.proveedor);
  }
}

// ============================================
// AUXILIAR: URL VISIBLE DE IMAGEN (DRIVE)
// ============================================
function getVisibleImageUrl(url) {
    if (!url) return '/assets/img/no-image.png';
    if (url.includes('drive.google.com') && url.includes('id=')) {
        const fileId = url.split('id=')[1].split('&')[0];
        return `https://drive.google.com/thumbnail?id=${fileId}&sz=w1000`;
    }
    return url;
}

// ============================================
// MODALES
// ============================================

function abrirComparacionDuplicados(ncf) {
    const duplicadas = facturas.filter(f => f.ncf === ncf && f.ncf && !f.revisada);
    if (duplicadas.length < 2) return;
    
    const f1 = duplicadas[0];
    const f2 = duplicadas[1];
    
    safeSetText('duplicadoNCF', ncf);

    safeSetText('factura1Title', `FACTURA #${f1.id}`);
    safeSetText('factura1Fecha', formatDateDDMMYYYY(f1.fecha_factura));
    safeSetText('factura1NCF', f1.ncf || '-');
    safeSetText('factura1Proveedor', f1.proveedor || '-');
    safeSetText('factura1Total', formatCurrency(f1.total_pagado));
    const img1 = document.getElementById('factura1Imagen');
    if (img1) img1.src = getVisibleImageUrl(f1.archivo_url || f1.drive_url);
    
    safeSetText('factura2Title', `FACTURA #${f2.id}`);
    safeSetText('factura2Fecha', formatDateDDMMYYYY(f2.fecha_factura));
    safeSetText('factura2NCF', f2.ncf || '-');
    safeSetText('factura2Proveedor', f2.proveedor || '-');
    safeSetText('factura2Total', formatCurrency(f2.total_pagado));
    const img2 = document.getElementById('factura2Imagen');
    if (img2) img2.src = getVisibleImageUrl(f2.archivo_url || f2.drive_url);

    const btnE1 = document.getElementById('btnEliminar1');
    if (btnE1) btnE1.onclick = () => eliminarFacturaDuplicada(f1.id);
    const btnE2 = document.getElementById('btnEliminar2');
    if (btnE2) btnE2.onclick = () => eliminarFacturaDuplicada(f2.id);

    document.getElementById('duplicadosModal').classList.add('show');
}

function cerrarModalDuplicados() { document.getElementById('duplicadosModal').classList.remove('show'); }

async function mantenerAmbasDuplicadas() {
  const title1 = document.getElementById('factura1Title').textContent;
  const title2 = document.getElementById('factura2Title').textContent;
  const id1 = title1.match(/#(\d+)/)[1];
  const id2 = title2.match(/#(\d+)/)[1];
  try {
    await Promise.all([
      fetchAPI(`/contable/facturas/${id1}`, { method: 'PUT', body: JSON.stringify({ revisada: 1 }) }),
      fetchAPI(`/contable/facturas/${id2}`, { method: 'PUT', body: JSON.stringify({ revisada: 1 }) })
    ]);
    const f1 = facturas.find(x => x.id == id1); if(f1) f1.revisada = 1;
    const f2 = facturas.find(x => x.id == id2); if(f2) f2.revisada = 1;
    if(typeof showToast === 'function') showToast('✓ Marcadas como revisadas', 'success');
    cerrarModalDuplicados();
    aplicarFiltros();
    updateStatusBar();
  } catch (e) { if(typeof showToast === 'function') showToast('Error al procesar', 'error'); }
}

async function eliminarFacturaDuplicada(id) {
  if (!confirm('¿Eliminar esta factura?')) return;
  try {
    const res = await fetchAPI(`/contable/facturas/${id}`, { method: 'DELETE' });
    if (res.success) {
      facturas = facturas.filter(f => f.id !== id);
      if(typeof showToast === 'function') showToast('✓ Eliminada', 'success');
      cerrarModalDuplicados();
      aplicarFiltros();
      updateStatusBar();
    }
  } catch (e) { if(typeof showToast === 'function') showToast('Error al eliminar', 'error'); }
}

function abrirComparacionSospechosas(id) {
    const f1 = facturas.find(f => f.id === id);
    if (!f1) return;
    const f2 = facturas.find(f => f.id !== f1.id && f.proveedor === f1.proveedor && f.total_pagado === f1.total_pagado && f.fecha_factura === f1.fecha_factura && f.ncf !== f1.ncf && !f.revisada);
    if (!f2) { if(typeof showToast === 'function') showToast('No se encontró relación sospechosa', 'info'); return; }

    safeSetText('sospechosa1Title', `FACTURA #${f1.id}`);
    safeSetText('sospechosa1NCF', f1.ncf || '-');
    safeSetText('sospechosa1Fecha', formatDateDDMMYYYY(f1.fecha_factura));
    safeSetText('sospechosa1Proveedor', f1.proveedor || '-');
    safeSetText('sospechosa1Total', formatCurrency(f1.total_pagado));
    const imgS1 = document.getElementById('sospechosa1Imagen');
    if (imgS1) imgS1.src = getVisibleImageUrl(f1.archivo_url || f1.drive_url);

    safeSetText('sospechosa2Title', `FACTURA #${f2.id}`);
    safeSetText('sospechosa2NCF', f2.ncf || '-');
    safeSetText('sospechosa2Fecha', formatDateDDMMYYYY(f2.fecha_factura));
    safeSetText('sospechosa2Proveedor', f2.proveedor || '-');
    safeSetText('sospechosa2Total', formatCurrency(f2.total_pagado));
    const imgS2 = document.getElementById('sospechosa2Imagen');
    if (imgS2) imgS2.src = getVisibleImageUrl(f2.archivo_url || f2.drive_url);

    document.getElementById('btnEliminarSosp1').onclick = () => eliminarFacturaSospechosa(f1.id);
    document.getElementById('btnEliminarSosp2').onclick = () => eliminarFacturaSospechosa(f2.id);
    document.getElementById('sospechosasModal').classList.add('show');
}

function cerrarModalSospechosas() { document.getElementById('sospechosasModal').classList.remove('show'); }

async function eliminarFacturaSospechosa(id) {
  if (!confirm('¿Eliminar esta factura?')) return;
  try {
    const res = await fetchAPI(`/contable/facturas/${id}`, { method: 'DELETE' });
    if (res.success) {
      facturas = facturas.filter(f => f.id !== id);
      if(typeof showToast === 'function') showToast('✓ Eliminada', 'success');
      cerrarModalSospechosas();
      aplicarFiltros();
      updateStatusBar();
    }
  } catch (e) { if(typeof showToast === 'function') showToast('Error', 'error'); }
}

async function mantenerAmbas() {
  const id1 = document.getElementById('sospechosa1Title').textContent.match(/#(\d+)/)[1];
  const id2 = document.getElementById('sospechosa2Title').textContent.match(/#(\d+)/)[1];
  try {
    await Promise.all([
      fetchAPI(`/contable/facturas/${id1}`, { method: 'PUT', body: JSON.stringify({ revisada: 1 }) }),
      fetchAPI(`/contable/facturas/${id2}`, { method: 'PUT', body: JSON.stringify({ revisada: 1 }) })
    ]);
    const f1 = facturas.find(x => x.id == id1); if(f1) f1.revisada = 1;
    const f2 = facturas.find(x => x.id == id2); if(f2) f2.revisada = 1;
    if(typeof showToast === 'function') showToast('✓ Revisadas', 'success');
    cerrarModalSospechosas();
    aplicarFiltros();
    updateStatusBar();
  } catch (e) { if(typeof showToast === 'function') showToast('Error al procesar', 'error'); }
}

// ============================================
// FUNCIONES DE GUARDADO
// ============================================

async function saveDateField(id, val) {
  if (!val || val.trim() === '') return;
  const p = val.split('/');
  if (p.length !== 3) { if(typeof showToast === 'function') showToast('Formato DD/MM/YYYY', 'error'); return; }
  await saveField(id, 'fecha_factura', `${p[2]}-${p[1]}-${p[0]}`);
}

async function saveNCFField(id, val) {
  await saveField(id, 'ncf', val);
}

/**
 * Guarda cambios en campos de fecha atomizados (Periodo o Día)
 * @param {number} facturaId - ID de la factura
 * @param {string} valor - Valor del campo editado
 * @param {string} tipo - 'periodo' o 'dia'
 */
async function saveDateFieldAtomized(facturaId, valor, tipo) {
  if (estadoActual === 'exportada') return;
  if (!valor || valor.trim() === '') return;

  // Obtener factura actual
  const factura = facturas.find(f => f.id === facturaId);
  if (!factura) return;

  // Obtener componentes actuales
  let periodoActual = formatPeriodo(factura.fecha_factura);
  let diaActual = formatDia(factura.fecha_factura);

  // Actualizar el componente modificado
  if (tipo === 'periodo') {
    periodoActual = valor.trim();
  } else if (tipo === 'dia') {
    diaActual = valor.trim();
  }

  // Reconstruir fecha ISO
  const fechaISO = reconstruirFechaISO(periodoActual, diaActual);

  if (!fechaISO) {
    if(typeof showToast === 'function') showToast('Formato inválido (Periodo: YYYYMM, Día: DD)', 'error');
    return;
  }

  // Guardar en BD
  await saveField(facturaId, 'fecha_factura', fechaISO);
}

async function saveField(facturaId, field, value, refrescar = true) {
  if (estadoActual === 'exportada') return; 

  try {
    const updates = { [field]: value };
    if (['ncf', 'rnc', 'fecha_factura', 'proveedor', 'total_pagado'].includes(field)) {
      updates.revisada = 0;
    }

    const response = await fetchAPI(`/contable/facturas/${facturaId}`, {
      method: 'PUT',
      body: JSON.stringify(updates)
    });

    if (response.success) {
      const fIndex = facturas.findIndex(f => f.id === facturaId);
      if (fIndex !== -1) {
        facturas[fIndex][field] = value;
        if (updates.revisada !== undefined) facturas[fIndex].revisada = 0;
      }
      if (field === 'proveedor') aplicarMemoriaContable(facturaId, value);
      if (refrescar) {
        if(typeof showToast === 'function') showToast('✓ Guardado', 'success');
        aplicarFiltros();
        updateStatusBar();
      }
    }
  } catch (error) { if(typeof showToast === 'function') showToast('Error al guardar', 'error'); }
}

// ============================================
// ANOMALÍAS
// ============================================

function getTipoNCF(ncf) {
  if (!ncf) return '--';
  const pre = ncf.substring(0, 3).toUpperCase();
  const t = { 'B01': 'B01', 'B02': 'B02', 'B11': 'B11', 'B14': 'B14', 'B15': 'B15', 'B16': 'B16' };
  return t[pre] || ncf.substring(0, 3);
}

function validarRNC(rnc) {
  if (!rnc) return false;
  const s = rnc.replace(/-/g, '');
  return s.length === 9 || s.length === 11;
}

function getAnomalia(f) {
  const pMes = document.getElementById('periodoMes')?.value;
  const pAnio = document.getElementById('periodoAnio')?.value;
  
  if (f.fecha_factura && pMes && pAnio) {
    const dateStr = String(f.fecha_factura);
    const year = dateStr.substring(0, 4);
    const month = dateStr.substring(5, 7);
    if (year !== pAnio || month !== pMes) return { tipo: 'fuera-periodo', icono: '🟠' };
  }
  
  if (f.rnc && !validarRNC(f.rnc)) return { tipo: 'rnc-invalido', icono: '🔶' };
  if (f.revisada) return null;
  
  const dups = facturas.filter(x => x.ncf === f.ncf && x.ncf && !x.revisada);
  if (dups.length > 1) return { tipo: 'duplicado', icono: '🔴' };
  
  const sosp = facturas.filter(x => x.id !== f.id && x.proveedor === f.proveedor && x.total_pagado === f.total_pagado && x.fecha_factura === f.fecha_factura && x.ncf !== f1.ncf && !x.revisada);
  if (sosp.length > 0) return { tipo: 'sospechosa', icono: '🟡' };
  
  const itbisVal = f.itbis_facturado !== undefined ? f.itbis_facturado : f.itbis;
  if (f.ncf?.startsWith('B01') && (!itbisVal || itbisVal == 0)) return { tipo: 'itbis', icono: '🧾' };
  
  if (!f.tipo_gasto || !f.forma_pago) return { tipo: 'sin-clasificar', icono: '⚠️' };
  
  return null;
}

function updateStatusBar() {
  const total = facturas.length;
  if (estadoActual === 'exportada') {
    safeSetText('statusTotal', `${total} facturas archivadas`);
    safeSetText('statusOK', 0);
    ['countDuplicados', 'countSospechosas', 'countITBIS', 'countSinClasificar', 'countFueraPeriodo', 'countRNCInvalido'].forEach(id => {
          const el = document.getElementById(id);
          if(el && el.parentElement) el.parentElement.style.display = 'none';
    });
    return;
  }
  
  const dups = new Set(facturas.filter(f => getAnomalia(f)?.tipo === 'duplicado').map(f => f.ncf)).size;
  const sosp = facturas.filter(f => getAnomalia(f)?.tipo === 'sospechosa').length;
  const itbis = facturas.filter(f => getAnomalia(f)?.tipo === 'itbis').length;
  const sin = facturas.filter(f => getAnomalia(f)?.tipo === 'sin-clasificar').length;
  const fuera = facturas.filter(f => getAnomalia(f)?.tipo === 'fuera-periodo').length;
  const rnc = facturas.filter(f => getAnomalia(f)?.tipo === 'rnc-invalido').length;
  const ok = total - (dups * 2) - sosp - itbis - sin - fuera - rnc;
  
  safeSetText('statusTotal', `${total} facturas`);
  safeSetText('statusOK', Math.max(0, ok));
  
  const updateBarItem = (countId, statusId, count) => {
    const el = document.getElementById(statusId);
    if (el) {
      if (count > 0) { 
          safeSetText(countId, count); 
          el.style.display = 'flex'; 
      }
      else el.style.display = 'none';
    }
  };
  updateBarItem('countDuplicados', 'statusDuplicados', dups);
  updateBarItem('countSospechosas', 'statusSospechosas', sosp);
  updateBarItem('countITBIS', 'statusITBIS', itbis);
  updateBarItem('countSinClasificar', 'statusSinClasificar', sin);
  updateBarItem('countFueraPeriodo', 'statusFueraPeriodo', fuera);
  updateBarItem('countRNCInvalido', 'statusRNCInvalido', rnc);
}

// ============================================
// EXPORTACIÓN
// ============================================

function abrirModalConfirmTodas() {
    const count = facturasFiltradas.length;
    safeSetText('todasFacturasCount', count);
    const modal = document.getElementById('confirmTodasModal');
    if(modal) modal.style.display = 'flex';
}

function cerrarModalConfirmTodas() {
    const modal = document.getElementById('confirmTodasModal');
    if(modal) modal.style.display = 'none';
}

async function confirmarExportTodas() {
    cerrarModalConfirmTodas();
    const paquete = prepararDatosParaExportar();
    if (!paquete) return;

    if (document.getElementById('btnExportarSheets').style.display !== 'none') {
        await ejecutarExportacionSheets();
    } else {
        await ejecutarExportacion();
    }
}

function abrirModalExportar(modo = 'csv') {
  const modal = document.getElementById('exportModal');
  const select = document.getElementById('exportEmpresaSelect');
  const btnCSV = document.getElementById('btnExportarCSV');
  const btnSheets = document.getElementById('btnExportarSheets');
  
  if(btnCSV) btnCSV.style.display = 'none';
  if(btnSheets) btnSheets.style.display = 'none';

  if (modo === 'sheets') {
    if(btnSheets) btnSheets.style.display = 'block';
  } else {
    if(btnCSV) btnCSV.style.display = 'block';
  }
  
  select.innerHTML = '<option value="TODAS">📦 Todas las Empresas (Archivo Unificado)</option>';
  empresas.forEach(emp => {
    const opt = document.createElement('option');
    opt.value = emp.nombre;
    opt.textContent = emp.nombre;
    select.appendChild(opt);
  });
  
  renderColumnCheckboxes(modo);
  modal.classList.add('show');
}

function renderColumnCheckboxes(modo) {
    const empresaSelect = document.getElementById('exportEmpresaSelect').value;
    const grid = document.querySelector('.columns-grid');
    const showEmpresaCol = (empresaSelect === 'TODAS');
    
    const isSheets = (modo === 'sheets');
    const attr = (def) => isSheets ? 'checked disabled' : (def ? 'checked' : '');
    
    let html = `
        <div style="grid-column: span 2; border-bottom:1px solid #eee; padding-bottom:5px; margin-bottom:5px; font-weight:bold; color:#2563eb;">--- DATOS GENERALES ---</div>
        `;
    if (showEmpresaCol) { html += `<label><input type="checkbox" ${attr(true)} value="empresa_nombre"> Empresa</label>`; }
    
    html += `
        <label><input type="checkbox" ${attr(true)} value="rnc"> RNC o Cédula</label>
        <label><input type="checkbox" ${attr(true)} value="tipo_id"> Tipo Id</label>
        <label><input type="checkbox" ${attr(true)} value="tipo_gasto"> Tipo de Gasto</label>
        <label><input type="checkbox" ${attr(true)} value="ncf"> NCF</label>
        <label><input type="checkbox" ${attr(true)} value="ncf_modificado"> NCF Modificado</label>
        <label><input type="checkbox" ${attr(true)} value="periodo"> Periodo (YYYYMM)</label>
        <label><input type="checkbox" ${attr(true)} value="dia"> Día (DD)</label>
        <label><input type="checkbox" ${attr(true)} value="proveedor"> Proveedor</label>
        
        <div style="grid-column: span 2; border-bottom:1px solid #eee; padding-bottom:5px; margin-bottom:5px; margin-top:10px; font-weight:bold; color:#2563eb;">--- MONTOS Y BIENES ---</div>
        <label><input type="checkbox" ${attr(true)} value="monto_servicios"> Monto Servicios</label>
        <label><input type="checkbox" ${attr(true)} value="monto_bienes"> Monto Bienes</label>
        <label><input type="checkbox" ${attr(true)} value="total_pagado"> Total Facturado</label>
        
        <div style="grid-column: span 2; border-bottom:1px solid #eee; padding-bottom:5px; margin-bottom:5px; margin-top:10px; font-weight:bold; color:#2563eb;">--- ITBIS ---</div>
        <label><input type="checkbox" ${attr(true)} value="itbis_facturado"> ITBIS Facturado</label>
        <label><input type="checkbox" ${attr(false)} value="itbis_retenido"> ITBIS Retenido</label>
        <label><input type="checkbox" ${attr(false)} value="itbis_proporcionalidad"> ITBIS Proporcionalidad</label>
        <label><input type="checkbox" ${attr(false)} value="itbis_costo"> ITBIS Costo</label>
        <label><input type="checkbox" ${attr(false)} value="itbis_adelantar"> ITBIS Adelantar</label>
        <label><input type="checkbox" ${attr(false)} value="itbis_percibido"> ITBIS Percibido</label>
        
        <div style="grid-column: span 2; border-bottom:1px solid #eee; padding-bottom:5px; margin-bottom:5px; margin-top:10px; font-weight:bold; color:#2563eb;">--- RETENCIONES E IMPUESTOS ---</div>
        <label><input type="checkbox" ${attr(false)} value="tipo_retencion_isr"> Tipo Retención ISR</label>
        <label><input type="checkbox" ${attr(false)} value="monto_retencion_isr"> Retención ISR</label>
        <label><input type="checkbox" ${attr(false)} value="isr_percibido"> ISR Percibido</label>
        <label><input type="checkbox" ${attr(false)} value="impuesto_selectivo"> Impuesto Selectivo</label>
        <label><input type="checkbox" ${attr(false)} value="otros_impuestos"> Otros Impuestos</label>
        <label><input type="checkbox" ${attr(false)} value="propina_legal"> Propina Legal</label>
        
        <div style="grid-column: span 2; border-bottom:1px solid #eee; padding-bottom:5px; margin-bottom:5px; margin-top:10px; font-weight:bold; color:#2563eb;">--- CLASIFICACIÓN ---</div>
        <label><input type="checkbox" ${attr(true)} value="forma_pago"> Forma de Pago</label>
        
        <label><input type="checkbox" value="drive_url"> Link Factura</label>
    `;
    grid.innerHTML = html;
}

function cerrarModalExportar() {
  document.getElementById('exportModal').classList.remove('show');
}

function prepararDatosParaExportar() {
  const empresaSeleccionada = document.getElementById('exportEmpresaSelect').value;
  const checkboxes = document.querySelectorAll('.columns-grid input[type="checkbox"]:checked');
  const columnasActivas = Array.from(checkboxes).map(cb => cb.value);

  if (columnasActivas.length === 0) { if(typeof showToast === 'function') showToast('Selecciona columnas', 'error'); return null; }

  let datos = facturasFiltradas;
  if (empresaSeleccionada !== 'TODAS') {
    datos = facturas.filter(f => f.empresa_nombre === empresaSeleccionada);
    const idxEmpresa = columnasActivas.indexOf('empresa_nombre');
    if (idxEmpresa > -1) columnasActivas.splice(idxEmpresa, 1);
  }

  if (datos.length === 0) { if(typeof showToast === 'function') showToast('No hay datos', 'error'); return null; }

  const datosProcesados = datos.map(f => {
    const filaProcesada = {};
    columnasActivas.forEach(col => {
      let val = f[col];
      
      if (col === 'tipo_id') {
          const rncClean = (f.rnc || '').replace(/-/g, '');
          if (rncClean.length === 9) val = '1';
          else if (rncClean.length === 11) val = '2';
          else val = '';
      }
      
      // Extraer componentes de fecha atomizados
      if (col === 'periodo') {
        val = formatPeriodo(f.fecha_factura);
      }
      
      if (col === 'dia') {
        val = formatDia(f.fecha_factura);
      }
      
      if (col === 'itbis_facturado') val = f.itbis_facturado !== undefined ? f.itbis_facturado : f.itbis;

      if (col === 'tipo_ncf') val = getTipoNCF(f.ncf);
      if (col === 'forma_pago') { const o = FORMAS_PAGO.find(p => p.value == val); if(o) val = o.value === '' ? '' : o.label; }
      if (col === 'tipo_gasto') { const o = CATEGORIAS_GASTO.find(c => c.value == String(val).trim()); if(o) val = o.value === '' ? '' : o.label; }
      if (col === 'rnc' && val) val = String(val).replace(/-/g, '');
      
      if (['itbis_facturado', 'total_pagado', 'monto_servicios', 'monto_bienes', 'itbis_retenido', 'itbis_proporcionalidad', 'itbis_costo', 'itbis_adelantar', 'itbis_percibido', 'monto_retencion_isr', 'isr_percibido', 'impuesto_selectivo', 'otros_impuestos', 'propina_legal'].includes(col)) { 
          let num = parseFloat(val); 
          if(isNaN(num)) num = 0; 
          val = num.toFixed(2); 
      }
      
      if (col === 'drive_url' && val && val.startsWith('/')) { val = window.location.origin + val; }
      if (val === null || val === undefined) val = '';
      filaProcesada[col] = String(val);
    });
    return filaProcesada;
  });

  return { 
    datos: datosProcesados, 
    columnas: columnasActivas, 
    empresa: empresaSeleccionada,
    periodoMes: document.getElementById('periodoMes').value, 
    periodoAnio: document.getElementById('periodoAnio').value 
  };
}

async function ejecutarExportacion() {
  const empresaSeleccionada = document.getElementById('exportEmpresaSelect').value;
  if (empresaSeleccionada === 'TODAS' && document.getElementById('confirmTodasModal').style.display === 'none') {
    abrirModalConfirmTodas();
    return;
  }

  const paquete = prepararDatosParaExportar();
  if (!paquete) return;
  const archivar = document.getElementById('checkArchivar').checked;
  generarCSV(paquete.datos, paquete.columnas, paquete.empresa);
  
  if (archivar) {
    let datosOriginales = facturasFiltradas;
    if (paquete.empresa !== 'TODAS') {
        datosOriginales = facturas.filter(f => f.empresa_nombre === paquete.empresa);
    }
    const ids = datosOriginales.map(f => f.id);
    await archivarFacturas(ids);
  }
  cerrarModalExportar();
}

async function ejecutarExportacionSheets() {
  const empresaSeleccionada = document.getElementById('exportEmpresaSelect').value;
  if (empresaSeleccionada === 'TODAS' && document.getElementById('confirmTodasModal').style.display === 'none') {
    abrirModalConfirmTodas();
    return;
  }

  const paquete = prepararDatosParaExportar();
  if (!paquete) return;
  const archivar = document.getElementById('checkArchivar').checked;

  if(typeof showToast === 'function') showToast('⏳ Exportando a Google Sheets...', 'info');

  try {
    const response = await fetchAPI('/contable/exportar-sheets', {
      method: 'POST',
      body: JSON.stringify({
        empresa_nombre: paquete.empresa,
        periodo_mes: paquete.periodoMes,
        periodo_anio: paquete.periodoAnio,
        columnas: paquete.columnas,
        facturas: paquete.datos
      })
    });

    if (response.success) {
      if(typeof showToast === 'function') showToast('✅ Exportado exitosamente', 'success');
      if (response.data && response.data.spreadsheet_url) { window.open(response.data.spreadsheet_url, '_blank'); }
      
      if (archivar) {
        let datosOriginales = facturasFiltradas;
        if (paquete.empresa !== 'TODAS') { datosOriginales = facturas.filter(f => f.empresa_nombre === paquete.empresa); }
        const ids = datosOriginales.map(f => f.id);
        await archivarFacturas(ids);
      }
      cerrarModalExportar();
    }
  } catch (error) {
    console.error(error);
    if(typeof showToast === 'function') showToast('Error al exportar a Sheets', 'error');
  }
}

async function archivarFacturas(ids) {
  try {
    const response = await fetchAPI('/contable/facturas/procesar-lote', { method: 'POST', body: JSON.stringify({ ids }) });
    if (response.success) {
      if(typeof showToast === 'function') showToast(`Sweep! ${ids.length} facturas archivadas`, 'success');
      setTimeout(() => loadPreCierre(), 1000); 
    }
  } catch (error) { if(typeof showToast === 'function') showToast('Error al archivar facturas', 'error'); }
}

function generarCSV(datosProcesados, columnas, nombreArchivoBase) {
  const headerMap = { 
      'empresa_nombre': 'Empresa', 
      'rnc': 'RNC o Cédula', 
      'tipo_id': 'Tipo Id',
      'tipo_gasto': 'Tipo de Gasto',
      'ncf': 'NCF', 
      'ncf_modificado': 'NCF Modificado',
      'periodo': 'Periodo',
      'dia': 'Día',
      'proveedor': 'Proveedor', 
      'monto_servicios': 'Monto Servicios',
      'monto_bienes': 'Monto Bienes',
      'total_pagado': 'Total Facturado',
      'itbis_facturado': 'ITBIS Facturado',
      'itbis_retenido': 'ITBIS Retenido',
      'itbis_proporcionalidad': 'ITBIS Proporcionalidad',
      'itbis_costo': 'ITBIS Costo',
      'itbis_adelantar': 'ITBIS Adelantar',
      'itbis_percibido': 'ITBIS Percibido',
      'tipo_retencion_isr': 'Tipo Retención ISR',
      'monto_retencion_isr': 'Retención ISR',
      'isr_percibido': 'ISR Percibido',
      'impuesto_selectivo': 'Impuesto Selectivo',
      'otros_impuestos': 'Otros Impuestos',
      'propina_legal': 'Propina Legal',
      'forma_pago': 'Forma de Pago',
      'drive_url': 'Link Factura' 
  };
  
  const headerRow = columnas.map(col => headerMap[col] || col).join(',');
  let csvContent = headerRow + '\n';
  datosProcesados.forEach(f => {
    const row = columnas.map(col => {
      let val = f[col];
      if (typeof val === 'string' && (val.includes(',') || val.includes('"') || val.includes('\n'))) { 
          val = `"${val.replace(/"/g, '""')}"`; 
      }
      return val;
    }).join(',');
    csvContent += row + '\n';
  });
  
  const blob = new Blob([csvContent], { type: 'text/csv;charset=utf-8;' });
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  const cleanName = nombreArchivoBase.replace(/[^a-zA-Z0-9]/g, '_');
  const timestamp = new Date().toISOString().slice(0, 10);
  a.download = `Reporte_${cleanName}_${timestamp}.csv`;
  document.body.appendChild(a);
  a.click();
  document.body.removeChild(a);
  if(typeof showToast === 'function') showToast(`✅ Exportadas ${datosProcesados.length} facturas`, 'success');
}

function handleLogout() {
  if (typeof clearAuth === 'function') clearAuth();
  window.location.href = '/';
}