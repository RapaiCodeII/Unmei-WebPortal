/* Unmei Global Search - Admin Portal (PHASE 13)
   MS Teams-style Ctrl+K universal search over live RTDB data.
   Role-scoped: students / courses / payments / enrollments / instructors / announcements.
   Self-contained: injects its own styles, header button and overlay. */
(function () {
  'use strict';
  if (window.__unmeiGlobalSearch) return;
  window.__unmeiGlobalSearch = true;

  /* ---------- styles ---------- */
  var css = [
    '.ugs-btn{display:inline-flex;align-items:center;gap:6px;background:#fff;border:1px solid #e5e7eb;',
    'border-radius:8px;padding:7px 12px;font-size:.8rem;color:#6b7280;cursor:pointer;font-family:inherit;}',
    '.ugs-btn:hover{border-color:#C0392B;color:#C0392B;}',
    '.ugs-btn kbd{font-family:inherit;font-size:.68rem;border:1px solid #e5e7eb;border-radius:4px;padding:1px 5px;color:#9ca3af;}',
    '.ugs-overlay{position:fixed;inset:0;z-index:9999;background:rgba(17,24,39,.45);backdrop-filter:blur(2px);',
    'display:none;align-items:flex-start;justify-content:center;padding:10vh 16px 16px;}',
    '.ugs-overlay.active{display:flex;}',
    '.ugs-panel{background:#fff;width:100%;max-width:640px;border-radius:14px;box-shadow:0 24px 64px rgba(0,0,0,.25);overflow:hidden;}',
    '.ugs-inputrow{display:flex;align-items:center;gap:10px;padding:14px 18px;border-bottom:1px solid #f3f4f6;}',
    '.ugs-inputrow iconify-icon{color:#9ca3af;font-size:20px;}',
    '.ugs-input{flex:1;border:none;outline:none;font-size:1rem;color:#111827;font-family:inherit;background:transparent;}',
    '.ugs-hint{font-size:.65rem;color:#9ca3af;border:1px solid #e5e7eb;border-radius:4px;padding:2px 6px;white-space:nowrap;}',
    '.ugs-results{max-height:56vh;overflow-y:auto;padding:6px 0;}',
    '.ugs-group{padding:8px 18px 4px;font-size:.66rem;font-weight:700;letter-spacing:.08em;text-transform:uppercase;color:#9ca3af;}',
    '.ugs-item{display:flex;align-items:flex-start;gap:10px;padding:9px 18px;cursor:pointer;}',
    '.ugs-item:hover,.ugs-item.sel{background:#fef2f2;}',
    '.ugs-item iconify-icon{color:#C0392B;margin-top:2px;}',
    '.ugs-item .t{font-size:.88rem;font-weight:600;color:#111827;}',
    '.ugs-item .s{font-size:.74rem;color:#6b7280;margin-top:1px;}',
    '.ugs-empty{padding:28px;text-align:center;color:#9ca3af;font-size:.85rem;}',
    '.ugs-expand{padding:10px 18px 14px;background:#f9fafb;border-top:1px dashed #e5e7eb;font-size:.82rem;color:#374151;line-height:1.55;white-space:pre-wrap;}',
    '@media (max-width:640px){.ugs-btn span.ugs-label,.ugs-btn kbd{display:none;}.ugs-panel{margin-top:0;}}'
  ].join('');
  var st = document.createElement('style');
  st.textContent = css;
  document.head.appendChild(st);

  /* ---------- header button ---------- */
  function injectButton() {
    var host = document.querySelector('.topbar__right') || document.querySelector('header.topbar') || document.querySelector('header');
    if (!host) { setTimeout(injectButton, 400); return; }
    var btn = document.createElement('button');
    btn.className = 'ugs-btn';
    btn.type = 'button';
    btn.setAttribute('aria-label', 'Search (Ctrl+K)');
    btn.innerHTML = '<iconify-icon icon="mdi:magnify"></iconify-icon><span class="ugs-label">Search</span><kbd>Ctrl K</kbd>';
    btn.addEventListener('click', open);
    host.insertBefore(btn, host.firstChild);
  }

  /* ---------- overlay ---------- */
  var overlay, input, resultsEl, lastGroups = [], selIdx = -1, flatItems = [];

  function buildOverlay() {
    overlay = document.createElement('div');
    overlay.className = 'ugs-overlay';
    overlay.innerHTML =
      '<div class="ugs-panel">' +
        '<div class="ugs-inputrow">' +
          '<iconify-icon icon="mdi:magnify"></iconify-icon>' +
          '<input class="ugs-input" type="text" placeholder="Search students, courses, payments, enrollments, instructors, announcements..." autocomplete="off"/>' +
          '<span class="ugs-hint">ESC</span>' +
        '</div>' +
        '<div class="ugs-results"></div>' +
      '</div>';
    document.body.appendChild(overlay);
    input = overlay.querySelector('.ugs-input');
    resultsEl = overlay.querySelector('.ugs-results');
    overlay.addEventListener('click', function (e) { if (e.target === overlay) close(); });
    var deb;
    input.addEventListener('input', function () {
      clearTimeout(deb);
      deb = setTimeout(function () { runSearch(input.value.trim()); }, 180);
    });
    input.addEventListener('keydown', function (e) {
      if (e.key === 'ArrowDown' || e.key === 'ArrowUp') {
        e.preventDefault();
        if (!flatItems.length) return;
        selIdx = e.key === 'ArrowDown' ? Math.min(selIdx + 1, flatItems.length - 1) : Math.max(selIdx - 1, 0);
        paintSelection();
      } else if (e.key === 'Enter') {
        e.preventDefault();
        if (selIdx >= 0 && flatItems[selIdx]) activate(flatItems[selIdx]);
      }
    });
  }
  /* ---------- open / close ---------- */
  function open() {
    overlay.classList.add('active');
    document.body.style.overflow = 'hidden';
    input.value = '';
    input.focus();
    runSearch('');
  }
  function close() {
    overlay.classList.remove('active');
    document.body.style.overflow = '';
  }
  document.addEventListener('keydown', function (e) {
    if ((e.ctrlKey || e.metaKey) && String(e.key).toLowerCase() === 'k') {
      e.preventDefault();
      overlay.classList.contains('active') ? close() : open();
    } else if (e.key === 'Escape' && overlay.classList.contains('active')) {
      close();
    }
  });

  /* ---------- data providers (live RTDB) ---------- */
  function once(node) { return database.ref(node).once('value'); }
  function match(hay, q) { return String(hay || '').toLowerCase().indexOf(q) !== -1; }

  function fetchGroups(q) {
    return Promise.all([
      once('students'), once('courses'), once('payments'),
      once('enrollments'), once('instructors'), once('announcements')
    ]).then(function (r) {
      var students = r[0].val() || {}, courses = r[1].val() || {},
          payments = r[2].val() || {}, enrollments = r[3].val() || {},
          instructors = r[4].val() || {}, announcements = r[5].val() || {};
      var groups = [];
      if (!q) return groups;

      var stu = [];
      Object.keys(students).forEach(function (uid) {
        var s = students[uid];
        if (!s || s.isDeleted) return;
        var p = s.profile || {}, e = s.enrollment || {};
        if (match(p.fullName, q) || match(p.email, q) || match(e.studentId, q)) {
          stu.push({ label: p.fullName || uid, sub: (e.course || 'No course') + ' - ' + (p.email || ''), href: 'admin-students.html?student=' + encodeURIComponent(uid) });
        }
      });
      if (stu.length) groups.push({ name: 'Students', items: stu.slice(0, 6) });

      var cor = [];
      Object.keys(courses).forEach(function (id) {
        var c = courses[id];
        if (match(c.name, q) || match(c.description, q)) {
          cor.push({ label: c.name || id, sub: (c.duration || '') + ' - PHP ' + Number(c.price || 0).toLocaleString(), href: 'admin-course-view.html?id=' + encodeURIComponent(id) });
        }
      });
      if (cor.length) groups.push({ name: 'Courses', items: cor.slice(0, 6) });

      var pay = [];
      Object.keys(payments).forEach(function (k) {
        var pm = payments[k];
        if (match(pm.studentName, q) || match(pm.studentEmail, q) || match(pm.course, q)) {
          pay.push({ label: (pm.studentName || 'Payment') + ' - PHP ' + Number(pm.amount || 0).toLocaleString(), sub: (pm.status || '') + ' / ' + (pm.adminApprovalStatus || ''), href: 'admin-payments.html' });
        }
      });
      if (pay.length) groups.push({ name: 'Payments', items: pay.slice(0, 6) });

      var enr = [];
      Object.keys(enrollments).forEach(function (k) {
        var e = enrollments[k];
        if (match(e.fullName, q) || match(e.email, q) || match(e.course, q)) {
          enr.push({ label: e.fullName || 'Enrollment', sub: (e.course || '') + ' - ' + (e.status || ''), href: 'admin-enrollments.html' });
        }
      });
      if (enr.length) groups.push({ name: 'Enrollments', items: enr.slice(0, 6) });

      window.__ugsCtx = { instructors: instructors, announcements: announcements };
      return fetchGroupsRest(q, groups);
    });
  }

  function fetchGroupsRest(q, groups) {
    var ctx = window.__ugsCtx || {};
    var instructors = ctx.instructors || {}, announcements = ctx.announcements || {};

    var ins = [];
    Object.keys(instructors).forEach(function (k) {
      var i = instructors[k];
      if (match(i.fullName, q) || match(i.specialization, q) || match(i.email, q)) {
        var firstCourse = (Array.isArray(i.coursesAssigned) && i.coursesAssigned[0]) || '';
        ins.push({ label: i.fullName || k, sub: (i.specialization || '') + (firstCourse ? ' - view via ' + firstCourse : ''), href: firstCourse ? 'admin-course-view.html?id=' + encodeURIComponent(firstCourse) : '' });
      }
    });
    if (ins.length) groups.push({ name: 'Instructors', items: ins.slice(0, 6) });

    var ann = [];
    Object.keys(announcements).forEach(function (k) {
      var a = announcements[k];
      if (match(a.title, q) || match(a.message, q)) {
        ann.push({ label: a.title || 'Announcement', sub: String(a.message || '').slice(0, 90), expandText: (a.title || '') + '\n\n' + (a.message || '') });
      }
    });
    if (ann.length) groups.push({ name: 'Announcements', items: ann.slice(0, 6) });
    return groups;
  }

  function paintSelection() {
    var items = resultsEl.querySelectorAll('.ugs-item');
    items.forEach(function (el, i) { el.classList.toggle('sel', i === selIdx); });
    var sel = resultsEl.querySelector('.ugs-item.sel');
    if (sel) sel.scrollIntoView({ block: 'nearest' });
  }

  /* ---------- feature index (phone-settings-style deep search) ---------- */
  var PAGES = [
    { t: 'Dashboard', kw: 'home overview stats summary analytics counts revenue enrolled pending', sec: 'Overview', href: 'admin-dashboard.html', icon: 'mdi:view-dashboard-outline' },
    { t: 'Students', kw: 'students roster records search manage view performance progress profile', sec: 'Records', href: 'admin-students.html', icon: 'mdi:account-multiple-outline' },
    { t: 'Add Student', kw: 'add create new student register enroll wizard account', sec: 'Records', href: 'admin-add-student.html', icon: 'mdi-account-plus-outline' },
    { t: 'Enrollments', kw: 'enrollments applications status assessment pending approve wantCall contact preference', sec: 'Records', href: 'admin-enrollments.html', icon: 'mdi-clipboard-text-outline' },
    { t: 'New Enrollment', kw: 'new enrollment create application register walk-in', sec: 'Records', href: 'admin-new-enrollment.html', icon: 'mdi-clipboard-plus-outline' },
    { t: 'Payments', kw: 'payments tuition receipt verify approve cash balance revenue finance fees upload', sec: 'Finance', href: 'admin-payments.html', icon: 'mdi-cash-multiple' },
    { t: 'Courses', kw: 'courses view jlpt n5 n4 n3 n2 bundle price duration enrolled instructor', sec: 'Academics', href: 'admin-courses.html', icon: 'mdi-book-open-variant' },
    { t: 'Course View', kw: 'course view detail roster instructor rating deep link', sec: 'Academics', href: 'admin-course-view.html', icon: 'mdi-book-search-outline' },
    { t: 'Sections', kw: 'sections classes schedules rooms slots create assign', sec: 'Academics', href: 'admin-sections.html', icon: 'mdi-google-classroom' },
    { t: 'Instructor Accounts', kw: 'instructor accounts professors teachers add manage credentials specialization', sec: 'People', href: 'admin-instructors.html', icon: 'mdi-account-tie' },
    { t: 'Post Notice / Announcements', kw: 'post notice announcement publish news broadcast update', sec: 'School Updates', href: 'admin-post-notice.html', icon: 'mdi-bullhorn-outline' },
    { t: 'Messages / Contact Leads', kw: 'messages inbox contact leads inquiries callback wantCall email phone', sec: 'Communication', href: 'admin-messages.html', icon: 'mdi-email-outline' },
    { t: 'Portal Settings', kw: 'settings configuration preferences maintenance portal system toggle', sec: 'System', href: 'admin-portal-settings.html', icon: 'mdi-cog-outline' }
  ];

  function featHits(q) {
    var ql = q.toLowerCase();
    var toks = ql.split(/\s+/).filter(Boolean);
    var hits = [];
    PAGES.forEach(function (p) {
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

  function featureGroups(q) {
    var hits = featHits(q);
    var groups = [];
    if (hits.length) {
      groups.push({ name: 'Best Match', items: [{
        label: hits[0].t,
        sub: 'Under ' + hits[0].sec,
        href: hits[0].href
      }]});
      if (hits.length > 1) {
        groups.push({ name: 'Pages and Functions', items: hits.slice(1, 7).map(function (p) {
          return { label: p.t, sub: 'Under ' + p.sec, href: p.href };
        })});
      }
    }
    groups.push({ name: 'General', items: [{
      label: "General — everything for '" + q + "'",
      sub: hits.length ? ('See also: ' + hits[0].sec + ' hub') : 'Open the dashboard hub to browse all functions',
      href: 'admin-dashboard.html'
    }]});
    return groups;
  }

  /* ---------- render / activate ---------- */
  var icons = { 'Best Match': 'mdi:star-four-points-outline', 'Pages and Functions': 'mdi:magnify', 'General': 'mdi:apps', Students: 'mdi:account-outline', Courses: 'mdi:book-open-variant', Payments: 'mdi:cash-multiple', Enrollments: 'mdi:clipboard-text-outline', Instructors: 'mdi:account-tie', Announcements: 'mdi:bell-outline' };

  function runSearch(q) {
    selIdx = -1; flatItems = [];
    if (!q) {
      resultsEl.innerHTML = '<div class="ugs-empty">Type to search pages, students, courses, payments, enrollments, instructors and announcements.</div>';
      return;
    }
    var feature = featureGroups(q);
    fetchGroups(q).then(function (groups) {
      groups = feature.concat(groups);

      var html = '', count = 0;
      groups.forEach(function (g) {
        html += '<div class="ugs-group">' + g.name + '</div>';
        g.items.forEach(function (it) {
          var idx = flatItems.length;
          flatItems.push(it);
          html += '<div class="ugs-item" data-idx="' + idx + '">' +
            '<iconify-icon icon="' + (icons[g.name] || 'mdi:magnify') + '"></iconify-icon>' +
            '<div><div class="t">' + escapeHtml_(it.label) + '</div>' +
            '<div class="s">' + escapeHtml_(it.sub || '') + '</div></div></div>';
          count++;
        });
      });
      resultsEl.innerHTML = count
        ? html
        : '<div class="ugs-empty">No results for "' + escapeHtml_(q) + '"</div>';
      resultsEl.querySelectorAll('.ugs-item').forEach(function (el) {
        el.addEventListener('click', function () { activate(flatItems[Number(el.getAttribute('data-idx'))]); });
      });
      selIdx = flatItems.length ? 0 : -1;
      paintSelection();
    }).catch(function (err) {
      console.error('[global-search] load failed:', err);
      resultsEl.innerHTML = '<div class="ugs-empty">Search failed to load data. Check connection.</div>';
    });
  }

  function activate(item) {
    if (!item) return;
    if (item.expandText) {
      var box = resultsEl.querySelector('.ugs-expand');
      if (box && box.textContent === item.expandText) { box.remove(); return; }
      if (box) box.remove();
      var d = document.createElement('div');
      d.className = 'ugs-expand';
      d.textContent = item.expandText;
      resultsEl.appendChild(d);
      return;
    }
    if (item.href) window.location.href = item.href;
  }

  function escapeHtml_(v) {
    return String(v == null ? '' : v)
      .replace(/&/g, '&amp;').replace(/</g, '&lt;')
      .replace(/>/g, '&gt;').replace(/"/g, '&quot;');
  }

  /* ---------- boot ---------- */
  window.__unmeiOpenGlobalSearch = function () { open(); };
  function boot() { injectButton(); buildOverlay(); }
  if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', boot);
  else boot();
})();
