/**
 * LÓGICA DE PRE-CIERRE FISCAL 606 - SUPER CONTABLE
 * Alineado con el "Gran Cambio" (Estructura 23 columnas + Gemini AI)
 * Corrección de Rutas: Se eliminó el prefijo '/api' explícito para evitar duplicidad con utils.js
 */

let currentUser = null;
let facturas = [];
let facturasFiltradas = [];
let empresas = [];
let estadoActual = 'aprobada'; // 'aprobada' (Pendientes) o 'exportada' (Histórico)

// ============================================
// CONSTANTES Y CONFIGURACIÓN
// ============================================

// Códigos de Gasto (01-11) según Norma 06-18
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

// Formas de Pago (01-07)
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
  // Manejo robusto de fechas que vienen de SQLite
  const parts = isoDate.split('-');
  if (parts.length !== 3) return isoDate; 
  return `${parts[2]}/${parts[1]}/${parts[0]}`;
}

// ============================================
// INICIALIZACIÓN
// ============================================

document.addEventListener('DOMContentLoaded', () => {
  // Verificación de Auth usando utils.js
  if (typeof requireAuth === 'function' && !requireAuth()) return;

  // Recuperar usuario (Prioridad: utils.js > localStorage)
  currentUser = typeof getUser === 'function' ? getUser() : null;
  if (!currentUser) {
      try { currentUser = JSON.parse(localStorage.getItem('user')); } catch(e){}
  }

  // Validación de Rol (Contable Senior / Super Admin)
  if (!currentUser || (currentUser.role !== 'contable' && currentUser.role !== 'super_admin')) {
    if(typeof showToast === 'function') showToast('Acceso denegado: Rol no autorizado', 'error');
    else alert('Acceso denegado');
    window.location.href = '/';
    return;
  }

  // Cargar datos iniciales
  loadPreCierre();

  // Listeners de UI
  document.getElementById('logoutBtn')?.addEventListener('click', handleLogout);
  document.getElementById('periodoMes')?.addEventListener('change', recargarDatos);
  document.getElementById('periodoAnio')?.addEventListener('change', recargarDatos);
  document.getElementById('exportEmpresaSelect')?.addEventListener('change', renderColumnCheckboxes);

  // Checkbox de confirmación masiva (Seguridad)
  const checkConfirm = document.getElementById('checkConfirmTodas');
  if (checkConfirm) {
      checkConfirm.addEventListener('change', function() {
        const btn = document.getElementById('btnConfirmarTodas');
        if(btn) btn.disabled = !this.checked;
      });
  }
  
  // Mostrar nombre usuario en Navbar
  if(currentUser.email) safeSetText('userName', currentUser.email.split('@')[0].toUpperCase());
});

// Tooltip para nombres largos de empresa
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
// CARGA DE DATOS (RUTAS CORREGIDAS)
// ============================================

