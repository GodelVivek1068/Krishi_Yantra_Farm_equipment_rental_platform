// ===== HOME PAGE JS =====

let equipmentRefreshTimer = null;
const EQUIPMENT_REFRESH_INTERVAL = 8000; // 8 seconds

function startEquipmentRefresh() {
  if (equipmentRefreshTimer) clearInterval(equipmentRefreshTimer);
  equipmentRefreshTimer = setInterval(() => {
    if (document.hidden) return;
    loadFeaturedEquipment();
  }, EQUIPMENT_REFRESH_INTERVAL);
}

function stopEquipmentRefresh() {
  if (equipmentRefreshTimer) {
    clearInterval(equipmentRefreshTimer);
    equipmentRefreshTimer = null;
  }
}

document.addEventListener('visibilitychange', () => {
  if (document.hidden) stopEquipmentRefresh();
  else startEquipmentRefresh();
});

window.addEventListener('load', async () => {
  animateCounter(document.getElementById('statEquip'), 120, '+');
  animateCounter(document.getElementById('statOwners'), 85, '+');
  animateCounter(document.getElementById('statRentals'), 430, '+');
  loadFeaturedEquipment();
  startEquipmentRefresh();
  // Load default service tab (Workers) on page load
  loadWorkerPreview();
});

// ============================================================
// FEATURED EQUIPMENT
// ============================================================
async function loadFeaturedEquipment() {
  const grid = document.getElementById('featuredGrid');
  if (!grid) return;
  try {
    const res = await apiCall('GET', '/equipment/?limit=8');
    if (res.equipment && res.equipment.length > 0) {
      grid.innerHTML = res.equipment.map(renderEquipmentCard).join('');
    } else {
      grid.innerHTML = '<div class="no-results"><i class="fa-solid fa-box-open"></i>No equipment available right now.</div>';
    }
  } catch (e) {
    grid.innerHTML = `<div class="no-results"><i class="fa-solid fa-plug-circle-xmark"></i>${e.message || 'Unable to connect to backend.'}</div>`;
  }
}

// ============================================================
// SERVICE TAB SWITCHER
// ============================================================
const SERVICE_PANELS = ['worker', 'transport', 'fertilizer'];
const _svcLoaded = {};

function switchServiceTab(tab) {
  SERVICE_PANELS.forEach(t => {
    const panel = document.getElementById('svcPanel' + t.charAt(0).toUpperCase() + t.slice(1));
    const btn   = document.getElementById('svcTab'   + t.charAt(0).toUpperCase() + t.slice(1));
    if (panel) panel.style.display = (t === tab) ? '' : 'none';
    if (btn)   btn.classList.toggle('active', t === tab);
  });
  if (!_svcLoaded[tab]) {
    _svcLoaded[tab] = true;
    if (tab === 'worker')     loadWorkerPreview();
    if (tab === 'transport')  loadTransportPreview();
    if (tab === 'fertilizer') loadFertilizerPreview();
  }
}

// ============================================================
// WORKERS PREVIEW  =>  GET /api/kamgar/profiles?limit=4
// ============================================================
async function loadWorkerPreview() {
  const grid = document.getElementById('workerPreviewGrid');
  if (!grid) return;
  grid.innerHTML = '<div class="svc-loading"><i class="fa-solid fa-spinner fa-spin"></i> Loading workers...</div>';
  try {
    const res = await apiCall('GET', '/kamgar/profiles?limit=4&available_only=false');
    const workers = res.workers || [];
    if (!workers.length) {
      grid.innerHTML = '<div class="svc-empty"><i class="fa-solid fa-user-slash"></i> No workers listed yet.</div>';
      return;
    }
    grid.innerHTML = workers.map(function(w) {
      const initials = (w.name || 'W').split(' ').map(function(p){ return p[0]; }).slice(0,2).join('').toUpperCase();
      const skills = (w.skills || []).slice(0,3).map(function(s){ return '<span class="svc-pill">' + s + '</span>'; }).join('');
      const avail = w.available
        ? '<span class="svc-badge svc-badge-green"><i class="fa-solid fa-circle-check"></i> Available</span>'
        : '<span class="svc-badge svc-badge-red"><i class="fa-solid fa-calendar-day"></i> Busy</span>';
      return '<div class="svc-card" onclick="window.location.href=\'pages/worker-detail.html?id=' + w.id + '\'">'
        + '<div class="svc-card-top">'
        +   '<div class="svc-avatar">' + initials + '</div>'
        +   '<div class="svc-info">'
        +     '<div class="svc-name">' + (w.name || 'Worker') + '</div>'
        +     '<div class="svc-meta"><i class="fa-solid fa-location-dot"></i> ' + (w.location || 'Location N/A') + '</div>'
        +   '</div>'
        +   avail
        + '</div>'
        + '<div class="svc-pills">' + skills + '</div>'
        + '<div class="svc-meta"><i class="fa-solid fa-briefcase"></i> ' + (w.experience_years || 0) + ' yrs exp</div>'
        + '<div class="svc-price">&#8377;' + Number(w.hourly_rate || 0) + ' <span>/ hour</span></div>'
        + '<button class="btn-green svc-cta" onclick="event.stopPropagation();window.location.href=\'pages/worker-detail.html?id=' + w.id + '\'">'
        +   (w.available ? 'Hire Now' : 'View Profile') + ' <i class="fa-solid fa-arrow-right"></i>'
        + '</button>'
        + '</div>';
    }).join('');
  } catch (e) {
    grid.innerHTML = '<div class="svc-empty"><i class="fa-solid fa-plug-circle-xmark"></i> ' + (e.message || 'Unable to fetch workers.') + '</div>';
  }
}

