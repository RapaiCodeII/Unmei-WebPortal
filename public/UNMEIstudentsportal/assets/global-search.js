/* Unmei Global Search - Student Portal (PHASE 13)
   Privacy-scoped Ctrl+K search: indexes ONLY the student's own portal pages.
   Never reads or exposes other students' records. */
(function () {
  'use strict';
  if (window.__unmeiGlobalSearch) return;
  window.__unmeiGlobalSearch = true;

  var css = [
    '.ugs-btn{display:inline-flex;align-items:center;gap:6px;background:#fff;border:1px solid #e5e7eb;',
    'border-radius:8px;padding:7px 12px;font-size:.8rem;color:#6b7280;cursor:pointer;font-family:inherit;}',
    '.ugs-btn:hover{border-color:#C0392B;color:#C0392B;}',
    '.ugs-btn kbd{font-family:inherit;font-size:.68rem;border:1px solid #e5e7eb;border-radius:4px;padding:1px 5px;color:#9ca3af;}',
    '.ugs-overlay{position:fixed;inset:0;z-index:9999;background:rgba(17,24,39,.45);backdrop-filter:blur(2px);',
    'display:none;align-items:flex-start;justify-content:center;padding:10vh 16px 16px;}',
    '.ugs-overlay.active{display:flex;}',
    '.ugs-panel{background:#fff;width:100%;max-width:560px;border-radius:14px;box-shadow:0 24px 64px rgba(0,0,0,.25);overflow:hidden;}',
    '.ugs-inputrow{display:flex;align-items:center;gap:10px;padding:14px 18px;border-bottom:1px solid #f3f4f6;}',
    '.ugs-inputrow iconify-icon{color:#9ca3af;font-size:20px;}',
    '.ugs-input{flex:1;border:none;outline:none;font-size:1rem;color:#111827;font-family:inherit;background:transparent;}',
    '.ugs-hint{font-size:.65rem;color:#9ca3af;border:1px solid #e5e7eb;border-radius:4px;padding:2px 6px;}',
    '.ugs-results{max-height:56vh;overflow-y:auto;padding:6px 0;}',
    '.ugs-item{display:flex;align-items:center;gap:10px;padding:10px 18px;cursor:pointer;}',
    '.ugs-item:hover,.ugs-item.sel{background:#fef2f2;}',
    '.ugs-item iconify-icon{color:#C0392B;}',
    '.ugs-item .t{font-size:.88rem;font-weight:600;color:#111827;}',
    '.ugs-empty{padding:28px;text-align:center;color:#9ca3af;font-size:.85rem;}',
    '@media (max-width:640px){.ugs-btn span.ugs-label,.ugs-btn kbd{display:none;}}'
  ].join('');
  var st = document.createElement('style');
  st.textContent = css;
  document.head.appendChild(st);

  var INDEX = [
    { t: 'Dashboard', kw: 'home overview progress welcome analytics radar trend', sec: 'Overview', href: 'dashboard.html', icon: 'mdi:view-dashboard-outline' },
    { t: 'My Courses & Scores', kw: 'courses modules lessons syllabus quiz scores performance grades evaluation instructor', sec: 'Academics', href: 'courses.html', icon: 'mdi:book-open-variant' },
    { t: 'Tuition Payments', kw: 'payments tuition receipt fees balance upload cash proof finance', sec: 'Finance', href: 'payments.html', icon: 'mdi:cash-multiple' },
    { t: 'Class Schedules', kw: 'schedules calendar classes time slots sections room days', sec: 'Academics', href: 'schedules.html', icon: 'mdi:calendar-outline' },
    { t: 'Announcements', kw: 'announcements notices news branch updates', sec: 'School Updates', href: 'announcements.html', icon: 'mdi:bell-outline' },
    { t: 'Profile', kw: 'profile personal information avatar details', sec: 'Account', href: 'profile.html', icon: 'mdi:account-outline' },
    { t: 'Settings', kw: 'settings account password preferences sign out logout verification email', sec: 'Account', href: 'settings.html', icon: 'mdi:cog-outline' },
    { t: 'Get the Mobile App', kw: 'app download apk android install kanji stylus mobile', sec: 'Resources', href: 'app-download.html', icon: 'mdi:cellphone-arrow-down' }
  ];

  var overlay, input, resultsEl, flatItems = [], selIdx = -1;

  function injectButton() {
    var host = document.querySelector('.topbar__right') || document.querySelector('.topbar') || document.querySelector('header');
    if (!host) { setTimeout(injectButton, 400); return; }
    var btn = document.createElement('button');
    btn.className = 'ugs-btn';
    btn.type = 'button';
    btn.setAttribute('aria-label', 'Search (Ctrl+K)');
    btn.innerHTML = '<iconify-icon icon="mdi:magnify"></iconify-icon><span class="ugs-label">Search</span><kbd>Ctrl K</kbd>';
    btn.addEventListener('click', open);
    host.insertBefore(btn, host.firstChild);
  }

  function buildOverlay() {
    overlay = document.createElement('div');
    overlay.className = 'ugs-overlay';
    overlay.innerHTML =
      '<div class="ugs-panel">' +
        '<div class="ugs-inputrow">' +
          '<iconify-icon icon="mdi:magnify"></iconify-icon>' +
          '<input class="ugs-input" type="text" placeholder="Search anything — pages, payments, schedules..." autocomplete="off"/>' +
          '<span class="ugs-hint">ESC</span>' +
        '</div>' +
        '<div class="ugs-results"></div>' +
      '</div>';
    document.body.appendChild(overlay);
    input = overlay.querySelector('.ugs-input');
    resultsEl = overlay.querySelector('.ugs-results');
    overlay.addEventListener('click', function (e) { if (e.target === overlay) close(); });
    input.addEventListener('input', function () { render(input.value.trim()); });
    input.addEventListener('keydown', function (e) {
      if (e.key === 'ArrowDown' || e.key === 'ArrowUp') {
        e.preventDefault();
        if (!flatItems.length) return;
        selIdx = e.key === 'ArrowDown' ? Math.min(selIdx + 1, flatItems.length - 1) : Math.max(selIdx - 1, 0);
        paint();
      } else if (e.key === 'Enter') {
        e.preventDefault();
        activate(flatItems[selIdx]);
      }
    });
  }

  function open() {
    overlay.classList.add('active');
    document.body.style.overflow = 'hidden';
    input.value = ''; render(''); input.focus();
  }
  function close() {
    overlay.classList.remove('active');
    document.body.style.overflow = '';
  }

  /* Phone-settings-style scoring: ANY keyword maps to the page containing it,
     shown with its section context. Guarantees a General result for every query. */
  function featHits(q) {
    var ql = q.toLowerCase();
    var toks = ql.split(/\s+/).filter(Boolean);
    var hits = [];
    INDEX.forEach(function (p) {
      var hay = (p.t + ' ' + p.kw).toLowerCase();
      var s = 0;
      if (p.t.toLowerCase().indexOf(ql) === 0) s = 100;
      else if (p.t.toLowerCase().indexOf(ql) !== -1) s = 80;
      else if (toks.length && toks.every(function (t) { return hay.indexOf(t) !== -1; })) s = 60;
      else if (toks.some(function (t) { return hay.indexOf(t) !== -1; })) s = 30;
      if (s > 0) hits.push({ p: p, s: s });
    });
    hits.sort(function (a, b) { return b.s - a.s; });
    return hits.map(function (h) { return h.p; });
  }

  function render(q) {
    flatItems = []; selIdx = -1;
    var hits = !q ? INDEX.slice() : featHits(q);
    var html = '';
    function pushGroup(name, items) {
      if (!items.length) return;
      html += '<div class="ugs-group">' + name + '</div>';
      items.forEach(function (pItem) {
        var idx = flatItems.length;
        flatItems.push(pItem);
        html += '<div class="ugs-item" data-idx="' + idx + '">' +
          '<iconify-icon icon="' + pItem.icon + '"></iconify-icon>' +
          '<span class="t">' + pItem.t + (pItem.sec ? ' <span style="font-weight:400;color:#9ca3af;font-size:.72rem;">— under ' + pItem.sec + '</span>' : '') + '</span></div>';
      });
    }
    if (!q) {
      pushGroup('All Pages', hits);
    } else if (hits.length) {
      pushGroup('Best Match', [hits[0]]);
      pushGroup('Pages and Functions', hits.slice(1, 7));
    }
    if (q) {
      // General result: guarantees output for ANY keyword (phone-settings pattern)
      flatItems.push({ t: "General — everything for '" + q + "'", href: 'dashboard.html' });
      html += '<div class="ugs-group">General</div>' +
        '<div class="ugs-item" data-idx="' + (flatItems.length - 1) + '">' +
        '<iconify-icon icon="mdi:apps"></iconify-icon>' +
        '<span class="t">General — everything for \'' + q.replace(/</g, '&lt;').replace(/'/g, '') + '\'</span></div>';
    }
    resultsEl.innerHTML = html || '<div class="ugs-empty">No matching pages.</div>';
    resultsEl.querySelectorAll('.ugs-item').forEach(function (el) {
      el.addEventListener('click', function () { activate(flatItems[Number(el.getAttribute('data-idx'))]); });
    });
  }

  function activate(item) { if (item && item.href) window.location.href = item.href; }
  function paint() {
    var items = resultsEl.querySelectorAll('.ugs-item');
    items.forEach(function (el, i) { el.classList.toggle('sel', i === selIdx); });
    var sel = resultsEl.querySelector('.ugs-item.sel');
    if (sel) sel.scrollIntoView({ block: 'nearest' });
  }

  document.addEventListener('keydown', function (e) {
    if ((e.ctrlKey || e.metaKey) && String(e.key).toLowerCase() === 'k') {
      e.preventDefault();
      overlay.classList.contains('active') ? close() : open();
    } else if (e.key === 'Escape' && overlay.classList.contains('active')) close();
  });

  window.__unmeiOpenGlobalSearch = function () { open(); };
  function boot() { injectButton(); buildOverlay(); render(''); }
  if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', boot);
  else boot();
})();