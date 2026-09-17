(function() {
  var SESSION_TIMEOUT = 30 * 60 * 1000; // 30 minutes
  var SESSION_KEY = 'studentUid';
  var EMAIL_KEY = 'studentEmail';
  var AUTH_UID_KEY = 'studentAuthUid';
  var ACTIVITY_KEY = 'lastActivity';
  var LOGIN_URL = 'login.html';
  var _expired = false;
  var _checkInterval = null;

  // Check if user has a valid session (support both sessionStorage and localStorage)
  var uid = sessionStorage.getItem(SESSION_KEY) || localStorage.getItem(SESSION_KEY);
  var lastActivity = parseInt(sessionStorage.getItem(ACTIVITY_KEY) || localStorage.getItem(ACTIVITY_KEY), 10);

  // No session - redirect to login immediately
  if (!uid) {
    window.location.replace(LOGIN_URL);
    return;
  }

  // Session exists: check if expired, or initialize if fresh
  if (lastActivity && (Date.now() - lastActivity > SESSION_TIMEOUT)) {
    triggerExpired();
    return;
  }

  // Valid session - update activity timestamp
  updateActivity();

  // ========================================
  // BUG-1 FIX: Check isRevoked in Firebase
  // ========================================
  // After confirming localStorage session is valid,
  // do a one-time Firebase check for revocation status.
  // Firebase SDK must be loaded before session-guard runs on protected pages.
  function checkRevocationStatus() {
    // Wait for Firebase to be available (it loads via script tags in the HTML)
    if (typeof firebase === 'undefined' || !firebase.database) {
      // Firebase not loaded yet — retry after a short delay
      // This handles race conditions where session-guard.js loads before Firebase SDK
      setTimeout(checkRevocationStatus, 200);
      return;
    }

    function resolveUidByEmail(database, emailLower) {
      if (!emailLower) return Promise.resolve('');
      return database.ref('students').once('value').then(function(studentsSnapshot) {
        if (!studentsSnapshot.exists()) return '';
        var resolved = '';
        studentsSnapshot.forEach(function(child) {
          if (resolved) return;
          var data = child.val() || {};
          var profile = data.profile || {};
          var candidate = String(profile.email || data.email || '').trim().toLowerCase();
          if (candidate && candidate === emailLower) {
            resolved = child.key;
          }
        });
        return resolved;
      });
    }

    var database = firebase.database();
    var emailLower = String(localStorage.getItem(EMAIL_KEY) || '').trim().toLowerCase();
    database.ref('students/' + uid).once('value').then(function(studentSnapshot) {
      if (studentSnapshot.exists()) {
        var studentData = studentSnapshot.val() || {};
        if (studentData.isDeleted === true) {
          triggerRemoved();
          return;
        }
        if (studentData.isRevoked === true) {
          triggerRevoked();
        }
        return;
      }

      // PHASE 2: no demo accounts. A missing students/{uid} node means the
      // account record was removed from the live database.
      return resolveUidByEmail(database, emailLower).then(function(resolvedUid) {
        if (!resolvedUid) {
          triggerRemoved();
          return;
        }
        uid = resolvedUid;
        localStorage.setItem(SESSION_KEY, resolvedUid);

        return database.ref('students/' + resolvedUid).once('value').then(function(resolvedSnapshot) {
          if (!resolvedSnapshot.exists()) {
            triggerRemoved();
            return;
          }
          var resolvedData = resolvedSnapshot.val() || {};
          if (resolvedData.isDeleted === true) {
            triggerRemoved();
            return;
          }
          if (resolvedData.isRevoked === true) {
            triggerRevoked();
          }
        });
      });
    }).catch(function() {
      // If Firebase read fails (offline, permissions, etc.), allow session to continue
      // The login page will also check revocation status
    });
  }

  // Start revocation check after DOM is ready (Firebase scripts will be loaded by then)
  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', checkRevocationStatus);
  } else {
    checkRevocationStatus();
  }

  // Track user activity (throttled to every 5 seconds)
  var throttle = null;
  var activityEvents = ['mousemove', 'keydown', 'click', 'scroll', 'touchstart'];
  activityEvents.forEach(function(evt) {
    document.addEventListener(evt, function() {
      if (_expired) return;
      if (!throttle) {
        throttle = setTimeout(function() {
          updateActivity();
          throttle = null;
        }, 5000);
      }
    }, { passive: true });
  });

  // Poll every 30 seconds to check if session has expired
  _checkInterval = setInterval(function() {
    if (_expired) return;
    var last = parseInt(localStorage.getItem(ACTIVITY_KEY), 10);
    if (!last || (Date.now() - last > SESSION_TIMEOUT)) {
      triggerExpired();
    }
  }, 30000);

  function updateActivity() {
    localStorage.setItem(ACTIVITY_KEY, Date.now().toString());
  }

  function clearSession() {
    localStorage.removeItem(SESSION_KEY);
    localStorage.removeItem(AUTH_UID_KEY);
    localStorage.removeItem(EMAIL_KEY);
    localStorage.removeItem(ACTIVITY_KEY);
    localStorage.removeItem('studentDisplayName');
    localStorage.removeItem('studentAvatarUrl');
    if (_checkInterval) {
      clearInterval(_checkInterval);
      _checkInterval = null;
    }
  }

  function triggerExpired() {
    if (_expired) return;
    _expired = true;
    clearSession();

    function showModal() {
      // Don't show modal if already on login page
      if (window.location.pathname.indexOf(LOGIN_URL) !== -1) return;

      var overlay = document.createElement('div');
      overlay.className = 'session-expired-overlay';
      overlay.innerHTML =
        '<div class="session-expired-card">' +
          '<div class="session-expired-icon">' +
            '<iconify-icon icon="mdi:clock-outline"></iconify-icon>' +
          '</div>' +
          '<h3 class="session-expired-title">Session Expired</h3>' +
          '<p class="session-expired-message">Your session has timed out due to inactivity. You will be redirected to the login page.</p>' +
          '<div class="session-expired-bar"><div class="session-expired-bar__fill"></div></div>' +
        '</div>';
      document.body.appendChild(overlay);

      requestAnimationFrame(function() {
        overlay.classList.add('active');
      });

      setTimeout(function() {
        window.location.replace(LOGIN_URL);
      }, 3500);
    }

    if (document.readyState === 'loading') {
      document.addEventListener('DOMContentLoaded', showModal);
    } else {
      showModal();
    }
  }

  // BUG-1 FIX: Handle revoked accounts
  function triggerRevoked() {
    if (_expired) return;
    _expired = true;
    clearSession();

    function showRevokedModal() {
      if (window.location.pathname.indexOf(LOGIN_URL) !== -1) return;

      var overlay = document.createElement('div');
      overlay.className = 'session-expired-overlay';
      overlay.innerHTML =
        '<div class="session-expired-card">' +
          '<div class="session-expired-icon" style="color:#C0392B;">' +
            '<iconify-icon icon="mdi:close-circle-outline"></iconify-icon>' +
          '</div>' +
          '<h3 class="session-expired-title">Account Suspended</h3>' +
          '<p class="session-expired-message">Your enrollment has been revoked by the administrator. Please contact the registrar for assistance.</p>' +
          '<div class="session-expired-bar"><div class="session-expired-bar__fill"></div></div>' +
        '</div>';
      document.body.appendChild(overlay);

      requestAnimationFrame(function() {
        overlay.classList.add('active');
      });

      setTimeout(function() {
        window.location.replace(LOGIN_URL);
      }, 4000);
    }

    if (document.readyState === 'loading') {
      document.addEventListener('DOMContentLoaded', showRevokedModal);
    } else {
      showRevokedModal();
    }
  }

  function triggerRemoved() {
    if (_expired) return;
    _expired = true;
    clearSession();

    function showRemovedModal() {
      if (window.location.pathname.indexOf(LOGIN_URL) !== -1) return;

      var overlay = document.createElement('div');
      overlay.className = 'session-expired-overlay';
      overlay.innerHTML =
        '<div class="session-expired-card">' +
          '<div class="session-expired-icon" style="color:#9A3412;">' +
            '<iconify-icon icon="mdi:minus-circle-outline"></iconify-icon>' +
          '</div>' +
          '<h3 class="session-expired-title">Account Removed</h3>' +
          '<p class="session-expired-message">Your student record is no longer active. Please contact the registrar for assistance.</p>' +
          '<div class="session-expired-bar"><div class="session-expired-bar__fill"></div></div>' +
        '</div>';
      document.body.appendChild(overlay);

      requestAnimationFrame(function() {
        overlay.classList.add('active');
      });

      setTimeout(function() {
        window.location.replace(LOGIN_URL);
      }, 4000);
    }

    if (document.readyState === 'loading') {
      document.addEventListener('DOMContentLoaded', showRemovedModal);
    } else {
      showRemovedModal();
    }
  }

  // Clean up on page unload
  window.addEventListener('beforeunload', function() {
    if (_checkInterval) {
      clearInterval(_checkInterval);
    }
  });

  // Expose clear session function for logout
  window.__unmeiClearStudentSession = function() {
    clearSession();
  };
})();
