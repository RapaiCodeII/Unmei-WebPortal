(function () {
  window.__UNMEI_FIREBASE_CONFIG = {
    apiKey: "AIzaSyDI9ziVzajecsq7Ab4NPeCFb3VLDsa35UU",
    authDomain: "unmei-nihongo-center.firebaseapp.com",
    databaseURL: "https://unmei-nihongo-center-default-rtdb.asia-southeast1.firebasedatabase.app",
    projectId: "unmei-nihongo-center",
    storageBucket: "unmei-nihongo-center.firebasestorage.app",
    messagingSenderId: "357352911990",
    appId: "1:357352911990:web:91994d403c6153db635b57"
  };

  if (typeof firebase !== 'undefined' && !firebase.apps.length) {
    firebase.initializeApp(window.__UNMEI_FIREBASE_CONFIG);
    // BUG-13 FIX: Set auth persistence for multi-tab support
    if (firebase.auth) {
      firebase.auth().setPersistence(firebase.auth.Auth.Persistence.LOCAL).catch(function() {});
    }
  }
})();
