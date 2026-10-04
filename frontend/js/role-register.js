(function () {
  const page = document.body.dataset.registerRole;
  const configs = {
    renter: { title: 'Farmer Account', subtitle: 'Create an account to rent equipment and manage orders.', icon: 'fa-tractor', login: 'login.html', destination: '../index.html', success: 'Account created! Redirecting...', button: 'Create Farmer Account' },
    kamgar: { title: 'Worker Account', subtitle: 'Create your worker account and find agricultural work.', icon: 'fa-person-digging', login: 'worker-login.html', destination: 'kamgar-dashboard.html', success: 'Worker account created! Redirecting to your dashboard...', button: 'Create Worker Account' },
    supplier: { title: 'Supplier Account', subtitle: 'Create your supplier account to manage fertilizer products.', icon: 'fa-seedling', login: 'fertilizer-login.html', destination: 'supplier-kyc.html', success: 'Supplier account created! Redirecting to KYC...', button: 'Create Supplier Account' }
  };
  const config = configs[page];
  if (!config) return;

  document.title = config.title + ' - KrishiYantra';
  document.getElementById('registerIcon').className = 'fa-solid ' + config.icon;
  document.getElementById('registerTitle').textContent = config.title;
  document.getElementById('registerSubtitle').textContent = config.subtitle;
  document.getElementById('registerButtonText').textContent = config.button;
  document.getElementById('loginLink').href = config.login;

  if (isLoggedIn()) {
    const existing = getUser() || {};
    if (String(existing.role || '').toLowerCase() === page) {
      window.location.href = config.destination;
    } else {
      window.location.href = '../index.html';
    }
    return;
  }

  document.getElementById('registerForm').addEventListener('submit', async function (event) {
    event.preventDefault();
    const firstName = document.getElementById('firstName').value.trim();
    const lastName = document.getElementById('lastName').value.trim();
    const email = document.getElementById('email').value.trim().toLowerCase();
    const phone = document.getElementById('phone').value.trim();
    const location = document.getElementById('location').value.trim();
    const password = document.getElementById('password').value;

    if (!firstName || !lastName || !email || !phone || !location || !password) { showAlert('alertBox', 'Please fill all fields.', 'error'); return; }
    if (password.length < 6) { showAlert('alertBox', 'Password must be at least 6 characters.', 'error'); return; }

    const button = document.getElementById('registerButton');
    button.disabled = true;
    button.innerHTML = '<i class="fa-solid fa-spinner fa-spin"></i> Creating account...';
    try {
      const response = await apiCall('POST', '/auth/register', { name: firstName + ' ' + lastName, email, phone, location, password, role: page });
      if (!response.token) throw new Error(response.error || 'Registration failed.');
      localStorage.setItem('token', response.token);
      localStorage.setItem('user', JSON.stringify(response.user));
      showAlert('alertBox', config.success, 'success');
      setTimeout(function () { window.location.href = config.destination; }, 900);
    } catch (error) {
      showAlert('alertBox', error && error.message ? error.message : 'Cannot connect to server.', 'error');
      button.disabled = false;
      button.innerHTML = '<i class="fa-solid fa-user-plus"></i> <span id="registerButtonText">' + config.button + '</span>';
    }
  });
})();
