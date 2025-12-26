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
  
  // Aseguramos que el formulario tenga su listener
  document.getElementById('empresaForm')?.addEventListener('submit', saveEmpresa);
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
        <small class="text-muted" style="font-family: monospace; background: #f0f0f0; padding: 2px 4px; border-radius: 4px;">
          ${empresa.codigo_corto || 'Generando...'}
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
  
  // Ocultamos el campo de código corto ya que es automático
  const codigoField = document.getElementById('empresaCodigo');
  if (codigoField && codigoField.parentElement) {
    codigoField.parentElement.style.display = 'none';
  }

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
    rnc: document.getElementById('empresaRNC').value
    // Eliminado codigo_corto: se genera en el servidor
  };

  try {
    const btn = e.target.querySelector('button[type="submit"]');
    btn.disabled = true;
    btn.textContent = 'Guardando...';

    if (id) {
      await fetchAPI(`/contable/empresas/${id}`, {
        method: 'PUT',
        body: JSON.stringify(formData)
      });
      showToast('Empresa actualizada correctamente', 'success');
    } else {
      await fetchAPI('/contable/empresas', {
        method: 'POST',
        body: JSON.stringify(formData)
      });
      showToast('Empresa creada con código automático', 'success');
    }

    closeModal();
    loadDashboard();
  } catch (error) {
    showToast('Error: ' + error.message, 'error');
  } finally {
    const btn = e.target.querySelector('button[type="submit"]');
    if (btn) {
      btn.disabled = false;
      btn.textContent = 'Guardar';
    }
  }
}

async function editEmpresa(id) {
  const empresa = empresas.find(e => e.id === id);
  if (!empresa) return;

  document.getElementById('modalTitle').textContent = 'Editar Empresa';
  document.getElementById('empresaId').value = id;
  document.getElementById('empresaNombre').value = empresa.nombre;
  document.getElementById('empresaRNC').value = empresa.rnc || '';
  
  // Al editar, si quieres ver el código pero no cambiarlo, puedes ponerlo readonly
  const codigoField = document.getElementById('empresaCodigo');
  if (codigoField) {
    codigoField.value = empresa.codigo_corto || '';
    codigoField.readOnly = true;
    if (codigoField.parentElement) {
        codigoField.parentElement.style.display = 'block';
    }
  }

  document.getElementById('empresaModal').classList.add('show');
}

function handleLogout() {
  clearAuth();
  window.location.href = '/';
}