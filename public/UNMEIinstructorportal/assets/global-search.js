/* Unmei Global Search - Instructor Portal (PHASE 13)
   Role-scoped Ctrl+K search over the signed-in instructor's OWN data:
   students enrolled in their assigned courses, their assigned courses,
   and ratings/feedback received. Privacy: never searches other instructors'
   data or students outside assignment. */
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
    '.ugs-panel{background:#fff;width:100%;max-width:640px;border-radius:14px;box-shadow:0 24px 64px rgba(0,0,0,.25);overflow:hidden;}',
    '.ugs-inputrow{display:flex;align-items:center;gap:10px;padding:14px 18px;border-bottom:1px solid #f3f4f6;}',
    '.ugs-inputrow iconify-icon{color:#9ca3af;font-size:20px;}',
    '.ugs-input{flex:1;border:none;outline:none;font-size:1rem;color:#111827;font-family:inherit;background:transparent;}',
    '.ugs-hint{font-size:.65rem;color:#9ca3af;border:1px solid #e5e7eb;border-radius:4px;padding:2px 6px;white-space:nowrap;}',
    '.ugs-results{max-height:56vh;overflow-y:auto;padding:6px 0;}',
    '.ugs-group{padding:8px 18px 4px;font-size:.66rem;font-weight:700;letter-spacing:.08em;text-transform:uppercase;color:#9ca3af;}',
    '.ugs-item{display:flex;align-items:flex-start;gap:10px;padding:9px 18px;cursor:pointer;}',
    '.ugs-item:hover,.ugs-item.sel{background:#eff6ff;}',
    '.ugs-item iconify-icon{color:#C0392B;margin-top:2px;}',
    '.ugs-item .t{font-size:.88rem;font-weight:600;color:#111827;}',
    '.ugs-item .s{font-size:.74rem;color:#6b7280;margin-top:1px;}',
    '.ugs-empty{padding:28px;text-align:center;color:#9ca3af;font-size:.85rem;}',
    '@media (max-width:640px){.ugs-btn span.ugs-label,.ugs-btn kbd{display:none;}}'
  ].join('');
  var st = document.createElement('style');
  st.textContent = css;
  document.head.appendChild(st);

  var overlay, input, resultsEl, flatItems = [], selIdx = -1;

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

  function buildOverlay() {
    overlay = document.createElement('div');
    overlay.className = 'ugs-overlay';
    overlay.innerHTML =
      '<div class="ugs-panel">' +
        '<div class="ugs-inputrow">' +
          '<iconify-icon icon="mdi:magnify"></iconify-icon>' +
          '<input class="ugs-input" type="text" placeholder="Search anything — pages, students, courses, feedback..." autocomplete="off"/>' +
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
    input.value = ''; input.focus(); render([]);
  }
  function close() {
    overlay.classList.remove('active');
    document.body.style.overflow = '';
  }
  document.addEventListener('keydown', function (e) {
    if ((e.ctrlKey || e.metaKey) && String(e.key).toLowerCase() === 'k') {
      e.preventDefault();
      overlay.classList.contains('active') ? close() : open();
    } else if (e.key === 'Escape' && overlay.classList.contains('active')) close();
  });

  /* ---------- role-scoped providers ---------- */
  function match(hay, q) { return String(hay || '').toLowerCase().indexOf(q) !== -1; }

  /* Phone-settings-style feature index: ANY keyword maps to the page/function
     that contains it, shown with its section context ("Under ..."). */
  var PAGES = [
    { t: 'Dashboard', kw: 'home overview stats summary ratings average analytics', sec: 'Overview', href: 'instructor-dashboard.html', icon: 'mdi:view-dashboard-outline' },
    { t: 'My Students', kw: 'students roster enrolled list names search filter courses performance view progress scores', sec: 'People', href: 'instructor-students.html', icon: 'mdi:account-multiple-outline' },
    { t: 'Student Performance View', kw: 'performance radar skills weekly progress analytics quiz scores trend read only evaluation', sec: 'Academics', href: 'instructor-student-view.html', icon: 'mdi-chart-areaspline' },
    { t: 'Ratings and Feedback', kw: 'ratings feedback evaluation stars comments reviews 8-category score', sec: 'Evaluation', href: 'instructor-ratings.html', icon: 'mdi-star-outline' },
    { t: 'Account Settings', kw: 'settings account password profile preferences sign out logout email verification', sec: 'Account', href: 'instructor-settings.html', icon: 'mdi-cog-outline' },
    { t: 'Course Filter Chips', kw: 'courses assigned jlpt n5 n4 n3 n2 bundle chips filter my courses', sec: 'Academics', href: 'instructor-students.html', icon: 'mdi-book-open-variant' },
    { t: 'Sign Out', kw: 'sign out logout exit session end', sec: 'Account', href: 'instructor-login.html', icon: 'mdi-logout-variant' }
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
    // General result: guarantees output for ANY keyword (MS Teams / phone-settings pattern)
    groups.push({ name: 'General', items: [{
      label: "General — everything for '" + q + "'",
      sub: hits.length ? ('See also: ' + hits[0].sec + ' hub') : 'Open the dashboard hub to browse all functions',
      href: 'instructor-dashboard.html'
    }]});
    return groups;
  }

  function runSearch(q) {
    if (!q) { render([]); return; }
    var merged = featureGroups(q);
    fetchGroups(q).then(function (dataGroups) {
      render(merged.concat(dataGroups));
    }).catch(function () {
      render(merged);
    });
  }


  function fetchGroups(q) {
    var me = sessionStorage.getItem('instructorId') || '';
    if (!me) return Promise.resolve([]);
    return Promise.all([
      firebase.database().ref('courses').once('value'),
      firebase.database().ref('students').once('value'),
      firebase.database().ref('professorRatings').once('value')
    ]).then(function (r) {
      var courses = r[0].val() || {};
      var students = r[1].val() || {};
      var ratings = r[2].val() || {};

      // assigned course ids: courses listing me in instructorIds (+ legacy instructorId)
      var assigned = [];
      Object.keys(courses).forEach(function (cid) {
        var c = courses[cid] || {};
        var inList = Array.isArray(c.instructorIds)
          ? c.instructorIds.indexOf(me) !== -1
          : (c.instructorIds && typeof c.instructorIds === 'object' && Object.values(c.instructorIds).indexOf(me) !== -1);
        if (inList || c.instructorId === me) assigned.push(cid);
      });

      var groups = [];
      if (!q) return groups;

      // MY STUDENTS: enrolled in an assigned course
      var stu = [];
      Object.keys(students).forEach(function (uid) {
        var s = students[uid];
        if (!s || s.isDeleted) return;
        var e = s.enrollment || {};
        var p = s.profile || {};
        if (assigned.indexOf(e.courseId) === -1) return;
        if (match(p.fullName, q) || match(p.email, q)) {
          stu.push({
            label: p.fullName || uid,
            sub: (e.course || e.courseId || '') + ' - ' + (p.email || ''),
            href: 'instructor-student-view.html?id=' + encodeURIComponent(uid)
          });
        }
      });
      if (stu.length) groups.push({ name: 'My Students', items: stu.slice(0, 6) });

      // MY COURSES
      var cor = assigned.map(function (cid) {
        var c = courses[cid] || {};
        return { label: c.name || cid, sub: c.duration || '', href: 'instructor-students.html' };
      }).filter(function (c) { return match(c.label, q); });
      if (cor.length) groups.push({ name: 'My Courses', items: cor.slice(0, 6) });

      // RATINGS / FEEDBACK about me
      var rat = [];
      Object.keys(ratings).forEach(function (k) {
        var rt = ratings[k] || {};
        if (rt.instructorId !== me) return;
        if (match(rt.comment, q)) {
          rat.push({ label: 'Feedback' + (rt.comment ? ': ' + rt.comment.slice(0, 70) : ''), sub: rt.createdAt ? new Date(rt.createdAt).toLocaleDateString() : '', href: 'instructor-ratings.html' });
        }
      });
      if (rat.length) groups.push({ name: 'Ratings and Feedback', items: rat.slice(0, 6) });

      return groups;
    });
  }

  function render(groups) {
    var icons = { 'Best Match': 'mdi:star-four-points-outline', 'Pages and Functions': 'mdi:magnify', 'General': 'mdi:apps', 'My Students': 'mdi:account-outline', 'My Courses': 'mdi:book-open-variant', 'Ratings and Feedback': 'mdi:star-outline' };
    flatItems = []; selIdx = -1;
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
    resultsEl.innerHTML = count ? html
      : '<div class="ugs-empty">Type to search your students, courses and feedback.</div>';
    resultsEl.querySelectorAll('.ugs-item').forEach(function (el) {
      el.addEventListener('click', function () { activate(flatItems[Number(el.getAttribute('data-idx'))]); });
    });
  }

  function activate(item) {
    if (item && item.href) window.location.href = item.href;
  }

  function escapeHtml_(v) {
    return String(v == null ? '' : v)
      .replace(/&/g, '&amp;').replace(/</g, '&lt;')
      .replace(/>/g, '&gt;').replace(/"/g, '&quot;');
  }

  function paint() {
    var items = resultsEl.querySelectorAll('.ugs-item');
    items.forEach(function (el, i) { el.classList.toggle('sel', i === selIdx); });
    var sel = resultsEl.querySelector('.ugs-item.sel');
    if (sel) sel.scrollIntoView({ block: 'nearest' });
  }

  window.__unmeiOpenGlobalSearch = function () { open(); };
  function boot() { injectButton(); buildOverlay(); }
  if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', boot);
  else boot();
})();
