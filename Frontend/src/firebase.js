import { initializeApp } from "firebase/app";
import { getFirestore } from "firebase/firestore";
import { getAuth } from "firebase/auth"; // Harus ada ini

const firebaseConfig = {
  // ... isi config milikmu ...
};

const app = initializeApp(firebaseConfig);
const db = getFirestore(app);
const auth = getAuth(app); // Harus ada ini

export { db, auth };