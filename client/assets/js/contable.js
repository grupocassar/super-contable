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
  
  // Listeners para formularios
  document.getElementById('empresaForm')?.addEventListener('submit', saveEmpresa);
  document.getElementById('asistenteForm')?.addEventListener('submit', saveAsistente);
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
    }

    if (asistentesData.success) {
      asistentes = asistentesData.data;
      displayAsistentes(asistentes);
    }

    if (facturasData.success) {
      facturas = facturasData.data;
      displayFacturas(facturas.slice(0, 10));
    }
  } catch (error) {
    showToast('Error al cargar dashboard: ' + error.message, 'error');
  }
}

// --- GESTIÓN DE ASISTENTES ---

function displayAsistentes(lista) {
  const tbody = document.getElementById('asistentesTableBody');
  if (!tbody) return;

  if (lista.length === 0) {
    tbody.innerHTML = '<tr><td colspan="3" class="text-center">No tienes asistentes registrados</td></tr>';
    return;
  }

  tbody.innerHTML = lista.map(asistente => `
    <tr>
      <td><strong>${asistente.nombre_completo}</strong></td>
      <td>${asistente.email}</td>
      <td>
        <div class="actions">
          <button class="btn btn-sm btn-outline-primary" onclick="editAsistente(${asistente.id})">
            Editar
          </button>
          <button class="btn btn-sm btn-primary" onclick="showAssignModal(${asistente.id}, '${asistente.nombre_completo}')">
            Asignar Empresas
          </button>
        </div>
      </td>
    </tr>
  `).join('');
}

function showCreateAsistenteModal() {
  const modal = document.getElementById('asistenteModal');
  const form = document.getElementById('asistenteForm');
  
  if (form) form.reset();
  
  // Limpiar estados de edición
  document.getElementById('asistenteId').value = '';
  document.querySelector('#asistenteModal .modal-title').textContent = 'Nuevo Asistente';
  document.getElementById('asistentePassword').placeholder = '••••••••';
  document.getElementById('asistentePassword').required = true;
  
  modal.classList.add('show');
}

function editAsistente(id) {
  const asistente = asistentes.find(a => a.id === id);
  if (!asistente) return;

  const modal = document.getElementById('asistenteModal');
  document.getElementById('asistenteId').value = asistente.id;
  document.querySelector('#asistenteModal .modal-title').textContent = 'Editar Asistente';
  
  document.getElementById('asistenteNombre').value = asistente.nombre_completo;
  document.getElementById('asistenteEmail').value = asistente.email;
  
  // Para edición, la contraseña no es obligatoria
  document.getElementById('asistentePassword').value = '';
  document.getElementById('asistentePassword').placeholder = '(Dejar en blanco para no cambiar)';
  document.getElementById('asistentePassword').required = false;

  modal.classList.add('show');
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
    const btn = e.target.querySelector('button[type="submit"]');
    btn.disabled = true;
    btn.textContent = 'Guardando...';

    const method = id ? 'PUT' : 'POST';
    const url = id ? `/contable/asistentes/${id}` : '/contable/asistentes';

    const response = await fetchAPI(url, {
      method: method,
      body: JSON.stringify(formData)
    });

    if (response.success) {
      showToast(id ? 'Asistente actualizado' : 'Asistente creado', 'success');
      closeModal('asistenteModal');
      loadDashboard();
    }
  } catch (error) {
    showToast('Error: ' + error.message, 'error');
  } finally {
    const btn = e.target.querySelector('button[type="submit"]');
    if (btn) {
      btn.disabled = false;
      btn.textContent = id ? 'Guardar Cambios' : 'Crear Asistente';
    }
  }
}

// --- ASIGNACIONES ---

async function showAssignModal(asistenteId, nombre) {
  const modal = document.getElementById('assignModal');
  const listContainer = document.getElementById('companiesCheckboxList');
  const subTitle = document.getElementById('assignModalSub');
  
  document.getElementById('assignAsistenteId').value = asistenteId;
  subTitle.textContent = `Selecciona las empresas que gestionará ${nombre}`;
  
  try {
    const response = await fetchAPI(`/contable/asistentes/${asistenteId}/empresas`);
    const asignadasIds = response.success ? response.data : [];

    if (empresas.length === 0) {
      listContainer.innerHTML = '<p class="text-center">Primero debes crear empresas.</p>';
    } else {
      listContainer.innerHTML = empresas.map(emp => `
        <label class="checkbox-item">
          <input type="checkbox" name="empresaCheck" value="${emp.id}" 
            ${asignadasIds.includes(emp.id) ? 'checked' : ''}>
          <span>${emp.nombre} <small>(${emp.rnc || 'Sin RNC'})</small></span>
        </label>
      `).join('');
    }

    modal.classList.add('show');
  } catch (error) {
    showToast('Error al cargar asignaciones: ' + error.message, 'error');
  }
}

