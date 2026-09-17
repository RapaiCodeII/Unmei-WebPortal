/**
 * UNMEI Firestore Database Shim (Phase 8 migration)
 * Implements the RTDB compat API surface on top of Cloud Firestore so every
 * portal page reads/writes Firestore WITHOUT page-code changes.
 * Load order: app-compat -> auth-compat -> storage-compat ->
 *             firestore-compat -> firebase-config.js -> THIS FILE.
 */
(function () {
  'use strict';
  if (typeof firebase === 'undefined' || !firebase.apps || !firebase.apps.length) {
    console.error('[fs-shim] firebase app not initialized before shim');
    return;
  }
  var fsdb = firebase.firestore();
  var FV = firebase.firestore.FieldValue;
  var PUSH_CHARS = '-0123456789ABCDEFGHIJKLMNOPQRSTUVWXYZ_abcdefghijklmnopqrstuvwxyz';
  var lastPushTime = 0, lastRand = [];

  function pushId(now) {
    now = typeof now === 'number' ? now : Date.now();
    var dup = now === lastPushTime; lastPushTime = now;
    var ts = []; var t = now; var i;
    for (i = 7; i >= 0; i--) { ts[i] = PUSH_CHARS.charAt(t % 64); t = Math.floor(t / 64); }
    var id = ts.join('');
    if (!dup) { for (i = 0; i < 12; i++) lastRand[i] = Math.floor(Math.random() * 64); }
    else { for (i = 11; i >= 0 && lastRand[i] === 63; i--) lastRand[i] = 0; if (i >= 0) lastRand[i]++; }
    for (i = 0; i < 12; i++) id += PUSH_CHARS.charAt(lastRand[i]);
    return id;
  }

  function Segments(p) { return String(p || '').split('/').filter(function (s) { return s.length > 0; }); }

  function traverse(obj, fieldSegs) {
    var cur = obj;
    for (var i = 0; i < fieldSegs.length; i++) {
      if (cur === null || typeof cur !== 'object') return null;
      cur = Object.prototype.hasOwnProperty.call(cur, fieldSegs[i]) ? cur[fieldSegs[i]] : null;
    }
    return cur === undefined ? null : cur;
  }

  function Snapshot(val, key) {
    this._val = val === undefined ? null : val;
    this._key = key || null;
  }
  Snapshot.prototype.val = function () { return this._val; };
  Snapshot.prototype.exists = function () { return this._val !== null && this._val !== undefined; };
  Snapshot.prototype.numChildren = function () {
    return (this._val && typeof this._val === 'object' && !Array.isArray(this._val)) ? Object.keys(this._val).length : 0;
  };
  Snapshot.prototype.forEach = function (cb) {
    var v = this._val; if (!v || typeof v !== 'object') return false;
    var stop = false;
    Object.keys(v).sort().forEach(function (k) { if (!stop && cb(new Snapshot(v[k], k)) === true) stop = true; });
    return stop;
  };
  Object.defineProperty(Snapshot.prototype, 'key', { get: function () { return this._key; } });

  function applyConstraints(entries, c) {
    var list = entries.slice();
    var ord = c.orderBy || 'key';
    function childVal(v, f) { return v && typeof v === 'object' && f in v ? v[f] : null; }
    var keyFn;
    if (ord === 'key') keyFn = function (e) { return e.k; };
    else if (ord === 'value') keyFn = function (e) { return e.v; };
    else keyFn = function (e) { return childVal(e.v, c.orderField); };
    if (ord !== 'key') {
      list.sort(function (a, b) {
        var av = keyFn(a), bv = keyFn(b);
        var an = typeof av === 'number', bn = typeof bv === 'number';
        if (an && bn) return av - bv;
        if (an) return -1; if (bn) return 1;
        if (av === null) return -1; if (bv === null) return 1;
        return String(av) < String(bv) ? -1 : String(av) > String(bv) ? 1 : 0;
      });
    } else {
      list.sort(function (a, b) { return a.k < b.k ? -1 : a.k > b.k ? 1 : 0; });
    }
    if (c.startAtV !== undefined) list = list.filter(function (e) { return !(keyFn(e) < c.startAtV); });
    if (c.endAtV !== undefined) list = list.filter(function (e) { return !(keyFn(e) > c.endAtV); });
    if (c.equalToV !== undefined) list = list.filter(function (e) { return keyFn(e) === c.equalToV; });
    if (c.limitFirst !== undefined) list = list.slice(0, c.limitFirst);
    if (c.limitLast !== undefined) list = list.slice(Math.max(0, list.length - c.limitLast));
    var out = {}; list.forEach(function (e) { out[e.k] = e.v; });
    return out;
  }

  function cloneDeep(v) { return v === null || v === undefined ? v : JSON.parse(JSON.stringify(v)); }
  /* ---------------------------- Reference ---------------------------- */
  function DbRef(path, cons) {
    this.path = path;
    this.segs = Segments(path);
    this.cons = cons || {};
    this._subs = [];
  }
  Object.defineProperty(DbRef.prototype, 'key', { get: function () { var s = this.segs; return s.length ? s[s.length - 1] : null; } });
  Object.defineProperty(DbRef.prototype, 'parent', { get: function () { var s = this.segs; return s.length <= 1 ? null : new DbRef(s.slice(0, -1).join('/')); } });
  DbRef.prototype.child = function (rel) { return new DbRef(this.segs.concat(Segments(rel)).join('/'), this.cons); };

  DbRef.prototype.orderByKey = function () { var q = new DbRef(this.path, Object.assign({}, this.cons)); q.cons.orderBy = 'key'; return q; };
  DbRef.prototype.orderByValue = function () { var q = new DbRef(this.path, Object.assign({}, this.cons)); q.cons.orderBy = 'value'; return q; };
  DbRef.prototype.orderByChild = function (f) { var q = new DbRef(this.path, Object.assign({}, this.cons)); q.cons.orderBy = 'child'; q.cons.orderField = f; return q; };
  DbRef.prototype.limitToFirst = function (n) { var q = new DbRef(this.path, Object.assign({}, this.cons)); q.cons.limitFirst = n; return q; };
  DbRef.prototype.limitToLast = function (n) { var q = new DbRef(this.path, Object.assign({}, this.cons)); q.cons.limitLast = n; return q; };
  DbRef.prototype.equalTo = function (v) { var q = new DbRef(this.path, Object.assign({}, this.cons)); q.cons.equalToV = v; return q; };
  DbRef.prototype.startAt = function (v) { var q = new DbRef(this.path, Object.assign({}, this.cons)); q.cons.startAtV = v; return q; };
  DbRef.prototype.endAt = function (v) { var q = new DbRef(this.path, Object.assign({}, this.cons)); q.cons.endAtV = v; return q; };

  DbRef.prototype._fetchVal = function () {
    var s = this.segs; var self = this;
    var p;
    if (s.length === 0) return Promise.reject(new Error('fs-shim: cannot read root'));
    if (s.length === 1) {
      p = fsdb.collection(s[0]).get().then(function (qsnap) {
        var out = {}; qsnap.forEach(function (d) { out[d.id] = d.data(); }); return out;
      });
    } else if (s.length === 2) {
      p = fsdb.collection(s[0]).doc(s[1]).get().then(function (d) { return d.exists ? d.data() : null; });
    } else {
      var fp = s.slice(2);
      p = fsdb.collection(s[0]).doc(s[1]).get().then(function (d) { return d.exists ? traverse(d.data(), fp) : null; });
    }
    return p.then(function (v) {
      var val = cloneDeep(v);
      var hasQ = self.cons && (self.cons.orderBy !== undefined || self.cons.limitFirst !== undefined ||
        self.cons.limitLast !== undefined || self.cons.equalToV !== undefined ||
        self.cons.startAtV !== undefined || self.cons.endAtV !== undefined);
      if (hasQ && val && typeof val === 'object' && !Array.isArray(val)) {
        var entries = [];
        Object.keys(val).forEach(function (k) { entries.push({ k: k, v: val[k] }); });
        val = applyConstraints(entries, self.cons);
      }
      return new Snapshot(val, self.key);
    });
  };

  DbRef.prototype.once = function (event, cb, errCb) {
    return this._fetchVal().then(function (snap) { if (typeof cb === 'function') cb(snap); return snap; })
      .catch(function (e) { console.error('[fs-shim] once failed:', e.message || e); if (typeof errCb === 'function') errCb(e); throw e; });
  };

  DbRef.prototype.on = function (event, cb, errCb) {
    var s = this.segs; var self = this;
    var emit = function () {
      self._fetchVal().then(cb).catch(function (e) {
        console.error('[fs-shim] on failed:', e.message || e);
        if (typeof errCb === 'function') errCb(e);
      });
    };
    var unsub = null;
    try {
      if (s.length === 1) unsub = fsdb.collection(s[0]).onSnapshot(function () { emit(); }, errCb);
      else unsub = fsdb.collection(s[0]).doc(s[1]).onSnapshot(function () { emit(); }, errCb);
    } catch (e) { emit(); }
    if (typeof unsub === 'function') this._subs.push(unsub);
    else this._subs.push(emit);
    var self2 = this;
    return function () { self2.off(); };
  };

  DbRef.prototype.off = function () {
    this._subs.forEach(function (u) { if (typeof u === 'function') u(); });
    this._subs = [];
  };
  /* ----------------------------- writes ----------------------------- */
  function sanitize(value) {
    if (value === undefined || value === null) return null;
    if (typeof value !== 'object') return value;
    if (Array.isArray(value)) return value.map(sanitize);
    var out = {};
    Object.keys(value).forEach(function (k) { if (value[k] !== undefined) out[k] = sanitize(value[k]); });
    return out;
  }

  function ThenableWrite(promise) { this._p = promise; }
  ThenableWrite.prototype.then = function (res, rej) { return this._p.then(res, rej); };
  ThenableWrite.prototype.catch = function (rej) { return this._p.catch(rej); };

  DbRef.prototype.set = function (value) {
    var s = this.segs; var clean = sanitize(value);
    if (s.length === 2) return new ThenableWrite(fsdb.collection(s[0]).doc(s[1]).set(clean));
    if (s.length > 2) {
      var upd = {}; upd[s.slice(2).join('.')] = clean;
      return new ThenableWrite(fsdb.collection(s[0]).doc(s[1]).set(upd, { merge: true }));
    }
    return Promise.reject(new Error('fs-shim: set() on collection root unsupported'));
  };

  DbRef.prototype.update = function (values) {
    var s = this.segs;
    if (s.length < 2) return Promise.reject(new Error('fs-shim: update() requires document-scoped ref'));
    var upd = {};
    Object.keys(values || {}).forEach(function (k) {
      var rel = String(k).split('/');
      upd[s.slice(2).concat(rel).join('.')] = sanitize(values[k]);
    });
    return new ThenableWrite(fsdb.collection(s[0]).doc(s[1]).update(upd));
  };

  DbRef.prototype.remove = function () {
    var s = this.segs;
    if (s.length === 2) return new ThenableWrite(fsdb.collection(s[0]).doc(s[1]).delete());
    if (s.length > 2) {
      // Read-modify-write: delete the key inside the parent doc's data.
      // Avoids FieldValue.delete() (unavailable in compat namespace).
      return new ThenableWrite(fsdb.collection(s[0]).doc(s[1]).get().then(function (d) {
        if (!d.exists) return;
        var data = JSON.parse(JSON.stringify(d.data()));
        var cur = data;
        for (var i = 2; i < s.length - 1; i++) {
          if (cur === null || typeof cur !== 'object') return; // nothing to remove
          cur = Object.prototype.hasOwnProperty.call(cur, s[i]) ? cur[s[i]] : undefined;
          if (cur === undefined) return;
        }
        if (cur && typeof cur === 'object') delete cur[s[s.length - 1]];
        return fsdb.collection(s[0]).doc(s[1]).set(data);
      }));
    }
    return Promise.reject(new Error('fs-shim: remove() on root unsupported'));
  };

  DbRef.prototype.push = function (value) {
    var id = pushId();
    var target = this.child(id); // key getter already resolves to id
    var started = (value !== undefined && value !== null)
      ? DbRef.prototype.set.call(target, value)._p
      : Promise.resolve();
    // NOTE: never resolve with `target` itself - it is a thenable and would
    // cause infinite thenable-unwrapping when awaited.
    target.then = function (res, rej) { return started.then(function () { if (typeof res === 'function') res(); }, rej); };
    target.catch = function (rej) { return started.catch(rej); };
    return target;
  };

  /* --------------------------- public surface --------------------------- */
  function ShimDatabase() { }
  ShimDatabase.prototype.ref = function (path) { return new DbRef(path); };
  ShimDatabase.prototype.ServerValue = { TIMESTAMP: (FV && FV.serverTimestamp) ? FV.serverTimestamp() : null };
  ShimDatabase.prototype.app = firebase.apps[0];

  firebase.database = function () { return new ShimDatabase(); };
  window.__UNMEI_FIRESTORE_SHIM = true;
})();