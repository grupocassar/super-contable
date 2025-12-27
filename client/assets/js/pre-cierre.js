let currentUser = null;
let facturas = [];
let empresas = [];

// Categorías oficiales DGII
const CATEGORIAS_GASTO = [
  { value: '', label: '-- Seleccionar Tipo de Gasto --' },
  { value: 'E01', label: 'Gastos de personal' },
  { value: 'E02', label: 'Gastos por trabajos, suministros y servicios' },
  { value: 'E03', label: 'Arrendamientos' },
  { value: 'E04', label: 'Gastos de activos fijos' },
  { value: 'E05', label: 'Gastos de representación' },
  { value: 'E06', label: 'Otras deducciones admitidas' },
  { value: 'E07', label: 'Gastos financieros' },
  { value: 'E08', label: 'Gastos extraordinarios' },
  { value: 'E09', label: 'Compras y gastos que formarán parte del costo de venta' },
  { value: 'E10', label: 'Adquisiciones de activos' },
  { value: 'E11', label: 'Gastos de seguros' }
];

const FORMAS_PAGO = [
  { value: '', label: '-- Seleccionar --' },
  { value: '01', label: 'Efectivo' },
  { value: '02', label: 'Cheque' },
  { value: '03', label: 'Transferencia' },
  { value: '04', label: 'Tarjeta Crédito' },
  { value: '05', label: 'Tarjeta Débito' },
  { value: '06', label: 'Crédito' }
];

document.addEventListener('DOMContentLoaded', () => {
  if (!requireAuth()) return;

  currentUser = getUser();
  if (currentUser.rol !== 'contable' && currentUser.rol !== 'super_admin') {
    showToast('Acceso denegado', 'error');
    window.location.href = '/';
    return;
  }

  loadPreCierre();

  // Event listeners
  document.getElementById('logoutBtn')?.addEventListener('click', handleLogout);
  document.getElementById('periodoMes')?.addEventListener('change', loadPreCierre);
  document.getElementById('periodoAnio')?.addEventListener('change', loadPreCierre);
  document.getElementById('btnExport606')?.addEventListener('click', exportar606);
  document.getElementById('btnExportExcel')?.addEventListener('click', exportarExcel);
});

async function loadPreCierre() {
  try {
    const [empresasData, facturasData] = await Promise.all([
      fetchAPI('/contable/empresas'),
      fetchAPI('/contable/facturas?estado=aprobada')
    ]);

    if (empresasData.success) {
      empresas = empresasData.data;
    }

    if (facturasData.success) {
      facturas = facturasData.data;
      renderTabla();
      updateStatusBar();
    }
  } catch (error) {
    console.error('Error cargando pre-cierre:', error);
    showToast('Error al cargar datos', 'error');
  }
}

