(function () {
  var SESSION_TIMEOUT = 30 * 60 * 1000; // 30 minutes
  var AUTH_KEY = 'instructorAuth';
  var EMAIL_KEY = 'instructorEmail';
  var ID_KEY = 'instructorId';
  var AUTH_UID_KEY = 'instructorAuthUid';
  var AUTH_MODE_KEY = 'instructorAuthMode';
  var DISPLAY_NAME_KEY = 'instructorDisplayName';
  var ACTIVITY_KEY = 'instructorLastActivity';
  var LOGIN_URL = 'instructor-login.html';
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

  function resolveInstructorRecordByEmail(database, emailLower) {
    return database.ref('professors').once('value').then(function (snapshot) {
      var found = null;
      if (snapshot.exists()) {
        snapshot.forEach(function (child) {
          if (found) {
            return;
          }
          var raw = child.val() || {};
          var candidateEmail = normalizeText(raw.email);
          if (candidateEmail && candidateEmail === emailLower) {
            found = {
              id: child.key,
              email: candidateEmail,
              displayName: String(raw.fullName || 'Instructor'),
              active: raw.active !== false,
              authUid: raw.authUid || ''
            };
          }
        });
      }
      return found;
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
      resolveInstructorRecordByEmail(primaryDb, sessionEmail).then(function (record) {
        if (record && record.active === false) {
          triggerInvalidSession();
          return;
        }

        if (record) {
          sessionStorage.setItem(EMAIL_KEY, record.email);
          sessionStorage.setItem(ID_KEY, record.id);
          sessionStorage.setItem(DISPLAY_NAME_KEY, record.displayName);
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
      var authEmail = normalizeText(user.email || '');

      if (sessionEmail && sessionEmail !== authEmail) {
        triggerInvalidSession();
        return;
      }

      resolveInstructorRecordByEmail(database, authEmail).then(function (record) {
        if (!record || record.active === false) {
          triggerInvalidSession();
          return;
        }

        sessionStorage.setItem(AUTH_KEY, 'true');
        sessionStorage.setItem(EMAIL_KEY, record.email);
        sessionStorage.setItem(ID_KEY, record.id);
        sessionStorage.setItem(AUTH_UID_KEY, user.uid || '');
        sessionStorage.setItem(DISPLAY_NAME_KEY, record.displayName);
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

  window.__unmeiClearInstructorSession = function () {
    clearSession();
  };
})();
