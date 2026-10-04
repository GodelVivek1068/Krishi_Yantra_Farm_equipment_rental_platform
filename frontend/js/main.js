const API_BASE = (() => {
  const configured = (window.APP_CONFIG && window.APP_CONFIG.API_BASE) || '';
  if (configured) return configured.replace(/\/$/, '');

  const hostname = window.location.hostname || '';
  const port = window.location.port || '';
  const protocol = window.location.protocol || '';

  // If Flask itself is serving the page (e.g. on port 5000), use relative /api
  if (port === '5000') return '/api';

  // If running from file:// or localhost / LAN IP
  const isLocal = !hostname ||
    hostname === 'localhost' ||
    hostname === '127.0.0.1' ||
    hostname.startsWith('192.168.') ||
    hostname.startsWith('10.') ||
    hostname.startsWith('172.') ||
    protocol === 'file:';

  return isLocal ? 'http://localhost:5000/api' : '/api';
})();

function getBasePathContext() {
  const p = window.location.pathname.replace(/\\/g, '/');
  if (p.includes('/pages/') || (p.endsWith('.html') && !p.endsWith('index.html') && !p.endsWith('/'))) {
    return 'pages';
  }
  return 'root';
}

function resolvePageHref(pageName) {
  const isRoot = getBasePathContext() === 'root';
  if (pageName === 'index.html' || pageName === '../index.html') {
    return isRoot ? 'index.html' : '../index.html';
  }
  const clean = pageName.replace(/^\.?\/?pages\//, '').replace(/^\.\.\//, '');
  return isRoot ? `pages/${clean}` : clean;
}

const TRANSLATION_STORAGE_KEY = 'siteLanguage';
const TRANSLATION_LANGUAGES = [
  { value: 'en', label: 'English' },
  { value: 'hi', label: 'Hindi' },
  { value: 'mr', label: 'Marathi' },
  { value: 'gu', label: 'Gujarati' },
  { value: 'pa', label: 'Punjabi' },
  { value: 'ta', label: 'Tamil' },
  { value: 'te', label: 'Telugu' }
];

let translateApplyTimer = null;
let accountDocClickHandler = null;
let accountEscHandler = null;

// ===== AUTH HELPERS =====
function getToken() { return localStorage.getItem('token'); }
function getUser() {
  const u = localStorage.getItem('user');
  return u ? JSON.parse(u) : null;
}
function isLoggedIn() { return !!getToken(); }
function isFarmerLoggedIn() {
  if (!isLoggedIn()) return false;
  const user = getUser();
  if (!user || !user.role) return false;
  const role = String(user.role).toLowerCase();
  return role === 'farmer' || role === 'renter' || role === 'kamgar' || role === 'supplier';
}
function logout() {
  localStorage.removeItem('token');
  localStorage.removeItem('user');
  window.location.href = resolvePageHref('index.html');
}

function setUser(user) {
  if (!user) return;
  localStorage.setItem('user', JSON.stringify(user));
}

function escapeHtml(value) {
  return String(value == null ? '' : value)
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#39;');
}

function roleToLabel(roleValue) {
  const role = String(roleValue || '').toLowerCase();
  if (role === 'admin') return 'Admin';
  if (role === 'owner') return 'Owner';
  if (role === 'supplier') return 'Supplier';
  if (role === 'kamgar') return 'Worker';
  if (role === 'transport') return 'Transport Provider';
  return 'Farmer';
}

// ===== API HELPER =====
async function apiCall(method, endpoint, data = null, auth = false) {
  const headers = { 'Content-Type': 'application/json' };
  if (auth && getToken()) headers['Authorization'] = `Bearer ${getToken()}`;
  const opts = { method, headers };
  if (data) opts.body = JSON.stringify(data);

  let res;
  try {
    res = await fetch(`${API_BASE}${endpoint}`, opts);
  } catch (err) {
    console.error(`Network error calling ${endpoint}:`, err);
    throw new Error(`Cannot connect to KrishiYantra backend server. Please make sure the Flask backend is running on port 5000 (${API_BASE}).`);
  }

  let payload = null;
  try {
    payload = await res.json();
  } catch (_) {
    payload = null;
  }

  if (!res.ok) {
    if (res.status === 401 && auth) {
      console.warn('Session expired or unauthorized for endpoint:', endpoint);
      localStorage.removeItem('token');
    }
    const message = (payload && payload.error) ? payload.error : `Request failed (${res.status})`;
    throw new Error(message);
  }

  return payload || {};
}

// ===== NAVBAR: Hamburger =====
const hamburger = document.getElementById('hamburger');
const navLinks = document.getElementById('navLinks');
if (hamburger && navLinks) {
  hamburger.addEventListener('click', () => {
    navLinks.classList.toggle('open');
  });
}

// ===== SERVICE MENU DROPDOWN (Farmer login and dashboard only) =====
function bindFarmerServicesMenu() {
  bindServicesDropdown();
}

function bindServicesDropdown() {
  const menus = document.querySelectorAll('.service-menu, #farmerServicesNav, #servicesNav');
  menus.forEach(menu => {
    if (!menu || menu.dataset.bound === 'true') return;
    menu.dataset.bound = 'true';
    const toggle = menu.querySelector('.service-menu-toggle, .dropbtn');
    if (!toggle) return;

    toggle.addEventListener('click', event => {
      event.preventDefault();
      event.stopPropagation();
      const isOpen = menu.classList.toggle('open');
      toggle.setAttribute('aria-expanded', String(isOpen));
    });

    menu.querySelectorAll('.service-menu-dropdown a, .dropdown-content a').forEach(link => {
      link.addEventListener('click', () => {
        menu.classList.remove('open');
        toggle.setAttribute('aria-expanded', 'false');
      });
    });

    document.addEventListener('click', event => {
      if (!menu.contains(event.target)) {
        menu.classList.remove('open');
        toggle.setAttribute('aria-expanded', 'false');
      }
    });

    document.addEventListener('keydown', event => {
      if (event.key === 'Escape' && menu.classList.contains('open')) {
        menu.classList.remove('open');
        toggle.setAttribute('aria-expanded', 'false');
      }
    });
  });
}

// ===== NAVBAR: Auth state =====
function updateNavAuth() {
  const navAuth = document.getElementById('navAuth');
  if (!navAuth) return;
  const user = getUser();

  // Show Services only on the farmer login and farmer dashboard.
  const currentPage = window.location.pathname.split('/').pop().toLowerCase().replace(/\.html$/, '');
  const farmerServicesNav = document.getElementById('farmerServicesNav');
  if (farmerServicesNav) {
    farmerServicesNav.hidden = !['login', 'farmer-dashboard'].includes(currentPage);
  }

  // Hide farmer-specific personal tabs from non-farmers.
  const farmerRestrictedItems = [
    document.getElementById('farmerMyRentalsNav'),
    document.getElementById('farmerListEquipmentNav'),
    document.getElementById('farmerOrdersNav')
  ].filter(Boolean);

  const userRole = String((user && user.role) || '').toLowerCase();
  const isFarmer = userRole === 'farmer' || userRole === 'renter';
  farmerRestrictedItems.forEach(item => { item.hidden = !isFarmer; });

  const transportDashboardNav = document.getElementById('transportDashboardNav');
  if (transportDashboardNav) transportDashboardNav.hidden = (userRole !== 'owner' && userRole !== 'transport');

  // Bind service menu dropdown
  bindServicesDropdown();

  if (user) {
    const role = String(user.role || '').toLowerCase();
    const isOwner = role === 'owner';
    const isSupplier = role === 'supplier';
    const isAdmin = role === 'admin';
    const isFarmer = role === 'farmer' || role === 'renter';
    const kycStatus = String(user.kyc_status || '').toLowerCase();
    const firstName = (user.name || 'User').split(' ')[0];
    const accountInitials = String(user.name || 'U')
      .trim()
      .split(/\s+/)
      .filter(Boolean)
      .slice(0, 2)
      .map(part => part.charAt(0).toUpperCase())
      .join('') || 'U';
    const roleLabel = roleToLabel(role);
    const ownerPortalHref = (kycStatus === 'approved') ? resolvePageHref('owner-dashboard.html') : resolvePageHref('owner-kyc.html');
    const ownerPortalLabel = (kycStatus === 'approved') ? 'Owner Dashboard' : 'Complete KYC';
    const ownerEquipmentLink = (isOwner && kycStatus === 'approved')
      ? `<a href="${resolvePageHref('owner-dashboard.html')}#equipmentList" class="btn-outline" style="margin-left:8px">Equipment</a>`
      : '';
    const isTransport = role === 'transport';
    const supplierPortalHref = (kycStatus === 'approved') ? resolvePageHref('supplier-dashboard.html') : resolvePageHref('supplier-kyc.html');
    const supplierPortalLabel = (kycStatus === 'approved') ? 'Supplier Dashboard' : 'Complete KYC';
    const supplierLink = isSupplier
      ? `<a href="${supplierPortalHref}" class="btn-outline" style="margin-left:8px">${supplierPortalLabel}</a>`
      : '';
    const kamgarLink = role === 'kamgar'
      ? `<a href="${resolvePageHref('kamgar-dashboard.html')}" class="btn-outline" style="margin-left:8px">Worker Dashboard</a>`
      : '';
    const transportLink = (isTransport || isOwner)
      ? `<a href="${resolvePageHref('transport-dashboard.html')}" class="btn-outline" style="margin-left:8px">Transport Dashboard</a>`
      : '';
    const ownerLink = isOwner
      ? `<a href="${ownerPortalHref}" class="btn-outline" style="margin-left:8px">${ownerPortalLabel}</a>`
      : '';
    let statusTag = '';
    if (isOwner || isSupplier) {
      if (kycStatus === 'pending') statusTag = ' | KYC: Pending';
      else if (kycStatus === 'approved') statusTag = ' | KYC: Approved';
      else if (kycStatus === 'rejected') statusTag = ' | KYC: Rejected';
    }

    if (isFarmer) {
      navAuth.classList.add('nav-auth-has-account');
      navAuth.innerHTML = `
        <a href="${resolvePageHref('notifications.html')}" class="account-icon-btn" title="Notifications">
          <i class="fa-solid fa-bell"></i>
          <span class="notification-badge" id="notificationBadge" style="display: none;"></span>
        </a>
        <div class="account-menu" id="farmerAccountMenu">
          <button class="account-icon-btn" id="accountToggleBtn" type="button" aria-expanded="false" aria-label="Open account details">
            <i class="fa-solid fa-user"></i>
          </button>
          <div class="account-dropdown" id="farmerAccountDropdown" hidden>
            <div class="account-header">
              <div class="account-identity">
                <div class="account-avatar">${escapeHtml(accountInitials)}</div>
                <div class="account-identity-text">
                  <span class="account-title">${escapeHtml(user.name || 'Farmer')}</span>
                  <span class="account-subtitle">Manage your profile</span>
                </div>
              </div>
              <span class="account-role-tag">${escapeHtml(roleLabel)}</span>
            </div>
            <div class="account-info" id="farmerAccountInfo">
              <div class="account-info-row"><span class="account-info-label">Name</span><span>${escapeHtml(user.name || '')}</span></div>
              <div class="account-info-row"><span class="account-info-label">Email</span><span>${escapeHtml(user.email || '')}</span></div>
              <div class="account-info-row"><span class="account-info-label">Phone</span><span>${escapeHtml(user.phone || '')}</span></div>
              <div class="account-info-row"><span class="account-info-label">Location</span><span>${escapeHtml(user.location || '')}</span></div>
            </div>
            <div class="account-actions">
              <button type="button" class="account-inline-btn" id="accountEditBtn">Edit Details</button>
              <button type="button" class="account-inline-btn account-logout-btn" id="accountLogoutBtn">Logout</button>
            </div>
            <form class="account-edit-form" id="farmerProfileForm" hidden>
              <div class="form-group">
                <label for="profileNameInput">Name</label>
                <input id="profileNameInput" name="name" type="text" maxlength="80" value="${escapeHtml(user.name || '')}" required>
              </div>
              <div class="form-group">
                <label for="profileEmailInput">Email</label>
                <input id="profileEmailInput" name="email" type="email" maxlength="120" value="${escapeHtml(user.email || '')}" required>
              </div>
              <div class="form-group">
                <label for="profilePhoneInput">Phone</label>
                <input id="profilePhoneInput" name="phone" type="tel" maxlength="20" value="${escapeHtml(user.phone || '')}">
              </div>
              <div class="form-group">
                <label for="profileLocationInput">Location</label>
                <input id="profileLocationInput" name="location" type="text" maxlength="120" value="${escapeHtml(user.location || '')}">
              </div>
              <div class="account-form-actions">
                <button type="button" class="account-inline-btn" id="profileCancelBtn">Cancel</button>
                <button type="submit" class="btn-green" id="profileSaveBtn">Save</button>
              </div>
              <div class="account-feedback" id="profileFeedback" role="status" aria-live="polite"></div>
            </form>
          </div>
        </div>
      `;
      bindFarmerAccountMenu();
      return;
    }

    navAuth.classList.remove('nav-auth-has-account');

    navAuth.innerHTML = `
      <span style="color:rgba(255,255,255,0.8);font-size:0.88rem;">${roleLabel}: <strong>${firstName}</strong>${statusTag}</span>
      ${ownerLink}
      ${supplierLink}
      ${kamgarLink}
      ${transportLink}
      ${ownerEquipmentLink}
      <button class="btn-outline" onclick="logout()">Logout</button>
    `;
  } else {
    navAuth.classList.remove('nav-auth-has-account');
  }
}
updateNavAuth();

function bindFarmerAccountMenu() {
  const menu = document.getElementById('farmerAccountMenu');
  const toggleBtn = document.getElementById('accountToggleBtn');
  const dropdown = document.getElementById('farmerAccountDropdown');
  const editBtn = document.getElementById('accountEditBtn');
  const logoutBtn = document.getElementById('accountLogoutBtn');
  const form = document.getElementById('farmerProfileForm');
  const cancelBtn = document.getElementById('profileCancelBtn');
  const feedback = document.getElementById('profileFeedback');
  const saveBtn = document.getElementById('profileSaveBtn');
  if (!menu || !toggleBtn || !dropdown || !editBtn || !logoutBtn || !form || !cancelBtn || !feedback || !saveBtn) return;

  const openDropdown = () => {
    dropdown.hidden = false;
    toggleBtn.setAttribute('aria-expanded', 'true');
  };

  const closeDropdown = () => {
    dropdown.hidden = true;
    toggleBtn.setAttribute('aria-expanded', 'false');
  };

  toggleBtn.addEventListener('click', () => {
    if (dropdown.hidden) openDropdown();
    else closeDropdown();
  });

  editBtn.addEventListener('click', () => {
    form.hidden = false;
    feedback.innerHTML = '';
  });

  cancelBtn.addEventListener('click', () => {
    form.hidden = true;
    feedback.innerHTML = '';
  });

  logoutBtn.addEventListener('click', () => {
    logout();
  });

  if (accountDocClickHandler) {
    document.removeEventListener('click', accountDocClickHandler);
  }
  if (accountEscHandler) {
    document.removeEventListener('keydown', accountEscHandler);
  }

  accountDocClickHandler = event => {
    if (dropdown.hidden) return;
    if (!menu.contains(event.target)) closeDropdown();
  };
  document.addEventListener('click', accountDocClickHandler);

  accountEscHandler = event => {
    if (event.key === 'Escape') closeDropdown();
  };
  document.addEventListener('keydown', accountEscHandler);

  form.addEventListener('submit', async event => {
    event.preventDefault();
    const formData = new FormData(form);
    const payload = {
      name: String(formData.get('name') || '').trim(),
      email: String(formData.get('email') || '').trim().toLowerCase(),
      phone: String(formData.get('phone') || '').trim(),
      location: String(formData.get('location') || '').trim()
    };

    if (!payload.name || !payload.email || !payload.phone) {
      showAlert('profileFeedback', 'Name, email, and phone are required.', 'error');
      return;
    }

    saveBtn.disabled = true;
    saveBtn.textContent = 'Saving...';
    try {
      const res = await apiCall('PUT', '/auth/me', payload, true);
      if (!res.user) throw new Error('Could not update profile.');
      setUser(res.user);
      updateNavAuth();
      const refreshedToggle = document.getElementById('accountToggleBtn');
      const refreshedDropdown = document.getElementById('farmerAccountDropdown');
      if (refreshedToggle && refreshedDropdown) {
        refreshedDropdown.hidden = false;
        refreshedToggle.setAttribute('aria-expanded', 'true');
      }
      showAlert('profileFeedback', 'Profile updated successfully.', 'success');
    } catch (error) {
      showAlert('profileFeedback', error.message || 'Failed to update profile.', 'error');
    } finally {
      saveBtn.disabled = false;
      saveBtn.textContent = 'Save';
    }
  });
}

async function refreshCurrentUser() {
  if (!isLoggedIn()) return;
  try {
    const res = await apiCall('GET', '/auth/me', null, true);
    if (res && res.user) {
      setUser(res.user);
      updateNavAuth();
    }
  } catch (_) {
    // Ignore background refresh failures and keep local session state.
  }
}
refreshCurrentUser();

function injectLanguageSwitcher() {
  const nav = document.querySelector('.navbar');
  const navAuth = document.getElementById('navAuth');
  if (!nav || !navAuth || document.getElementById('languageSwitcher')) return;

  const wrapper = document.createElement('div');
  wrapper.className = 'language-switcher notranslate';
  wrapper.id = 'languageSwitcher';
  wrapper.setAttribute('translate', 'no');

  const options = TRANSLATION_LANGUAGES.map(language => {
    return `<option value="${language.value}">${language.label}</option>`;
  }).join('');

  wrapper.innerHTML = `
    <select id="languageSelect" class="language-select notranslate" translate="no" aria-label="Translate site">
      ${options}
    </select>
  `;

  nav.insertBefore(wrapper, navAuth);

  const select = document.getElementById('languageSelect');
  const savedLanguage = localStorage.getItem(TRANSLATION_STORAGE_KEY) || 'en';
  select.value = savedLanguage;
  select.addEventListener('change', event => {
    const language = event.target.value || 'en';
    localStorage.setItem(TRANSLATION_STORAGE_KEY, language);
    applyTranslation(language);
  });
}

function applyTranslation(language) {
  const targetLanguage = language || 'en';

  if (translateApplyTimer) {
    clearInterval(translateApplyTimer);
    translateApplyTimer = null;
  }

  const restoreLanguageLabels = () => {
    const select = document.getElementById('languageSelect');
    if (!select) return;
    TRANSLATION_LANGUAGES.forEach(language => {
      const option = select.querySelector(`option[value="${language.value}"]`);
      if (option && option.textContent !== language.label) {
        option.textContent = language.label;
      }
    });
    if (select.value !== targetLanguage) {
      select.value = targetLanguage;
    }
  };

  const tryApply = () => {
    restoreLanguageLabels();
    const combo = document.querySelector('.goog-te-combo');
    if (!combo) return false;
    combo.value = targetLanguage;
    combo.dispatchEvent(new Event('change'));
    setTimeout(restoreLanguageLabels, 100);
    setTimeout(restoreLanguageLabels, 700);
    return true;
  };

  if (tryApply()) return;

  let attempts = 0;
  translateApplyTimer = setInterval(() => {
    attempts += 1;
    if (tryApply() || attempts >= 20) {
      clearInterval(translateApplyTimer);
      translateApplyTimer = null;
    }
  }, 250);
}

function loadTranslateWidget() {
  if (document.getElementById('googleTranslateScript')) return;

  window.googleTranslateElementInit = function () {
    if (!window.google || !window.google.translate) return;

    new google.translate.TranslateElement({
      pageLanguage: 'en',
      includedLanguages: TRANSLATION_LANGUAGES.map(language => language.value).join(','),
      autoDisplay: false
    }, 'google_translate_element');

    applyTranslation(localStorage.getItem(TRANSLATION_STORAGE_KEY) || 'en');
  };

  const widgetContainer = document.createElement('div');
  widgetContainer.id = 'google_translate_element';
  widgetContainer.className = 'translate-widget notranslate';
  widgetContainer.setAttribute('translate', 'no');
  document.body.appendChild(widgetContainer);

  const script = document.createElement('script');
  script.id = 'googleTranslateScript';
  script.src = 'https://translate.google.com/translate_a/element.js?cb=googleTranslateElementInit';
  script.async = true;
  document.body.appendChild(script);
}

injectLanguageSwitcher();
loadTranslateWidget();

// ===== SHOW ALERT =====
function showAlert(containerId, message, type = 'info') {
  const el = document.getElementById(containerId);
  if (!el) return;
  el.innerHTML = `<div class="alert alert-${type}">${message}</div>`;
  setTimeout(() => { el.innerHTML = ''; }, 4000);
}

function formatShortDate(rawDate) {
  const value = String(rawDate || '').trim();
  if (!value) return '';
  const parsed = new Date(`${value}T00:00:00`);
  if (Number.isNaN(parsed.getTime())) return value;
  return parsed.toLocaleDateString('en-IN', { day: '2-digit', month: 'short', year: 'numeric' });
}

// ===== EQUIPMENT CARD RENDERER =====
function renderEquipmentCard(eq) {
  const icons = {
    tractor: '🚜', harvester: '🌾', rotavator: '⚙️',
    sprayer: '💧', thresher: '🌿', plough: '🔧', seeder: '🌱', pump: '🪣'
  };
  const isAvailable = eq.available !== false;
  const icon = icons[eq.category] || '🚜';
  const imageHtml = eq.image_url
    ? `<img src="${eq.image_url}" alt="${eq.name}" loading="lazy" onerror="this.outerHTML='${icon}'"/>`
    : icon;
  const distanceHtml = typeof eq.distance_km === 'number'
    ? `<span><i class="fa-solid fa-route"></i> ${eq.distance_km.toFixed(1)} km</span>`
    : '';
  const canViewAvailabilityStatus = isFarmerLoggedIn();
  const ratingAvg = Number(eq.rating_avg || 0);
  const ratingCount = Number(eq.rating_count || 0);
  const ratingHtml = ratingCount > 0
    ? `<span><i class="fa-solid fa-star" style="color:#f59e0b"></i> ${ratingAvg.toFixed(1)} (${ratingCount})</span>`
    : '<span><i class="fa-regular fa-star" style="color:#9ca3af"></i> No ratings</span>';
  const bookedDays = Number(eq.unavailable_booked_days || 0);
  const availableOn = eq.unavailable_until_label || formatShortDate(eq.unavailable_until_date);
  const unavailableNote = bookedDays > 0 && availableOn
    ? `Booked for ${bookedDays} day${bookedDays === 1 ? '' : 's'}. Available on ${availableOn}.`
    : (availableOn ? `Booked now. Available on ${availableOn}.` : 'Already booked. You can view details for alternatives.');
  const availabilityHtml = isAvailable
    ? '<span class="badge badge-green">Available</span>'
    : '<span class="badge badge-red">Unavailable</span>';
  const ctaLabel = canViewAvailabilityStatus
    ? (isAvailable ? 'View & Book' : 'View Details')
    : 'View Details';
  return `
    <div class="equipment-card" onclick="window.location.href='/pages/equipment-detail.html?id=${eq._id}'">
      <div class="card-img">${imageHtml}</div>
      <div class="card-body">
        <div class="card-title">${eq.name}</div>
        <div class="card-meta">
          <span><i class="fa-solid fa-location-dot"></i> ${eq.location}</span>
          ${distanceHtml}
          <span class="badge badge-green">${eq.category}</span>
          ${ratingHtml}
          ${canViewAvailabilityStatus ? availabilityHtml : ''}
        </div>
        ${canViewAvailabilityStatus && !isAvailable ? `<div class="card-unavailable-note">${unavailableNote}</div>` : ''}
        <div class="card-price">₹${eq.price_per_day}<span>/day</span></div>
        <button class="btn-green" style="width:100%" onclick="event.stopPropagation();window.location.href='/pages/equipment-detail.html?id=${eq._id}'">
          <i class="fa-solid fa-calendar-check"></i> ${ctaLabel}
        </button>
      </div>
    </div>
  `;
}

// ===== SEARCH REDIRECT =====
function searchEquipment() {
  const eq = document.getElementById('searchInput')?.value || '';
  const loc = document.getElementById('locationInput')?.value || '';
  window.location.href = `/pages/equipment.html?search=${encodeURIComponent(eq)}&location=${encodeURIComponent(loc)}`;
}

// ===== COUNTER ANIMATION =====
function animateCounter(el, target, suffix = '') {
  let count = 0;
  const step = Math.ceil(target / 60);
  const timer = setInterval(() => {
    count += step;
    if (count >= target) { count = target; clearInterval(timer); }
    el.textContent = count + suffix;
  }, 30);
}