function renderTabla() {
  const tbody = document.getElementById('preCierreTableBody');
  if (!tbody) return;

  if (facturas.length === 0) {
    tbody.innerHTML = '<tr><td colspan="11" class="text-center">No hay facturas aprobadas en este período</td></tr>';
    return;
  }

  tbody.innerHTML = facturas.map(f => {
    const fechaFormatted = formatDateDDMMYYYY(f.fecha_factura);
    const tipoNCF = getTipoNCF(f.ncf);
    const anomalia = getAnomalia(f);
    const rowClass = anomalia ? `anomalia-${anomalia.tipo}` : '';

    // ✅ Hacer íconos clickeables según tipo
    let iconoHTML = '';
    if (anomalia) {
      if (anomalia.tipo === 'duplicado') {
        iconoHTML = `<span class="anomalia-clickeable" onclick="abrirComparacionDuplicados('${f.ncf}')" title="Click para comparar duplicados">${anomalia.icono}</span>`;
      } else if (anomalia.tipo === 'sospechosa') {
        iconoHTML = `<span class="anomalia-clickeable" onclick="abrirComparacionSospechosas(${f.id})" title="Click para comparar sospechosas">${anomalia.icono}</span>`;
      } else {
        iconoHTML = anomalia.icono;
      }
    }

    return `
      <tr data-id="${f.id}" class="${rowClass}">
        <td class="text-center">${iconoHTML}</td>
        <td>
          <input type="text" 
                 class="cell-input" 
                 value="${fechaFormatted}"
                 placeholder="DD/MM/YYYY"
                 maxlength="10"
                 onblur="saveDateField(${f.id}, this.value)">
        </td>
        <td class="no-edit">${f.empresa_nombre || '-'}</td>
        <td>
          <input type="text" 
                 class="cell-input" 
                 value="${f.rnc || ''}"
                 placeholder="XXX-XXXXX-X"
                 onblur="saveField(${f.id}, 'rnc', this.value)">
        </td>
        <td class="text-center">
          <span class="badge-ncf badge-${tipoNCF.toLowerCase()}" id="badge-${f.id}">${tipoNCF}</span>
        </td>
        <td>
          <input type="text" 
                 class="cell-input" 
                 value="${f.ncf || ''}"
                 onblur="saveNCFField(${f.id}, this.value)">
        </td>
        <td>
          <input type="text" 
                 class="cell-input" 
                 value="${f.proveedor || ''}"
                 onblur="saveField(${f.id}, 'proveedor', this.value)">
        </td>
        <td class="td-select">
          <select class="cell-select" onchange="saveField(${f.id}, 'tipo_gasto', this.value)">
            ${CATEGORIAS_GASTO.map(cat => 
              `<option value="${cat.value}" ${f.tipo_gasto === cat.value ? 'selected' : ''}>${cat.label}</option>`
            ).join('')}
          </select>
        </td>
        <td class="td-select">
          <select class="cell-select" onchange="saveField(${f.id}, 'forma_pago', this.value)">
            ${FORMAS_PAGO.map(fp => 
              `<option value="${fp.value}" ${f.forma_pago === fp.value ? 'selected' : ''}>${fp.label}</option>`
            ).join('')}
          </select>
        </td>
        <td class="text-right">
          <input type="number" 
                 class="cell-input text-right" 
                 value="${f.itbis || 0}"
                 step="0.01"
                 onblur="saveField(${f.id}, 'itbis', this.value)">
        </td>
        <td class="text-right">
          <input type="number" 
                 class="cell-input text-right" 
                 value="${f.total_pagado || 0}"
                 step="0.01"
                 style="font-weight: 600;"
                 onblur="saveField(${f.id}, 'total_pagado', this.value)">
        </td>
      </tr>
    `;
  }).join('');
}

// ============================================
// COMPARACIÓN DE DUPLICADOS (NCF IGUAL)
// ============================================

function abrirComparacionDuplicados(ncf) {
  const duplicadas = facturas.filter(f => f.ncf === ncf && f.ncf);
  
  if (duplicadas.length < 2) {
    showToast('No hay duplicados para comparar', 'info');
    return;
  }

  const factura1 = duplicadas[0];
  const factura2 = duplicadas[1];

  document.getElementById('duplicadoNCF').textContent = ncf;
  
  document.getElementById('factura1Title').textContent = `FACTURA #${factura1.id}`;
  document.getElementById('factura1Fecha').textContent = formatDateDDMMYYYY(factura1.fecha_factura);
  document.getElementById('factura1Empresa').textContent = factura1.empresa_nombre || '-';
  document.getElementById('factura1Proveedor').textContent = factura1.proveedor || '-';
  document.getElementById('factura1Total').textContent = formatCurrency(factura1.total_pagado);
  document.getElementById('factura1Imagen').src = factura1.archivo_url || factura1.drive_url || '/assets/img/no-image.png';
  
  document.getElementById('factura2Title').textContent = `FACTURA #${factura2.id}`;
  document.getElementById('factura2Fecha').textContent = formatDateDDMMYYYY(factura2.fecha_factura);
  document.getElementById('factura2Empresa').textContent = factura2.empresa_nombre || '-';
  document.getElementById('factura2Proveedor').textContent = factura2.proveedor || '-';
  document.getElementById('factura2Total').textContent = formatCurrency(factura2.total_pagado);
  document.getElementById('factura2Imagen').src = factura2.archivo_url || factura2.drive_url || '/assets/img/no-image.png';

  document.getElementById('btnEliminar1').onclick = () => eliminarFacturaDuplicada(factura1.id);
  document.getElementById('btnEliminar2').onclick = () => eliminarFacturaDuplicada(factura2.id);

  document.getElementById('duplicadosModal').classList.add('show');
}