async function saveAsignaciones() {
  const asistenteId = document.getElementById('assignAsistenteId').value;
  const checkboxes = document.querySelectorAll('input[name="empresaCheck"]:checked');
  const empresasIds = Array.from(checkboxes).map(cb => parseInt(cb.value));

  try {
    const response = await fetchAPI(`/contable/asistentes/${asistenteId}/empresas`, {
      method: 'POST',
      body: JSON.stringify({ empresasIds })
    });

    if (response.success) {
      showToast('Asignaciones actualizadas', 'success');
      closeModal('assignModal');
      loadDashboard();
    }
  } catch (error) {
    showToast('Error al guardar: ' + error.message, 'error');
  }
}

// --- FUNCIONES DE EMPRESAS Y STATS ---

function displayStats(stats) {
  document.getElementById('totalEmpresas').textContent = stats.total_empresas || 0;
  document.getElementById('totalAsistentes').textContent = stats.total_asistentes || 0;

  const facturasStats = stats.facturas || {};
  document.getElementById('facturasPendientes').textContent = facturasStats.pendientes || 0;
  document.getElementById('facturasAprobadas').textContent = facturasStats.aprobadas || 0;
}

function displayEmpresas(lista) {
  const tbody = document.getElementById('empresasTableBody');
  if (!tbody) return;

  if (lista.length === 0) {
    tbody.innerHTML = '<tr><td colspan="5" class="text-center">No hay empresas registradas</td></tr>';
    return;
  }

  tbody.innerHTML = lista.map(empresa => `
    <tr>
      <td>
        <strong>${empresa.nombre}</strong><br>
        <small class="text-muted" style="font-family: monospace; background: #f0f0f0; padding: 2px 4px; border-radius: 4px;">
          ${empresa.codigo_corto || '---'}
        </small>
      </td>
      <td>${empresa.rnc || '-'}</td>
      <td>${empresa.stats?.listas || 0}</td>
      <td>
        <span class="badge ${empresa.activa !== false ? 'badge-success' : 'badge-danger'}">
          ${empresa.activa !== false ? 'Activa' : 'Inactiva'}
        </span>
      </td>
      <td>
        <div class="actions">
          <button class="btn btn-sm btn-outline-primary" onclick="editEmpresa(${empresa.id})">
            Editar
          </button>
        </div>
      </td>
    </tr>
  `).join('');
}

function displayFacturas(facturas) {
  const tbody = document.getElementById('facturasTableBody');
  if (!tbody) return;

  if (facturas.length === 0) {
    tbody.innerHTML = '<tr><td colspan="6" class="text-center">No hay facturas registradas</td></tr>';
    return;
  }

  tbody.innerHTML = facturas.map(factura => `
    <tr>
      <td>${factura.id}</td>
      <td>${factura.empresa_nombre || '-'}</td>
      <td>${factura.ncf || '-'}</td>
      <td>${factura.proveedor || '-'}</td>
      <td>${formatCurrency(factura.total_pagado)}</td>
      <td>
        <span class="badge ${getEstadoBadgeClass(factura.estado)}">
          ${getEstadoLabel(factura.estado)}
        </span>
      </td>
    </tr>
  `).join('');
}

function showCreateEmpresaModal() {
  const modal = document.getElementById('empresaModal');
  const form = document.getElementById('empresaForm');
  form.reset();
  document.getElementById('modalTitle').textContent = 'Crear Empresa';
  document.getElementById('empresaId').value = '';
  const codigoField = document.getElementById('empresaCodigo');
  if (codigoField && codigoField.parentElement) {
    codigoField.parentElement.style.display = 'none';
  }
  modal.classList.add('show');
}

function closeModal(id) {
  const modal = document.getElementById(id || 'empresaModal');
  if (modal) modal.classList.remove('show');
}

async function saveEmpresa(e) {
  e.preventDefault();
  const id = document.getElementById('empresaId').value;
  const formData = {
    nombre: document.getElementById('empresaNombre').value,
    rnc: document.getElementById('empresaRNC').value
  };

  try {
    const btn = e.target.querySelector('button[type="submit"]');
    btn.disabled = true;
    if (id) {
      await fetchAPI(`/contable/empresas/${id}`, { method: 'PUT', body: JSON.stringify(formData) });
      showToast('Empresa actualizada', 'success');
    } else {
      await fetchAPI('/contable/empresas', { method: 'POST', body: JSON.stringify(formData) });
      showToast('Empresa creada', 'success');
    }
    closeModal('empresaModal');
    loadDashboard();
  } catch (error) {
    showToast('Error: ' + error.message, 'error');
  }
}

async function editEmpresa(id) {
  const empresa = empresas.find(e => e.id === id);
  if (!empresa) return;
  document.getElementById('modalTitle').textContent = 'Editar Empresa';
  document.getElementById('empresaId').value = id;
  document.getElementById('empresaNombre').value = empresa.nombre;
  document.getElementById('empresaRNC').value = empresa.rnc || '';
  const codigoField = document.getElementById('empresaCodigo');
  if (codigoField) {
    codigoField.value = empresa.codigo_corto || '';
    codigoField.readOnly = true;
    if (codigoField.parentElement) codigoField.parentElement.style.display = 'block';
  }
  document.getElementById('empresaModal').classList.add('show');
}

function handleLogout() {
  clearAuth();
  window.location.href = '/';
}