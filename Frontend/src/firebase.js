import { initializeApp } from "firebase/app";
import { getAnalytics } from "firebase/analytics";
import { getFirestore } from "firebase/firestore"; // Tambahkan ini
import { getAuth } from "firebase/auth";           // Tambahkan ini

const firebaseConfig = {
  apiKey: "AIzaSyBq9lMekzm_aq-2Buvub7E7f7dx1V5kTiA",
  authDomain: "kasir-pintar-93e03.firebaseapp.com",
  projectId: "kasir-pintar-93e03",
  storageBucket: "kasir-pintar-93e03.appspot.com",
  messagingSenderId: "166529415845",
  appId: "1:166529415845:web:1a876202c5de0fb6b62b4c",
  measurementId: "G-P0PNQ3B54B"
};

// Initialize Firebase
const app = initializeApp(firebaseConfig);
const analytics = getAnalytics(app);

// Inisialisasi Database dan Auth (INI YANG TADI KURANG)
const db = getFirestore(app);
const auth = getAuth(app);

// Export agar bisa dipakai di App.jsx
export { db, auth };