async function loadPreCierre() {
  try {
    // FIX: Quitamos '/api' porque fetchAPI en utils.js ya lo agrega.
    // Rutas resultantes: /api/contable/empresas y /api/contable/facturas
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
      facturasFiltradas = [...facturas]; // Clonar para filtrar localmente sin perder datos
      
      aplicarFiltros(); 
      updateStatusBar();
      
      // Activar Memoria Contable (Punto 3 del Informe Técnico)
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
  const fTipo = document.getElementById('filterTipo').value.toLowerCase();
  const fNCF = document.getElementById('filterNCF').value.toLowerCase();
  const fProv = document.getElementById('filterProveedor').value.toLowerCase();
  const fGasto = document.getElementById('filterGasto').value;
  const fPago = document.getElementById('filterPago').value;

  facturasFiltradas = facturas.filter(f => {
    if (fEmpresa && !(f.empresa_nombre || '').toLowerCase().includes(fEmpresa)) return false;
    if (fRNC && !(f.rnc || '').toLowerCase().includes(fRNC)) return false;
    const tipo = getTipoNCF(f.ncf).toLowerCase();
    if (fTipo && !tipo.includes(fTipo)) return false;
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
// RENDERIZADO DE TABLA (23 COLUMNAS - VISTA RESUMIDA)
// ============================================

function renderTabla() {
  const tbody = document.getElementById('preCierreTableBody');
  if (!tbody) return;

  if (facturasFiltradas.length === 0) {
    const msg = estadoActual === 'aprobada' ? 'No hay facturas pendientes' : 'No hay facturas en el histórico';
    tbody.innerHTML = `<tr><td colspan="10" class="text-center" style="padding: 2rem; color: #64748b;">${msg}</td></tr>`;
    return;
  }

  const isReadOnly = estadoActual === 'exportada';
  const disabledAttr = isReadOnly ? 'disabled' : '';
  const inputClass = isReadOnly ? 'cell-input readonly' : 'cell-input';

  tbody.innerHTML = facturasFiltradas.map(f => {
    const fechaFormatted = formatDateDDMMYYYY(f.fecha_factura);
    const tipoNCF = getTipoNCF(f.ncf);
    
    const anomalia = isReadOnly ? null : getAnomalia(f);
    const rowClass = anomalia ? `anomalia-${anomalia.tipo}` : (isReadOnly ? 'fila-historico' : '');

    let iconoHTML = '';
    // Lógica de anomalías con corrección de eventos onclick
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

    // ALINEACIÓN 606: Usamos 'itbis_facturado' (nuevo esquema)
    // Fallback a 'itbis' solo para datos migrados antiguos
    const montoITBIS = f.itbis_facturado !== undefined ? f.itbis_facturado : (f.itbis || 0);

    return `
      <tr data-id="${f.id}" class="${rowClass}">
        <td class="text-center">${iconoHTML}</td>
        <td>
          <input type="text" class="${inputClass}" value="${fechaFormatted}" ${disabledAttr}
                 placeholder="DD/MM/YYYY" maxlength="10" onblur="saveDateField(${f.id}, this.value)">
        </td>
        <td onmouseenter="showCompanyTooltip(event, '${f.empresa_nombre || 'N/A'}')" onmouseleave="hideCompanyTooltip()">
          <input type="text" class="${inputClass}" value="${f.rnc || ''}" ${disabledAttr}
                 placeholder="XXX-XXXXX-X" onblur="saveField(${f.id}, 'rnc', this.value)">
        </td>
        <td class="text-center">
          <span class="badge-ncf badge-${tipoNCF.toLowerCase()}" id="badge-${f.id}">${tipoNCF}</span>
        </td>
        <td>
          <input type="text" class="${inputClass}" value="${f.ncf || ''}" ${disabledAttr}
                 onblur="saveNCFField(${f.id}, this.value)">
        </td>
        <td>
          <input type="text" class="${inputClass}" value="${f.proveedor || ''}" ${disabledAttr}
                 onblur="saveField(${f.id}, 'proveedor', this.value)">
        </td>
        <td class="td-select">
          <select class="cell-select select-tipo-gasto" data-factura-id="${f.id}" ${disabledAttr}
                  onchange="saveField(${f.id}, 'tipo_gasto', this.value)">
            ${CATEGORIAS_GASTO.map(cat => `<option value="${cat.value}" ${f.tipo_gasto === cat.value ? 'selected' : ''}>${cat.label}</option>`).join('')}
          </select>
        </td>
        <td class="td-select">
          <select class="cell-select" ${disabledAttr} onchange="saveField(${f.id}, 'forma_pago', this.value)">
            ${FORMAS_PAGO.map(fp => `<option value="${fp.value}" ${f.forma_pago === fp.value ? 'selected' : ''}>${fp.label}</option>`).join('')}
          </select>
        </td>
        <td class="text-right">
          <input type="number" class="${inputClass} text-right" value="${montoITBIS}" ${disabledAttr}
                 step="0.01" onblur="saveField(${f.id}, 'itbis_facturado', this.value)">
        </td>
        <td class="text-right">
          <input type="number" class="cell-input text-right" value="${f.total_pagado || 0}" ${disabledAttr}
                 step="0.01" style="font-weight: 600;" onblur="saveField(${f.id}, 'total_pagado', this.value)">
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
      // FIX: Ruta corregida
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
// MEMORIA CONTABLE (Punto 3 del Informe)
// ============================================

async function aplicarMemoriaContable(facturaId, proveedor) {
  if (estadoActual === 'exportada') return; 
  if (!proveedor || proveedor.trim() === '') return false;
  const select = document.querySelector(`.select-tipo-gasto[data-factura-id="${facturaId}"]`);
  if (!select || select.value !== '') return false;

  try {
    // FIX: Ruta corregida
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
  // Solo aplicar a facturas con proveedor pero sin tipo de gasto
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
    // Manejo inteligente de URLs de Google Drive para miniaturas
    if (url.includes('drive.google.com') && url.includes('id=')) {
        const fileId = url.split('id=')[1].split('&')[0];
        return `https://drive.google.com/thumbnail?id=${fileId}&sz=w1000`;
    }
    return url;
}

// ============================================
// MODALES (Restauración de funcionalidades)
// ============================================

function abrirComparacionDuplicados(ncf) {
    const duplicadas = facturas.filter(f => f.ncf === ncf && f.ncf && !f.revisada);
    if (duplicadas.length < 2) return;
    
    const f1 = duplicadas[0];
    const f2 = duplicadas[1];
    
    safeSetText('duplicadoNCF', ncf);

    // Factura A
    safeSetText('factura1Title', `FACTURA #${f1.id}`);
    safeSetText('factura1Fecha', formatDateDDMMYYYY(f1.fecha_factura));
    safeSetText('factura1NCF', f1.ncf || '-');
    safeSetText('factura1Proveedor', f1.proveedor || '-');
    safeSetText('factura1Total', formatCurrency(f1.total_pagado));
    const img1 = document.getElementById('factura1Imagen');
    if (img1) img1.src = getVisibleImageUrl(f1.archivo_url || f1.drive_url);
    
    // Factura B
    safeSetText('factura2Title', `FACTURA #${f2.id}`);
    safeSetText('factura2Fecha', formatDateDDMMYYYY(f2.fecha_factura));
    safeSetText('factura2NCF', f2.ncf || '-');
    safeSetText('factura2Proveedor', f2.proveedor || '-');
    safeSetText('factura2Total', formatCurrency(f2.total_pagado));
    const img2 = document.getElementById('factura2Imagen');
    if (img2) img2.src = getVisibleImageUrl(f2.archivo_url || f2.drive_url);

    // Conectar botones eliminar
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
    // FIX: Rutas corregidas
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
    // FIX: Ruta corregida
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

// --- SOSPECHOSAS (DETECCIÓN INTELIGENTE) ---
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
    // FIX: Ruta corregida
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
    // FIX: Rutas corregidas
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
// FUNCIONES DE GUARDADO (PERSISTENCIA)
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

async function saveField(facturaId, field, value, refrescar = true) {
  if (estadoActual === 'exportada') return; 

  try {
    const updates = { [field]: value };
    // Si se editan campos clave, resetear "revisada" para que la IA/Lógica vuelva a evaluar anomalías
    if (['ncf', 'rnc', 'fecha_factura', 'proveedor', 'total_pagado'].includes(field)) {
      updates.revisada = 0;
    }

    // FIX: Ruta corregida
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
// DETECCIÓN DE ANOMALÍAS (Lógica de Negocio 606)
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
  
  // 1. Validación de Periodo
  if (f.fecha_factura && pMes && pAnio) {
    const dateStr = String(f.fecha_factura);
    const year = dateStr.substring(0, 4);
    const month = dateStr.substring(5, 7);
    if (year !== pAnio || month !== pMes) return { tipo: 'fuera-periodo', icono: '🟠' };
  }
  
  // 2. Validación de RNC
  if (f.rnc && !validarRNC(f.rnc)) return { tipo: 'rnc-invalido', icono: '🔶' };
  
  // Si ya fue revisada manualmente, ignorar el resto
  if (f.revisada) return null;
  
  // 3. Duplicados (Mismo NCF)
  const dups = facturas.filter(x => x.ncf === f.ncf && x.ncf && !x.revisada);
  if (dups.length > 1) return { tipo: 'duplicado', icono: '🔴' };
  
  // 4. Sospechosas (Datos idénticos, diferente NCF)
  const sosp = facturas.filter(x => x.id !== f.id && x.proveedor === f.proveedor && x.total_pagado === f.total_pagado && x.fecha_factura === f.fecha_factura && x.ncf !== f.ncf && !x.revisada);
  if (sosp.length > 0) return { tipo: 'sospechosa', icono: '🟡' };
  
  // 5. ITBIS (Usando el nuevo campo 'itbis_facturado')
  const itbisVal = f.itbis_facturado !== undefined ? f.itbis_facturado : f.itbis;
  if (f.ncf?.startsWith('B01') && (!itbisVal || itbisVal == 0)) return { tipo: 'itbis', icono: '🧾' };
  
  // 6. Clasificación Incompleta
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
// EXPORTACIÓN Y MODAL "TODAS"
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
  
  renderColumnCheckboxes();
  modal.classList.add('show');
}

function renderColumnCheckboxes() {
    const empresaSelect = document.getElementById('exportEmpresaSelect').value;
    const grid = document.querySelector('.columns-grid');
    const showEmpresaCol = (empresaSelect === 'TODAS');
    
    let html = `<label><input type="checkbox" checked value="fecha_factura"> Fecha</label>`;
    if (showEmpresaCol) { html += `<label><input type="checkbox" checked value="empresa_nombre"> Empresa</label>`; }
    
    // Columnas ajustadas a la lógica de negocio 606
    html += `
        <label><input type="checkbox" checked value="rnc"> RNC</label>
        <label><input type="checkbox" checked value="ncf"> NCF</label>
        <label><input type="checkbox" checked value="tipo_ncf"> Tipo (B01)</label>
        <label><input type="checkbox" checked value="proveedor"> Proveedor</label>
        <label><input type="checkbox" checked value="tipo_gasto"> Tipo Gasto</label>
        <label><input type="checkbox" checked value="forma_pago"> Forma Pago</label>
        <label><input type="checkbox" checked value="itbis_facturado"> ITBIS</label>
        <label><input type="checkbox" checked value="total_pagado"> Total</label>
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
      // Mapeo itbis_facturado en export
      if (col === 'itbis_facturado') val = f.itbis_facturado !== undefined ? f.itbis_facturado : f.itbis;

      if (col === 'tipo_ncf') val = getTipoNCF(f.ncf);
      if (col === 'forma_pago') { const o = FORMAS_PAGO.find(p => p.value == val); if(o) val = o.value === '' ? '' : o.label; }
      if (col === 'tipo_gasto') { const o = CATEGORIAS_GASTO.find(c => c.value == String(val).trim()); if(o) val = o.value === '' ? '' : o.label; }
      if (col === 'rnc' && val) val = String(val).replace(/-/g, '');
      if (col === 'fecha_factura') val = formatDateDDMMYYYY(val);
      if (col === 'itbis_facturado' || col === 'total_pagado') { let num = parseFloat(val); if(isNaN(num)) num = 0; val = num.toFixed(2); }
      // FIX CRÍTICO: Recuperar ruta absoluta para links de Drive
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
    // FIX: Ruta corregida
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
    // FIX: Ruta corregida
    const response = await fetchAPI('/contable/facturas/procesar-lote', { method: 'POST', body: JSON.stringify({ ids }) });
    if (response.success) {
      if(typeof showToast === 'function') showToast(`Sweep! ${ids.length} facturas archivadas`, 'success');
      setTimeout(() => loadPreCierre(), 1000); 
    }
  } catch (error) { if(typeof showToast === 'function') showToast('Error al archivar facturas', 'error'); }
}

function generarCSV(datosProcesados, columnas, nombreArchivoBase) {
  const headerMap = { 
      'fecha_factura': 'Fecha', 'empresa_nombre': 'Empresa', 'rnc': 'RNC', 'ncf': 'NCF', 
      'tipo_ncf': 'Tipo', 'proveedor': 'Proveedor', 'tipo_gasto': 'Tipo Gasto', 
      'forma_pago': 'Forma Pago', 'itbis_facturado': 'ITBIS', 'total_pagado': 'Total', 'drive_url': 'Link Factura' 
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