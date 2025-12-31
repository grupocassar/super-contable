document.addEventListener('DOMContentLoaded', () => {
  // Verificación de sesión existente
  if (isAuthenticated()) {
    const user = getUser();
    if (user && user.role) {
      redirectToDashboard(user.role);
    }
  }

  const loginForm = document.getElementById('loginForm');
  if (loginForm) {
    loginForm.addEventListener('submit', handleLogin);
  }

  // --- LÓGICA DE AUTO-LOGIN PARA DESARROLLO ---
  const devRows = document.querySelectorAll('.dev-user-row');
  devRows.forEach(row => {
    row.addEventListener('click', () => {
      const emailField = document.getElementById('email');
      const passField = document.getElementById('password');

      // 1. Rellenar los campos con los datos del atributo data
      emailField.value = row.getAttribute('data-email');
      passField.value = row.getAttribute('data-pass');

      // 2. Ejecutar el login automáticamente
      handleLogin(new Event('submit')); 
      // Nota: Pasamos un evento sintético a handleLogin
    });
  });
});

async function handleLogin(e) {
  // Prevenir comportamiento por defecto si viene de un evento real
  if (e && e.preventDefault) e.preventDefault();

  const email = document.getElementById('email').value.trim();
  const password = document.getElementById('password').value;
  const submitBtn = document.getElementById('submitBtn');
  const errorDiv = document.getElementById('loginError');

  // Reset de errores
  if (errorDiv) {
    errorDiv.classList.add('hidden');
  }

  // Validaciones básicas
  if (!email || !password) {
    showError('Por favor, ingrese email y contraseña');
    return;
  }

  if (!validateEmail(email)) {
    showError('Por favor, ingrese un email válido');
    return;
  }

  // Estado visual de carga
  submitBtn.disabled = true;
  const originalText = submitBtn.innerHTML;
  submitBtn.innerHTML = '<span class="loading"></span> Iniciando sesión...';

  try {
    const response = await fetchAPI('/auth/login', {
      method: 'POST',
      body: JSON.stringify({ email, password }),
    });

    if (response.success) {
      setAuth(response.data.token, response.data.user);
      showToast('Inicio de sesión exitoso', 'success');

      setTimeout(() => {
        redirectToDashboard(response.data.user.role);
      }, 500);
    } else {
      throw new Error(response.message || 'Credenciales incorrectas');
    }
  } catch (error) {
    showError(error.message || 'Error al iniciar sesión');
    submitBtn.disabled = false;
    submitBtn.innerHTML = originalText;
  }
}

function showError(message) {
  const errorDiv = document.getElementById('loginError');
  if (errorDiv) {
    errorDiv.textContent = message;
    errorDiv.classList.remove('hidden');
  } else {
    showToast(message, 'error');
  }
}