// ============================================================
// TRANSPORT PREVIEW  =>  GET /api/transport/?limit=4
// ============================================================
async function loadTransportPreview() {
  const grid = document.getElementById('transportPreviewGrid');
  if (!grid) return;
  grid.innerHTML = '<div class="svc-loading"><i class="fa-solid fa-spinner fa-spin"></i> Loading transport...</div>';
  try {
    const res = await apiCall('GET', '/transport/?limit=4&available_only=false');
    const vehicles = res.transport || [];
    if (!vehicles.length) {
      grid.innerHTML = '<div class="svc-empty"><i class="fa-solid fa-truck"></i> No vehicles listed yet.</div>';
      return;
    }
    grid.innerHTML = vehicles.map(function(v) {
      const initials = (v.name || 'T').split(' ').map(function(p){ return p[0]; }).slice(0,2).join('').toUpperCase();
      const avail = v.available
        ? '<span class="svc-badge svc-badge-green"><i class="fa-solid fa-circle-check"></i> Available</span>'
        : '<span class="svc-badge svc-badge-red"><i class="fa-solid fa-calendar-day"></i> Busy</span>';
      return '<div class="svc-card" onclick="window.location.href=\'pages/transport-detail.html?id=' + v._id + '\'">'
        + '<div class="svc-card-top">'
        +   '<div class="svc-avatar svc-avatar-blue">' + initials + '</div>'
        +   '<div class="svc-info">'
        +     '<div class="svc-name">' + (v.name || 'Vehicle') + '</div>'
        +     '<div class="svc-meta"><i class="fa-solid fa-location-dot"></i> ' + (v.location || 'Location N/A') + '</div>'
        +   '</div>'
        +   avail
        + '</div>'
        + '<div class="svc-pills"><span class="svc-pill">' + (v.vehicle_type || 'Transport') + '</span></div>'
        + '<div class="svc-meta"><i class="fa-solid fa-weight-hanging"></i> ' + (v.capacity || 'Capacity N/A') + '</div>'
        + '<div class="svc-price">&#8377;' + Number(v.price_per_day || 0) + ' <span>/ day</span></div>'
        + '<button class="btn-green svc-cta" onclick="event.stopPropagation();window.location.href=\'pages/transport-detail.html?id=' + v._id + '\'">'
        +   (v.available ? 'Book Now' : 'View Details') + ' <i class="fa-solid fa-arrow-right"></i>'
        + '</button>'
        + '</div>';
    }).join('');
  } catch (e) {
    grid.innerHTML = '<div class="svc-empty"><i class="fa-solid fa-plug-circle-xmark"></i> ' + (e.message || 'Unable to fetch transport.') + '</div>';
  }
}

// ============================================================
// FERTILIZER PREVIEW  =>  GET /api/fertilizer/products?limit=4
// ============================================================
async function loadFertilizerPreview() {
  const grid = document.getElementById('fertilizerPreviewGrid');
  if (!grid) return;
  grid.innerHTML = '<div class="svc-loading"><i class="fa-solid fa-spinner fa-spin"></i> Loading products...</div>';
  try {
    const res = await apiCall('GET', '/fertilizer/products?limit=4');
    const products = res.products || [];
    if (!products.length) {
      grid.innerHTML = '<div class="svc-empty"><i class="fa-solid fa-box-open"></i> No products listed yet.</div>';
      return;
    }
    grid.innerHTML = products.map(function(p) {
      const avail = p.available
        ? '<span class="svc-badge svc-badge-green"><i class="fa-solid fa-circle-check"></i> In Stock</span>'
        : '<span class="svc-badge svc-badge-red"><i class="fa-solid fa-xmark-circle"></i> Out of Stock</span>';
      return '<div class="svc-card" onclick="window.location.href=\'pages/fertilizer-detail.html?id=' + p.id + '\'">'
        + '<div class="svc-card-top">'
        +   '<div class="svc-avatar svc-avatar-amber">&#127807;</div>'
        +   '<div class="svc-info">'
        +     '<div class="svc-name">' + (p.name || 'Product') + '</div>'
        +     '<div class="svc-meta"><i class="fa-solid fa-industry"></i> ' + (p.brand || 'Local Supplier') + '</div>'
        +   '</div>'
        +   avail
        + '</div>'
        + '<div class="svc-pills">'
        +   '<span class="svc-pill">' + (p.category || 'fertilizer') + '</span>'
        +   '<span class="svc-pill">' + (p.variant || 'Standard') + '</span>'
        + '</div>'
        + '<div class="svc-meta"><i class="fa-solid fa-location-dot"></i> ' + (p.location || 'Location N/A') + '</div>'
        + '<div class="svc-meta"><i class="fa-solid fa-boxes-stacked"></i> Stock: ' + (p.stock_available || 0) + ' bags</div>'
        + '<div class="svc-price">&#8377;' + Number(p.price_per_bag || 0) + ' <span>/ bag</span></div>'
        + '<button class="btn-green svc-cta" onclick="event.stopPropagation();window.location.href=\'pages/fertilizer-detail.html?id=' + p.id + '\'">'
        +   (p.available ? 'Book Now' : 'View Details') + ' <i class="fa-solid fa-arrow-right"></i>'
        + '</button>'
        + '</div>';
    }).join('');
  } catch (e) {
    grid.innerHTML = '<div class="svc-empty"><i class="fa-solid fa-plug-circle-xmark"></i> ' + (e.message || 'Unable to fetch products.') + '</div>';
  }
}
