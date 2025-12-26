let currentUser = null;
let empresas = [];
let asistentes = [];
let facturas = [];

document.addEventListener('DOMContentLoaded', () => {
  if (!requireAuth()) return;

  currentUser = getUser();
  if (currentUser.rol !== 'contable' && currentUser.rol !== 'super_admin') {
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
    const [dashboardData, empresasData, facturasData, asistentesData] = await Promise.all([
      fetchAPI('/contable/dashboard'),
      fetchAPI('/contable/empresas'),
      fetchAPI('/contable/facturas'),
      fetchAPI('/contable/asistentes')
    ]);

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

// --- MOTOR DE FILTRADO DINÁMICO ---

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
  if (estado) filtradas = filtradas.filter(f => f.estado === estado);

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

// --- RENDERIZADO DE TABLA MAESTRA (ORDEN: FECHA > EMPRESA > RNC > NCF > PROV > ITBIS > TOTAL) ---
function renderFacturasTable(lista) {
  const tbody = document.getElementById('facturasTableBody');
  if (!tbody) return;

  if (lista.length === 0) {
    tbody.innerHTML = '<tr><td colspan="9" class="text-center">No se encontraron facturas</td></tr>';
    return;
  }

  tbody.innerHTML = lista.map(f => {
    // Formatear fecha para el input date (YYYY-MM-DD)
    const fechaFormatted = f.fecha_factura ? f.fecha_factura.split('T')[0] : '';

    return `
    <tr data-id="${f.id}">
      <td class="text-center">
        <button class="btn-view-icon" 
                title="Ver Detalle Completo"
                onmouseenter="showImagePreview(${f.id}, '${f.archivo_url || f.drive_url}')" 
                onclick="openFullModal(${f.id})">
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
  `;}).join('');
}

// --- GUARDADO AUTOMÁTICO ---
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

// --- MODAL DE DETALLES PROFESIONAL ---
async function openFullModal(id) {
    const factura = facturas.find(f => f.id === id);
    if (!factura) return;

    safeUpdate('detailFacturaId', factura.id);
    safeUpdate('detailEmpresa', factura.empresa_nombre || 'Sin Empresa');
    
    const imgEl = document.getElementById('detailImage');
    if (imgEl) imgEl.src = factura.archivo_url || factura.drive_url || '/assets/img/no-image.png';

    const notesEl = document.getElementById('detailNotas');
    if (notesEl) notesEl.value = factura.notas || '';

    document.getElementById('approveBtn').onclick = () => updateFacturaStatus(id, 'aprobada');
    document.getElementById('rejectBtn').onclick = () => updateFacturaStatus(id, 'rechazada');
    document.getElementById('saveDetailBtn').onclick = () => saveFacturaNotes(id, notesEl.value);

    const modal = document.getElementById('detailModal');
    if (modal) modal.classList.add('show');
}

async function updateFacturaStatus(id, estado) {
    try {
        const response = await fetchAPI(`/contable/facturas/${id}`, {
            method: 'PUT',
            body: JSON.stringify({ estado })
        });
        if (response.success) {
            showToast(`Factura ${estado}`, 'success');
            closeModal('detailModal');
            loadDashboard();
        }
    } catch (error) { showToast('Error al actualizar', 'error'); }
}

async function saveFacturaNotes(id, notas) {
    try {
        const response = await fetchAPI(`/contable/facturas/${id}`, {
            method: 'PUT',
            body: JSON.stringify({ notas })
        });
        if (response.success) showToast('Notas guardadas', 'success');
    } catch (error) { showToast('Error al guardar notas', 'error'); }
}

// --- PREVIEW HOVER ---
function showImagePreview(id, url) {
    if (!url || url === 'undefined' || url === 'null') return;

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

// --- GESTIÓN DE EMPRESAS Y ASISTENTES ---
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

// --- UTILS ---
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