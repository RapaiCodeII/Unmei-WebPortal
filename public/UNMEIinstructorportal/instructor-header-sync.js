// Shared header behavior for the UNMEI Instructor Portal: identity sync,
// sidebar controls, header dropdowns, and small shared helpers.
(function () {
  var ID_KEY = 'instructorId';
  var EMAIL_KEY = 'instructorEmail';
  var DISPLAY_NAME_KEY = 'instructorDisplayName';

  function esc(value) {
    return String(value == null ? '' : value).replace(/[&<>"']/g, function (c) {
      return { '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c];
    });
  }
  window.escapeHtml = window.escapeHtml || esc;

  function initialsFrom(name) {
    var parts = String(name || '').trim().split(/\s+/).filter(Boolean);
    if (!parts.length) return 'IN';
    if (parts.length === 1) return parts[0].slice(0, 2).toUpperCase();
    return (parts[0][0] + parts[parts.length - 1][0]).toUpperCase();
  }

  function applyIdentity(name) {
    var display = String(name || sessionStorage.getItem(DISPLAY_NAME_KEY) || 'Instructor');
    var initials = initialsFrom(display);
    ['sidebarUserName', 'headerUserName'].forEach(function (id) {
      var el = document.getElementById(id);
      if (el) el.textContent = display;
    });
    ['sidebarAvatar', 'headerAvatar', 'avatarBtn'].forEach(function (id) {
      var el = document.getElementById(id);
      if (el) el.textContent = initials;
    });
  }

  function startIdentitySync() {
    applyIdentity();
    var instructorId = sessionStorage.getItem(ID_KEY);
    if (!instructorId || typeof firebase === 'undefined' || !firebase.database) return;
    var db = firebase.database();
    db.ref('professors/' + instructorId).on('value', function (snapshot) {
      var data = snapshot.val() || {};
      var name = data.fullName || sessionStorage.getItem(DISPLAY_NAME_KEY) || 'Instructor';
      applyIdentity(name);
      sessionStorage.setItem(DISPLAY_NAME_KEY, name);
      if (data.email) sessionStorage.setItem(EMAIL_KEY, data.email);

      var assigned = Array.isArray(data.coursesAssigned)
        ? data.coursesAssigned
        : (data.coursesAssigned && typeof data.coursesAssigned === 'object' ? Object.values(data.coursesAssigned) : []);
      syncStudentBadge(db, assigned);
    });
  }

  function syncStudentBadge(db, assignedCourses) {
    var assigned = (assignedCourses || []).map(String);
    return db.ref('students').once('value').then(function (studentsSnapshot) {
      var count = 0;
      if (studentsSnapshot.exists()) {
        studentsSnapshot.forEach(function (student) {
          var enrollment = student.val() && student.val().enrollment;
          if (enrollment && assigned.indexOf(String(enrollment.courseId || '')) !== -1) count += 1;
        });
      }
      document.querySelectorAll('#studentBadge').forEach(function (badge) {
        badge.textContent = String(count);
      });
      return count;
    });
  }
  window.syncInstructorStudentBadge = function () {
    var instructorId = sessionStorage.getItem(ID_KEY);
    if (!instructorId || typeof firebase === 'undefined' || !firebase.database) return Promise.resolve(0);
    var db = firebase.database();
    return db.ref('professors/' + instructorId).once('value').then(function (snapshot) {
      var data = snapshot.val() || {};
      var raw = data.coursesAssigned;
      var assigned = Array.isArray(raw) ? raw : (raw && typeof raw === 'object' ? Object.values(raw) : []);
      return syncStudentBadge(db, assigned);
    });
  };

  // ---------- sidebar controls ----------
  window.toggleSidebar = function () {
    var sidebar = document.querySelector('.sidebar');
    if (sidebar) sidebar.classList.toggle('sidebar--collapsed');
  };

  window.toggleMobileSidebar = function () {
    var sidebar = document.querySelector('.sidebar');
    var backdrop = document.getElementById('sidebarBackdrop');
    if (sidebar) sidebar.classList.toggle('sidebar--mobile-open');
    if (backdrop) backdrop.classList.toggle('active', sidebar && sidebar.classList.contains('sidebar--mobile-open'));
  };

  window.closeMobileSidebar = function () {
    var sidebar = document.querySelector('.sidebar');
    var backdrop = document.getElementById('sidebarBackdrop');
    if (sidebar) sidebar.classList.remove('sidebar--mobile-open');
    if (backdrop) backdrop.classList.remove('active');
  };

  // ---------- header dropdowns ----------
  window.toggleDropdown = function (id) {
    var target = document.getElementById(id);
    if (!target) return;
    var willOpen = !target.classList.contains('active');
    closeAllDropdowns();
    if (willOpen) target.classList.add('active');
  };

  function closeAllDropdowns() {
    document.querySelectorAll('.header-dropdown.active').forEach(function (d) {
      d.classList.remove('active');
    });
  }

  document.addEventListener('click', function (e) {
    if (!e.target.closest('.header-dropdown') && !e.target.closest('.icon-btn') && !e.target.closest('.avatar-btn')) {
      closeAllDropdowns();
    }
  });

  window.navigateTo = function (url) {
    window.location.href = url;
  };

  // ---------- sign out (settings page + sidebar bottom only) ----------
  window.instructorSignOut = function () {
    if (typeof window.__unmeiClearInstructorSession === 'function') {
      window.__unmeiClearInstructorSession();
    }
    if (typeof firebase !== 'undefined' && firebase.auth) {
      firebase.auth().signOut().catch(function () {});
    }
    window.location.replace('instructor-login.html');
  };

  window.showConfirm = window.showConfirm || function (title, message, onConfirm) {
    var overlay = document.getElementById('confirmOverlay');
    var titleEl = document.getElementById('confirmTitle');
    var msgEl = document.getElementById('confirmMessage');
    if (overlay && titleEl && msgEl) {
      titleEl.textContent = title;
      msgEl.textContent = message;
      overlay.classList.add('active');
      window.__confirmCallback = onConfirm;
      return;
    }

    // Self-contained modal for pages without static confirm markup.
    var modalHost = document.getElementById('unmeiInstructorConfirm');
    if (modalHost) modalHost.remove();
    modalHost = document.createElement('div');
    modalHost.id = 'unmeiInstructorConfirm';
    modalHost.style.cssText = 'position:fixed;inset:0;z-index:9999;display:flex;align-items:center;justify-content:center;background:rgba(15,23,42,0.55);backdrop-filter:blur(2px);';
    modalHost.innerHTML = ''
      + '<div role="dialog" aria-modal="true" style="background:#fff;border-radius:16px;box-shadow:0 24px 48px rgba(15,23,42,0.25);max-width:360px;width:calc(100% - 40px);padding:28px 26px 22px;text-align:center;">'
      + '<div style="width:56px;height:56px;border-radius:50%;background:#E8EEF6;display:flex;align-items:center;justify-content:center;margin:0 auto 16px;">'
      + '<iconify-icon icon="mdi:logout" style="font-size:28px;color:#C0392B;"></iconify-icon></div>'
      + '<h3 style="margin:0 0 8px;font-size:1.05rem;font-weight:700;color:#111827;">' + esc(title) + '</h3>'
      + '<p style="margin:0 0 22px;font-size:0.85rem;color:#6B7280;line-height:1.5;">' + esc(message) + '</p>'
      + '<div style="display:flex;gap:10px;">'
      + '<button type="button" id="unmeiInstructorConfirmNo" style="flex:1;padding:11px 0;border:1.5px solid #E5E7EB;border-radius:10px;background:#fff;color:#374151;font-weight:600;font-size:0.85rem;cursor:pointer;">Cancel</button>'
      + '<button type="button" id="unmeiInstructorConfirmYes" style="flex:1;padding:11px 0;border:none;border-radius:10px;background:#C0392B;color:#fff;font-weight:600;font-size:0.85rem;cursor:pointer;">Confirm</button>'
      + '</div></div>';
    document.body.appendChild(modalHost);
    var close = function () { modalHost.remove(); };
    modalHost.addEventListener('click', function (e) { if (e.target === modalHost) close(); });
    modalHost.querySelector('#unmeiInstructorConfirmNo').addEventListener('click', close);
    modalHost.querySelector('#unmeiInstructorConfirmYes').addEventListener('click', function () {
      close();
      if (typeof onConfirm === 'function') onConfirm();
    });
  };

  window.confirmYes = function () {
    var overlay = document.getElementById('confirmOverlay');
    if (overlay) overlay.classList.remove('active');
    if (typeof window.__confirmCallback === 'function') {
      var cb = window.__confirmCallback;
      window.__confirmCallback = null;
      cb();
    }
  };

  window.confirmNo = function () {
    var overlay = document.getElementById('confirmOverlay');
    if (overlay) overlay.classList.remove('active');
    window.__confirmCallback = null;
  };

  // ---------- date/number formatting helpers ----------
  window.formatTimestamp = function (ts) {
    if (!ts) return '—';
    var d = new Date(Number(ts));
    if (isNaN(d.getTime())) return '—';
    return d.toLocaleDateString('en-PH', { month: 'short', day: 'numeric', year: 'numeric' });
  };

  window.timeAgo = function (ts) {
    if (!ts) return '—';
    var diff = Date.now() - Number(ts);
    if (isNaN(diff) || diff < 0) return '—';
    var mins = Math.floor(diff / 60000);
    if (mins < 1) return 'Just now';
    if (mins < 60) return mins + 'm ago';
    var hours = Math.floor(mins / 60);
    if (hours < 24) return hours + 'h ago';
    var days = Math.floor(hours / 24);
    if (days < 30) return days + 'd ago';
    return formatTimestamp(ts);
  };

  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', startIdentitySync);
  } else {
    startIdentitySync();
  }
})();
