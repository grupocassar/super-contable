let currentUser = null;
let facturas = [];
let empresas = [];

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
  document.getElementById('filterEstado')?.addEventListener('change', filterFacturas);
});

async function loadDashboard() {
  try {
    const dashboardData = await fetchAPI('/asistente/dashboard');

    if (dashboardData.success) {
      displayStats(dashboardData.data.stats);
      empresas = dashboardData.data.empresas || [];
      facturas = dashboardData.data.facturas_recientes || [];
      displayFacturas(facturas);
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
}

function displayFacturas(facturas) {
  const tbody = document.getElementById('facturasTableBody');

  if (!tbody) return;

  if (facturas.length === 0) {
    tbody.innerHTML = `
      <tr>
        <td colspan="7" class="text-center">
          <div class="empty-state">
            <div class="empty-state-icon">📄</div>
            <p>No hay facturas asignadas</p>
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
      <td>${formatDate(factura.fecha_factura)}</td>
      <td>${factura.ncf || '-'}</td>
      <td>${factura.proveedor || '-'}</td>
      <td>${formatCurrency(factura.total_pagado)}</td>
      <td>
        <span class="badge ${getEstadoBadgeClass(factura.estado)}">
          ${getEstadoLabel(factura.estado)}
        </span>
      </td>
      <td>
        <div class="actions">
          ${factura.estado === 'pending' || factura.estado === 'lista' ? `
            <button class="btn btn-sm btn-primary" onclick="editFactura(${factura.id})">
              Editar
            </button>
            <button class="btn btn-sm btn-secondary" onclick="aprobarFactura(${factura.id})">
              Aprobar
            </button>
          ` : ''}
          ${factura.drive_url ? `
            <a href="${factura.drive_url}" target="_blank" class="btn btn-sm btn-outline">
              Ver
            </a>
          ` : ''}
        </div>
      </td>
    </tr>
  `).join('');
}

async function filterFacturas() {
  const estado = document.getElementById('filterEstado').value;

  try {
    const params = new URLSearchParams();
    if (estado) params.append('estado', estado);

    const response = await fetchAPI(`/asistente/facturas?${params.toString()}`);

    if (response.success) {
      facturas = response.data;
      displayFacturas(facturas);
    }
  } catch (error) {
    showToast('Error al filtrar facturas: ' + error.message, 'error');
  }
}

function editFactura(id) {
  const factura = facturas.find(f => f.id === id);
  if (!factura) return;

  document.getElementById('modalTitle').textContent = 'Editar Factura';
  document.getElementById('facturaId').value = id;
  document.getElementById('facturaFecha').value = factura.fecha_factura || '';
  document.getElementById('facturaNCF').value = factura.ncf || '';
  document.getElementById('facturaRNC').value = factura.rnc || '';
  document.getElementById('facturaProveedor').value = factura.proveedor || '';
  document.getElementById('facturaITBIS').value = factura.itbis || '';
  document.getElementById('facturaTotal').value = factura.total_pagado || '';

  document.getElementById('facturaModal').classList.add('show');
}

function closeModal() {
  const modal = document.getElementById('facturaModal');
  modal.classList.remove('show');
}

async function saveFactura(e) {
  e.preventDefault();

  const id = document.getElementById('facturaId').value;
  const formData = {
    fecha_factura: document.getElementById('facturaFecha').value,
    ncf: document.getElementById('facturaNCF').value,
    rnc: document.getElementById('facturaRNC').value,
    proveedor: document.getElementById('facturaProveedor').value,
    itbis: parseFloat(document.getElementById('facturaITBIS').value),
    total_pagado: parseFloat(document.getElementById('facturaTotal').value),
    estado: 'lista'
  };

  try {
    await fetchAPI(`/asistente/facturas/${id}`, {
      method: 'PUT',
      body: JSON.stringify(formData)
    });

    showToast('Factura actualizada', 'success');
    closeModal();
    loadDashboard();
  } catch (error) {
    showToast('Error: ' + error.message, 'error');
  }
}

async function aprobarFactura(id) {
  if (!confirm('¿Está seguro de aprobar esta factura?')) {
    return;
  }

  try {
    await fetchAPI(`/asistente/facturas/${id}/aprobar`, {
      method: 'POST'
    });

    showToast('Factura aprobada', 'success');
    loadDashboard();
  } catch (error) {
    showToast('Error: ' + error.message, 'error');
  }
}

function handleLogout() {
  clearAuth();
  window.location.href = '/';
}
