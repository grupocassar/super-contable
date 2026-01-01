let currentUser = null;
let contables = [];

document.addEventListener('DOMContentLoaded', () => {
  if (!requireAuth()) return;

  currentUser = getUser();
  if (currentUser.role !== 'super_admin') {
    showToast('Acceso denegado', 'error');
    window.location.href = '/';
    return;
  }

  loadDashboard();

  document.getElementById('logoutBtn')?.addEventListener('click', handleLogout);
  document.getElementById('createContableBtn')?.addEventListener('click', showCreateContableModal);
});

async function loadDashboard() {
  try {
    const [dashboardData, contablesData] = await Promise.all([
      fetchAPI('/admin/dashboard'),
      fetchAPI('/admin/contables')
    ]);

    if (dashboardData.success) {
      displayStats(dashboardData.data.stats);
    }

    if (contablesData.success) {
      contables = contablesData.data;
      displayContables(contables);
    }
  } catch (error) {
    showToast('Error al cargar dashboard: ' + error.message, 'error');
  }
}

function displayStats(stats) {
  document.getElementById('totalContables').textContent = stats.total_contables || 0;
  document.getElementById('totalAsistentes').textContent = stats.total_asistentes || 0;
  document.getElementById('totalEmpresas').textContent = stats.total_empresas || 0;
  document.getElementById('totalFacturas').textContent = stats.facturas?.total || 0;
}

function displayContables(contables) {
  const tbody = document.getElementById('contablesTableBody');

  if (!tbody) return;

  if (contables.length === 0) {
    tbody.innerHTML = `
      <tr>
        <td colspan="5" class="text-center">
          <div class="empty-state">
            <div class="empty-state-icon">📋</div>
            <p>No hay contables registrados</p>
          </div>
        </td>
      </tr>
    `;
    return;
  }

  tbody.innerHTML = contables.map(contable => `
    <tr>
      <td>${contable.id}</td>
      <td>
        <strong>${contable.nombre_completo}</strong><br>
        <small style="color: var(--text-secondary);">${contable.email}</small>
      </td>
      <td>${contable.stats?.total_empresas || 0}</td>
      <td>${contable.stats?.total_asistentes || 0}</td>
      <td>
        <span class="badge ${contable.activo ? 'badge-success' : 'badge-danger'}">
          ${contable.activo ? 'Activo' : 'Inactivo'}
        </span>
      </td>
      <td>
        <div class="actions">
          <button class="btn btn-sm btn-primary" onclick="editContable(${contable.id})">
            Editar
          </button>
          <button class="btn btn-sm btn-danger" onclick="deleteContable(${contable.id})">
            Eliminar
          </button>
        </div>
      </td>
    </tr>
  `).join('');
}

function showCreateContableModal() {
  const modal = document.getElementById('contableModal');
  const form = document.getElementById('contableForm');

  form.reset();
  document.getElementById('modalTitle').textContent = 'Crear Contable';
  document.getElementById('contableId').value = '';

  modal.classList.add('show');
}

function closeModal() {
  const modal = document.getElementById('contableModal');
  modal.classList.remove('show');
}

async function saveContable(e) {
  e.preventDefault();

  const id = document.getElementById('contableId').value;
  const formData = {
    email: document.getElementById('contableEmail').value,
    nombre_completo: document.getElementById('contableNombre').value,
    password: document.getElementById('contablePassword').value
  };

  try {
    if (id) {
      delete formData.password;
      await fetchAPI(`/admin/contables/${id}`, {
        method: 'PUT',
        body: JSON.stringify(formData)
      });
      showToast('Contable actualizado', 'success');
    } else {
      await fetchAPI('/admin/contables', {
        method: 'POST',
        body: JSON.stringify(formData)
      });
      showToast('Contable creado', 'success');
    }

    closeModal();
    loadDashboard();
  } catch (error) {
    showToast('Error: ' + error.message, 'error');
  }
}

async function editContable(id) {
  const contable = contables.find(c => c.id === id);
  if (!contable) return;

  document.getElementById('modalTitle').textContent = 'Editar Contable';
  document.getElementById('contableId').value = id;
  document.getElementById('contableEmail').value = contable.email;
  document.getElementById('contableNombre').value = contable.nombre_completo;

  const passwordField = document.getElementById('contablePassword');
  passwordField.value = '';
  passwordField.required = false;

  document.getElementById('contableModal').classList.add('show');
}

async function deleteContable(id) {
  if (!confirm('¿Está seguro de eliminar este contable? Esta acción no se puede deshacer.')) {
    return;
  }

  try {
    await fetchAPI(`/admin/contables/${id}`, {
      method: 'DELETE'
    });

    showToast('Contable eliminado', 'success');
    loadDashboard();
  } catch (error) {
    showToast('Error: ' + error.message, 'error');
  }
}

function handleLogout() {
  clearAuth();
  window.location.href = '/';
}