function cerrarModalDuplicados() {
  document.getElementById('duplicadosModal').classList.remove('show');
}

async function eliminarFacturaDuplicada(facturaId) {
  if (!confirm('¿Estás seguro de eliminar esta factura? Esta acción no se puede deshacer.')) {
    return;
  }

  try {
    const response = await fetchAPI(`/contable/facturas/${facturaId}`, {
      method: 'DELETE'
    });

    if (response.success) {
      showToast('✓ Factura eliminada', 'success');
      cerrarModalDuplicados();
      loadPreCierre();
    }
  } catch (error) {
    showToast('Error al eliminar factura', 'error');
  }
}

// ============================================
// COMPARACIÓN DE SOSPECHOSAS (DATOS IGUALES, NCF DIFERENTE)
// ============================================

function abrirComparacionSospechosas(facturaId) {
  const factura = facturas.find(f => f.id === facturaId);
  if (!factura) return;

  // Buscar facturas con mismos datos pero NCF diferente y no revisadas
  const sospechosas = facturas.filter(f => 
    f.id !== factura.id &&
    f.proveedor === factura.proveedor &&
    f.total_pagado === factura.total_pagado &&
    f.fecha_factura === factura.fecha_factura &&
    f.ncf !== factura.ncf &&
    !f.revisada
  );

  if (sospechosas.length === 0) {
    showToast('No hay facturas sospechosas para comparar', 'info');
    return;
  }

  const factura1 = factura;
  const factura2 = sospechosas[0];

  document.getElementById('sospechosa1Title').textContent = `FACTURA #${factura1.id}`;
  document.getElementById('sospechosa1NCF').textContent = factura1.ncf || '-';
  document.getElementById('sospechosa1Fecha').textContent = formatDateDDMMYYYY(factura1.fecha_factura);
  document.getElementById('sospechosa1Empresa').textContent = factura1.empresa_nombre || '-';
  document.getElementById('sospechosa1Proveedor').textContent = factura1.proveedor || '-';
  document.getElementById('sospechosa1Total').textContent = formatCurrency(factura1.total_pagado);
  document.getElementById('sospechosa1Imagen').src = factura1.archivo_url || factura1.drive_url || '/assets/img/no-image.png';

  document.getElementById('sospechosa2Title').textContent = `FACTURA #${factura2.id}`;
  document.getElementById('sospechosa2NCF').textContent = factura2.ncf || '-';
  document.getElementById('sospechosa2Fecha').textContent = formatDateDDMMYYYY(factura2.fecha_factura);
  document.getElementById('sospechosa2Empresa').textContent = factura2.empresa_nombre || '-';
  document.getElementById('sospechosa2Proveedor').textContent = factura2.proveedor || '-';
  document.getElementById('sospechosa2Total').textContent = formatCurrency(factura2.total_pagado);
  document.getElementById('sospechosa2Imagen').src = factura2.archivo_url || factura2.drive_url || '/assets/img/no-image.png';

  document.getElementById('btnEliminarSosp1').onclick = () => eliminarFacturaSospechosa(factura1.id);
  document.getElementById('btnEliminarSosp2').onclick = () => eliminarFacturaSospechosa(factura2.id);

  document.getElementById('sospechosasModal').classList.add('show');
}

function cerrarModalSospechosas() {
  document.getElementById('sospechosasModal').classList.remove('show');
}

async function mantenerAmbas() {
  await marcarComoRevisadas();
}

