// ===== SHARED AUTH UTILITY =====
// Used by all KrishiYantra login pages

const AuthUtils = (() => {
  const MAX_ATTEMPTS  = 5;
  const LOCKOUT_MS    = 2 * 60 * 1000; // 2 minutes
  const STORAGE_KEY   = 'ky_login_attempts';

  // ── Attempt tracking ──
  function getAttemptData() {
    try { return JSON.parse(localStorage.getItem(STORAGE_KEY)) || {}; } catch(e) { return {}; }
  }
  function saveAttemptData(d) {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(d));
  }
  function recordFailed() {
    const d = getAttemptData();
    d.count = (d.count || 0) + 1;
    d.lastAttempt = Date.now();
    if (d.count >= MAX_ATTEMPTS) d.lockedUntil = Date.now() + LOCKOUT_MS;
    saveAttemptData(d);
    return d;
  }
  function resetAttempts() { localStorage.removeItem(STORAGE_KEY); }
  function getLockoutMs() {
    const d = getAttemptData();
    if (d.lockedUntil && Date.now() < d.lockedUntil) return d.lockedUntil - Date.now();
    if (d.lockedUntil) resetAttempts();
    return 0;
  }

  // ── Alert ──
  function showAlert(alertId, msg, type) {
    const box = document.getElementById(alertId);
    if (!box) return;
    box.className = 'auth-alert show-' + type;
    const icon = box.querySelector('i');
    if (icon) icon.className = type === 'error'
      ? 'fa-solid fa-circle-exclamation'
      : (type === 'warning' ? 'fa-solid fa-triangle-exclamation' : 'fa-solid fa-circle-check');
    const span = box.querySelector('span');
    if (span) span.textContent = msg;
  }
  function clearAlert(alertId) {
    const box = document.getElementById(alertId);
    if (box) box.className = 'auth-alert';
  }

  // ── Attempt info display ──
  function updateAttemptInfo(infoId) {
    const el = document.getElementById(infoId);
    if (!el) return;
    const d = getAttemptData();
    const remaining = MAX_ATTEMPTS - (d.count || 0);
    if (d.count > 0 && !d.lockedUntil) {
      el.textContent = remaining + ' attempt' + (remaining !== 1 ? 's' : '') + ' remaining before lockout';
      el.style.color = remaining <= 2 ? '#ef4444' : '#9ca3af';
    } else { el.textContent = ''; }
  }

  // ── Lockout countdown ──
  function startLockout(btnId, barId, fillId, textId, iconId, resumeText, resumeIcon) {
    const btn  = document.getElementById(btnId);
    const bar  = document.getElementById(barId);
    const fill = document.getElementById(fillId);
    if (!btn) return;
    btn.disabled = true;
    if (bar) bar.style.display = 'block';

    function tick() {
      const left = getLockoutMs();
      if (left <= 0) {
        btn.disabled = false;
        if (bar) bar.style.display = 'none';
        const t = document.getElementById(textId);
        const ic = document.getElementById(iconId);
        if (t) t.textContent = resumeText || 'Sign In';
        if (ic) ic.className = resumeIcon || 'fa-solid fa-right-to-bracket';
        return;
      }
      const secs = Math.ceil(left / 1000);
      const t = document.getElementById(textId);
      if (t) t.textContent = 'Locked — wait ' + secs + 's';
      if (fill) fill.style.width = ((left / LOCKOUT_MS) * 100) + '%';
      setTimeout(tick, 500);
    }
    tick();
  }

  // ── Password toggle ──
  function bindPasswordToggle(inputId, btnId, iconId) {
    const btn = document.getElementById(btnId);
    if (!btn) return;
    btn.addEventListener('click', () => {
      const inp  = document.getElementById(inputId);
      const icon = document.getElementById(iconId);
      if (!inp) return;
      const show = inp.type === 'password';
      inp.type = show ? 'text' : 'password';
      if (icon) icon.className = show ? 'fa-regular fa-eye-slash' : 'fa-regular fa-eye';
    });
  }

  // ── Email validation ──
  function isValidEmail(email) {
    return /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email.trim());
  }

  // ── Set button loading state ──
  function setLoading(btnId, textId, iconId, loading) {
    const btn  = document.getElementById(btnId);
    const text = document.getElementById(textId);
    const icon = document.getElementById(iconId);
    const spinnerId = btnId + '_spinner';
    if (loading) {
      if (btn)  btn.disabled = true;
      if (text) text.textContent = 'Signing in...';
      if (icon) icon.className = '';
      let sp = document.getElementById(spinnerId);
      if (!sp && btn) {
        sp = document.createElement('div');
        sp.className = 'auth-spinner';
        sp.id = spinnerId;
        btn.insertBefore(sp, btn.firstChild);
      }
    } else {
      if (btn)  btn.disabled = false;
      const sp = document.getElementById(spinnerId);
      if (sp && sp.parentNode) sp.remove();
    }
  }

  // ── Save session ──
  function saveSession(res) {
    localStorage.setItem('token', res.token);
    localStorage.setItem('user', JSON.stringify(res.user));
  }

  // ── Redirect with fallback ──
  function redirectAfterLogin(fallback) {
    const redirect = new URLSearchParams(window.location.search).get('redirect');
    window.location.href = redirect || fallback;
  }

  return {
    MAX_ATTEMPTS, LOCKOUT_MS,
    getAttemptData, recordFailed, resetAttempts, getLockoutMs,
    showAlert, clearAlert, updateAttemptInfo, startLockout,
    bindPasswordToggle, isValidEmail, setLoading, saveSession, redirectAfterLogin
  };
})();
