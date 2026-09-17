import { initializeApp } from "firebase/app";
import { getAuth } from "firebase/auth";
import { getDatabase } from "firebase/database";

const firebaseConfig = {
  apiKey: "AIzaSyDI9ziVzajecsq7Ab4NPeCFb3VLDsa35UU",
  authDomain: "unmei-nihongo-center.firebaseapp.com",
  databaseURL: "https://unmei-nihongo-center-default-rtdb.asia-southeast1.firebasedatabase.app",
  projectId: "unmei-nihongo-center",
  storageBucket: "unmei-nihongo-center.firebasestorage.app",
  messagingSenderId: "357352911990",
  appId: "1:357352911990:web:91994d403c6153db635b57"
};
const app = initializeApp(firebaseConfig);

// Initialize Firebase Authentication
export const auth = getAuth(app);

// RTDB RESTORED: Realtime Database is the system of record again.
// (databaseURL above is REQUIRED - the instance lives in asia-southeast1,
// so the SDK must target it explicitly instead of the default US URL.)
export const database = getDatabase(app);