async function eliminarFacturaSospechosa(facturaId) {
  if (!confirm('¿Estás seguro de eliminar esta factura? Esta acción no se puede deshacer.')) {
    return;
  }

  try {
    const response = await fetchAPI(`/contable/facturas/${facturaId}`, {
      method: 'DELETE'
    });

    if (response.success) {
      showToast('✓ Factura eliminada', 'success');
      cerrarModalSospechosas();
      loadPreCierre();
    }
  } catch (error) {
    showToast('Error al eliminar factura', 'error');
  }
}

async function marcarComoRevisadas() {
  const factura1Id = document.getElementById('sospechosa1Title').textContent.match(/#(\d+)/)[1];
  const factura2Id = document.getElementById('sospechosa2Title').textContent.match(/#(\d+)/)[1];

  try {
    // Marcar ambas facturas como revisadas
    await Promise.all([
      fetchAPI(`/contable/facturas/${factura1Id}`, {
        method: 'PUT',
        body: JSON.stringify({ revisada: 1 })
      }),
      fetchAPI(`/contable/facturas/${factura2Id}`, {
        method: 'PUT',
        body: JSON.stringify({ revisada: 1 })
      })
    ]);

    showToast('✓ Marcadas como revisadas', 'success');
    cerrarModalSospechosas();
    loadPreCierre(); // Recargar tabla
  } catch (error) {
    showToast('Error al marcar como revisadas', 'error');
  }
}

// ============================================
// FUNCIONES DE GUARDADO
// ============================================

function formatDateDDMMYYYY(isoDate) {
  if (!isoDate) return '';
  const date = new Date(isoDate);
  const day = String(date.getDate()).padStart(2, '0');
  const month = String(date.getMonth() + 1).padStart(2, '0');
  const year = date.getFullYear();
  return `${day}/${month}/${year}`;
}

async function saveDateField(facturaId, ddmmyyyy) {
  if (!ddmmyyyy || ddmmyyyy.trim() === '') return;
  
  const parts = ddmmyyyy.split('/');
  if (parts.length !== 3) {
    showToast('Formato de fecha inválido. Use DD/MM/YYYY', 'error');
    return;
  }
  
  const isoDate = `${parts[2]}-${parts[1]}-${parts[0]}`;
  await saveField(facturaId, 'fecha_factura', isoDate);
}

async function saveNCFField(facturaId, ncfValue) {
  const factura = facturas.find(f => f.id === facturaId);
  if (factura && factura.ncf === ncfValue) return;

  try {
    const response = await fetchAPI(`/contable/facturas/${facturaId}`, {
      method: 'PUT',
      body: JSON.stringify({ ncf: ncfValue })
    });

    if (response.success) {
      if (factura) factura.ncf = ncfValue;
      
      const badge = document.getElementById(`badge-${facturaId}`);
      if (badge) {
        const nuevoTipo = getTipoNCF(ncfValue);
        badge.textContent = nuevoTipo;
        badge.className = `badge-ncf badge-${nuevoTipo.toLowerCase()}`;
      }
      
      showToast('✓ Guardado', 'success');
      updateStatusBar();
    }
  } catch (error) {
    showToast('Error al guardar', 'error');
  }
}

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
      updateStatusBar();
    }
  } catch (error) {
    showToast('Error al guardar', 'error');
  }
}

// ============================================
// DETECCIÓN DE ANOMALÍAS
// ============================================

function getTipoNCF(ncf) {
  if (!ncf) return '--';
  const prefix = ncf.substring(0, 3).toUpperCase();
  
  const tipos = {
    'B01': 'B01',
    'B02': 'B02',
    'B11': 'B11',
    'B14': 'B14',
    'B15': 'B15',
    'B16': 'B16'
  };
  
  return tipos[prefix] || ncf.substring(0, 3);
}

