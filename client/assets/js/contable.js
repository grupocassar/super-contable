let currentUser = null;
let empresas = [];
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
});

async function loadDashboard() {
  try {
    const [dashboardData, empresasData, facturasData] = await Promise.all([
      fetchAPI('/contable/dashboard'),
      fetchAPI('/contable/empresas'),
      fetchAPI('/contable/facturas')
    ]);

    if (dashboardData.success) {
      displayStats(dashboardData.data.stats);
    }

    if (empresasData.success) {
      empresas = empresasData.data;
      displayEmpresas(empresas);
    }

    if (facturasData.success) {
      facturas = facturasData.data;
      displayFacturas(facturas.slice(0, 10));
    }
  } catch (error) {
    showToast('Error al cargar dashboard: ' + error.message, 'error');
  }
}

function displayStats(stats) {
  document.getElementById('totalEmpresas').textContent = stats.total_empresas || 0;
  document.getElementById('totalAsistentes').textContent = stats.total_asistentes || 0;

  const facturasStats = stats.facturas || {};
  document.getElementById('facturasPendientes').textContent = facturasStats.pendientes || 0;
  document.getElementById('facturasAprobadas').textContent = facturasStats.aprobadas || 0;
}

function displayEmpresas(empresas) {
  const tbody = document.getElementById('empresasTableBody');

  if (!tbody) return;

  if (empresas.length === 0) {
    tbody.innerHTML = `
      <tr>
        <td colspan="5" class="text-center">
          <div class="empty-state">
            <div class="empty-state-icon">🏢</div>
            <p>No hay empresas registradas</p>
          </div>
        </td>
      </tr>
    `;
    return;
  }

  tbody.innerHTML = empresas.map(empresa => `
    <tr>
      <td>
        <strong>${empresa.nombre}</strong><br>
        ${empresa.codigo_corto ? `<small style="color: var(--text-secondary);">${empresa.codigo_corto}</small>` : ''}
      </td>
      <td>${empresa.rnc || '-'}</td>
      <td>${empresa.stats?.total_facturas || 0}</td>
      <td>
        <span class="badge ${empresa.activa ? 'badge-success' : 'badge-danger'}">
          ${empresa.activa ? 'Activa' : 'Inactiva'}
        </span>
      </td>
      <td>
        <div class="actions">
          <button class="btn btn-sm btn-primary" onclick="editEmpresa(${empresa.id})">
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
    tbody.innerHTML = `
      <tr>
        <td colspan="6" class="text-center">
          <div class="empty-state">
            <div class="empty-state-icon">📄</div>
            <p>No hay facturas registradas</p>
          </div>
        </td>
      </tr>
    `;
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

  modal.classList.add('show');
}

function closeModal() {
  const modal = document.getElementById('empresaModal');
  modal.classList.remove('show');
}

async function saveEmpresa(e) {
  e.preventDefault();

  const id = document.getElementById('empresaId').value;
  const formData = {
    nombre: document.getElementById('empresaNombre').value,
    rnc: document.getElementById('empresaRNC').value,
    codigo_corto: document.getElementById('empresaCodigo').value
  };

  try {
    if (id) {
      await fetchAPI(`/contable/empresas/${id}`, {
        method: 'PUT',
        body: JSON.stringify(formData)
      });
      showToast('Empresa actualizada', 'success');
    } else {
      await fetchAPI('/contable/empresas', {
        method: 'POST',
        body: JSON.stringify(formData)
      });
      showToast('Empresa creada', 'success');
    }

    closeModal();
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
  document.getElementById('empresaCodigo').value = empresa.codigo_corto || '';

  document.getElementById('empresaModal').classList.add('show');
}

function handleLogout() {
  clearAuth();
  window.location.href = '/';
}
