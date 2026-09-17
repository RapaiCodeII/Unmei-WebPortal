(function () {
  var SESSION_TIMEOUT = 30 * 60 * 1000; // 30 minutes
  var AUTH_KEY = 'adminAuth';
  var EMAIL_KEY = 'adminEmail';
  var ID_KEY = 'adminId';
  var AUTH_UID_KEY = 'adminAuthUid';
  var AUTH_MODE_KEY = 'adminAuthMode';
  var DISPLAY_NAME_KEY = 'adminDisplayName';
  var ACTIVITY_KEY = 'adminLastActivity';
  var LOGIN_URL = 'admin-login.html';
  var FIREBASE_READY_TIMEOUT_MS = 15000;
  var _expired = false;
  var _checkInterval = null;
  var _authValidated = false;
  var _validationStartedAt = Date.now();

  function normalizeText(value) {
    return String(value || '').trim().toLowerCase();
  }

  function clearSession() {
    sessionStorage.removeItem(AUTH_KEY);
    sessionStorage.removeItem(EMAIL_KEY);
    sessionStorage.removeItem(ID_KEY);
    sessionStorage.removeItem(AUTH_UID_KEY);
    sessionStorage.removeItem(AUTH_MODE_KEY);
    sessionStorage.removeItem(DISPLAY_NAME_KEY);
    sessionStorage.removeItem(ACTIVITY_KEY);
    if (_checkInterval) {
      clearInterval(_checkInterval);
      _checkInterval = null;
    }
  }

  function redirectToLogin() {
    window.location.replace(LOGIN_URL);
  }

  function updateActivity() {
    sessionStorage.setItem(ACTIVITY_KEY, Date.now().toString());
  }

  function triggerExpired() {
    if (_expired) {
      return;
    }
    _expired = true;
    clearSession();
    redirectToLogin();
  }

  function triggerInvalidSession() {
    if (_expired) {
      return;
    }
    _expired = true;
    clearSession();
    redirectToLogin();
  }

  function resolveAdminRecordByEmail(database, emailLower) {
    function mapRecord(value, key) {
      var raw = value || {};
      var candidateEmail = normalizeText(raw.email || raw.adminEmail || raw.loginEmail);
      if (!candidateEmail || candidateEmail !== emailLower) {
        return null;
      }

      return {
        id: key || '',
        email: candidateEmail,
        displayName: String(raw.displayName || raw.name || raw.fullName || 'Administrator'),
        role: normalizeText(raw.role || ''),
        isRevoked: raw.isRevoked === true || raw.revoked === true || raw.disabled === true || raw.isDisabled === true
      };
    }

    return database.ref('admins').once('value').then(function (adminsSnapshot) {
      var found = null;
      if (adminsSnapshot.exists()) {
        adminsSnapshot.forEach(function (child) {
          if (found) {
            return;
          }
          found = mapRecord(child.val(), child.key);
        });
      }

      if (found) {
        return found;
      }

      return database.ref('users/adminLogin').once('value').then(function (adminLoginSnapshot) {
        if (adminLoginSnapshot.exists()) {
          adminLoginSnapshot.forEach(function (child) {
            if (found) {
              return;
            }
            found = mapRecord(child.val(), child.key);
          });
        }

        if (found) {
          return found;
        }

        return database.ref('users').once('value').then(function (usersSnapshot) {
          if (!usersSnapshot.exists()) {
            return null;
          }

          usersSnapshot.forEach(function (child) {
            if (found) {
              return;
            }
            var direct = mapRecord(child.val(), child.key);
            if (!direct) {
              return;
            }
            if (direct.role === 'admin' || direct.role === 'superadmin' || direct.role === 'administrator') {
              found = direct;
            }
          });

          return found;
        });
      });
    });
  }

  function validateFirebaseSession() {
    if (_expired || _authValidated) {
      return;
    }

    var authMode = normalizeText(sessionStorage.getItem(AUTH_MODE_KEY) || '');
    if (authMode === 'primary') {
      var sessionEmail = normalizeText(sessionStorage.getItem(EMAIL_KEY) || '');
      if (!sessionEmail) {
        triggerInvalidSession();
        return;
      }

      if (typeof firebase === 'undefined' || !firebase.database) {
        _authValidated = true;
        updateActivity();
        return;
      }

      var primaryDb = firebase.database();
      resolveAdminRecordByEmail(primaryDb, sessionEmail).then(function (adminRecord) {
        if (adminRecord && adminRecord.isRevoked) {
          triggerInvalidSession();
          return;
        }

        if (adminRecord) {
          sessionStorage.setItem(EMAIL_KEY, adminRecord.email || sessionEmail);
          sessionStorage.setItem(ID_KEY, adminRecord.id || sessionStorage.getItem(ID_KEY) || '');
          sessionStorage.setItem(DISPLAY_NAME_KEY, adminRecord.displayName || 'Administrator');
        } else {
          if (!sessionStorage.getItem(ID_KEY)) {
            sessionStorage.setItem(ID_KEY, '');
          }
          if (!sessionStorage.getItem(DISPLAY_NAME_KEY)) {
            sessionStorage.setItem(DISPLAY_NAME_KEY, 'Administrator');
          }
        }

        _authValidated = true;
        updateActivity();
      }).catch(function () {
        _authValidated = true;
        updateActivity();
      });
      return;
    }

    if (Date.now() - _validationStartedAt > FIREBASE_READY_TIMEOUT_MS) {
      triggerInvalidSession();
      return;
    }

    if (typeof firebase === 'undefined' || !firebase.auth || !firebase.database) {
      setTimeout(validateFirebaseSession, 200);
      return;
    }

    var auth = firebase.auth();
    var database = firebase.database();

    var unlisten = auth.onAuthStateChanged(function (user) {
      if (typeof unlisten === 'function') {
        unlisten();
      }

      if (!user || !user.email) {
        triggerInvalidSession();
        return;
      }

      var sessionEmail = normalizeText(sessionStorage.getItem(EMAIL_KEY) || '');
      var sessionAuthUid = normalizeText(sessionStorage.getItem(AUTH_UID_KEY) || '');
      var authEmail = normalizeText(user.email || '');
      var authUid = normalizeText(user.uid || '');

      if (sessionEmail && sessionEmail !== authEmail) {
        triggerInvalidSession();
        return;
      }

      if (sessionAuthUid && sessionAuthUid !== authUid) {
        triggerInvalidSession();
        return;
      }

      resolveAdminRecordByEmail(database, authEmail).then(function (adminRecord) {
        if (!adminRecord || adminRecord.isRevoked) {
          triggerInvalidSession();
          return;
        }

        sessionStorage.setItem(AUTH_KEY, 'true');
        sessionStorage.setItem(EMAIL_KEY, adminRecord.email || authEmail);
        sessionStorage.setItem(ID_KEY, adminRecord.id || user.uid || '');
        sessionStorage.setItem(AUTH_UID_KEY, user.uid || '');
        sessionStorage.setItem(DISPLAY_NAME_KEY, adminRecord.displayName || 'Administrator');
        updateActivity();
        _authValidated = true;
      }).catch(function () {
        triggerInvalidSession();
      });
    }, function () {
      triggerInvalidSession();
    });
  }

  if (window.location.pathname.indexOf(LOGIN_URL) !== -1) {
    return;
  }

  if (!sessionStorage.getItem(AUTH_KEY)) {
    redirectToLogin();
    return;
  }

  var lastActivity = parseInt(sessionStorage.getItem(ACTIVITY_KEY), 10);
  if (!lastActivity || (Date.now() - lastActivity > SESSION_TIMEOUT)) {
    triggerExpired();
    return;
  }

  updateActivity();
  validateFirebaseSession();

  var throttle = null;
  ['mousemove', 'keydown', 'click', 'scroll', 'touchstart'].forEach(function (evt) {
    document.addEventListener(evt, function () {
      if (_expired) {
        return;
      }
      if (!throttle) {
        throttle = setTimeout(function () {
          updateActivity();
          throttle = null;
        }, 5000);
      }
    }, { passive: true });
  });

  _checkInterval = setInterval(function () {
    if (_expired) {
      return;
    }
    var last = parseInt(sessionStorage.getItem(ACTIVITY_KEY), 10);
    if (!last || (Date.now() - last > SESSION_TIMEOUT)) {
      triggerExpired();
      return;
    }

    if (!_authValidated && (Date.now() - _validationStartedAt > FIREBASE_READY_TIMEOUT_MS)) {
      triggerInvalidSession();
    }
  }, 30000);

  window.__unmeiClearAdminSession = function () {
    clearSession();
  };
})();