function getAnomalia(factura) {
  // ✅ Saltar facturas ya revisadas
  if (factura.revisada) return null;

  // 🔴 PRIORIDAD 1: Duplicado NCF (crítico DGII)
  const duplicados = facturas.filter(f => f.ncf === factura.ncf && f.ncf);
  if (duplicados.length > 1) {
    return { tipo: 'duplicado', icono: '🔴' };
  }

  // 🟡 PRIORIDAD 2: Factura sospechosa (mismo proveedor + total + fecha, NCF diferente)
  const sospechosas = facturas.filter(f => 
    f.id !== factura.id &&
    f.proveedor === factura.proveedor &&
    f.total_pagado === factura.total_pagado &&
    f.fecha_factura === factura.fecha_factura &&
    f.ncf !== factura.ncf &&
    !f.revisada // ✅ Solo si no está revisada
  );
  if (sospechosas.length > 0) {
    return { tipo: 'sospechosa', icono: '🟡' };
  }

  // 🧾 PRIORIDAD 3: ITBIS = 0 en B01
  if (factura.ncf && factura.ncf.startsWith('B01') && (!factura.itbis || factura.itbis == 0)) {
    return { tipo: 'itbis', icono: '🧾' };
  }

  // ⚠️ PRIORIDAD 4: Clasificación incompleta
  if (!factura.tipo_gasto || !factura.forma_pago) {
    return { tipo: 'sin-clasificar', icono: '⚠️' };
  }

  return null;
}

// ============================================
// BARRA DE ESTADO
// ============================================

function updateStatusBar() {
  const total = facturas.length;
  
  // Contar duplicados (NCF iguales)
  const duplicados = new Set(
    facturas
      .filter(f => f.ncf)
      .filter((f, i, arr) => arr.filter(x => x.ncf === f.ncf).length > 1)
      .map(f => f.ncf)
  ).size;
  
  // Contar sospechosas (mismo proveedor+total+fecha, NCF diferente, no revisadas)
  const sospechosas = facturas.filter(f => {
    if (f.revisada) return false;
    const sosp = facturas.filter(x => 
      x.id !== f.id &&
      x.proveedor === f.proveedor &&
      x.total_pagado === f.total_pagado &&
      x.fecha_factura === f.fecha_factura &&
      x.ncf !== f.ncf &&
      !x.revisada
    );
    return sosp.length > 0;
  }).length;
  
  // Contar ITBIS=0 en B01
  const itbis0 = facturas.filter(f => 
    f.ncf && 
    f.ncf.startsWith('B01') && 
    (!f.itbis || f.itbis == 0)
  ).length;
  
  // Contar sin clasificar
  const sinClasificar = facturas.filter(f => 
    !f.tipo_gasto || !f.forma_pago
  ).length;

  // Contar OK (las que no tienen ninguna anomalía)
  const ok = total - (duplicados * 2) - sospechosas - itbis0 - sinClasificar;

  // Actualizar contadores
  document.getElementById('statusTotal').textContent = `${total} facturas`;
  document.getElementById('statusOK').textContent = Math.max(0, ok);
  
  // Duplicados
  if (duplicados > 0) {
    document.getElementById('countDuplicados').textContent = duplicados;
    document.getElementById('statusDuplicados').style.display = 'flex';
  } else {
    document.getElementById('statusDuplicados').style.display = 'none';
  }

  // Sospechosas
  if (sospechosas > 0) {
    document.getElementById('countSospechosas').textContent = sospechosas;
    document.getElementById('statusSospechosas').style.display = 'flex';
  } else {
    document.getElementById('statusSospechosas').style.display = 'none';
  }

  // ITBIS=0
  if (itbis0 > 0) {
    document.getElementById('countITBIS').textContent = itbis0;
    document.getElementById('statusITBIS').style.display = 'flex';
  } else {
    document.getElementById('statusITBIS').style.display = 'none';
  }

  // Sin clasificar
  if (sinClasificar > 0) {
    document.getElementById('countSinClasificar').textContent = sinClasificar;
    document.getElementById('statusSinClasificar').style.display = 'flex';
  } else {
    document.getElementById('statusSinClasificar').style.display = 'none';
  }
}

// ============================================
// EXPORTS (PLACEHOLDER)
// ============================================

function exportar606() {
  showToast('Función de export 606 en desarrollo', 'info');
}

function exportarExcel() {
  showToast('Función de export Excel en desarrollo', 'info');
}

function handleLogout() {
  clearAuth();
  window.location.href = '/';
}