document.addEventListener('DOMContentLoaded', () => {
  if (isAuthenticated()) {
    const user = getUser();
    if (user && user.rol) {
      redirectToDashboard(user.rol);
    }
  }

  const loginForm = document.getElementById('loginForm');
  if (loginForm) {
    loginForm.addEventListener('submit', handleLogin);
  }
});

async function handleLogin(e) {
  e.preventDefault();

  const email = document.getElementById('email').value.trim();
  const password = document.getElementById('password').value;
  const submitBtn = e.target.querySelector('button[type="submit"]');
  const errorDiv = document.getElementById('loginError');

  if (errorDiv) {
    errorDiv.classList.add('hidden');
  }

  if (!email || !password) {
    showError('Por favor, ingrese email y contraseña');
    return;
  }

  if (!validateEmail(email)) {
    showError('Por favor, ingrese un email válido');
    return;
  }

  submitBtn.disabled = true;
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
        redirectToDashboard(response.data.user.rol);
      }, 500);
    }
  } catch (error) {
    showError(error.message || 'Error al iniciar sesión');
    submitBtn.disabled = false;
    submitBtn.innerHTML = 'Iniciar Sesión';
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
