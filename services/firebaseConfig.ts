
import { initializeApp } from 'firebase/app';
import { getFirestore } from 'firebase/firestore';

// Cast import.meta to any to avoid TypeScript errors when Vite types aren't loaded
const env = (import.meta as any).env;

const firebaseConfig = {
  apiKey: env.VITE_FIREBASE_API_KEY,
  authDomain: env.VITE_FIREBASE_AUTH_DOMAIN,
  projectId: env.VITE_FIREBASE_PROJECT_ID,
  storageBucket: env.VITE_FIREBASE_STORAGE_BUCKET,
  messagingSenderId: env.VITE_FIREBASE_MESSAGING_SENDER_ID,
  appId: env.VITE_FIREBASE_APP_ID
};

let db: any = null;

if (firebaseConfig.apiKey && firebaseConfig.projectId) {
  try {
    const app = initializeApp(firebaseConfig);
    db = getFirestore(app);
    console.log("🔥 Firebase initialized successfully.");
  } catch (error) {
    console.error("Firebase Initialization Error:", error);
    alert("Critical Error: Could not connect to Database.");
  }
} else {
    console.error("Firebase Configuration Missing. Please check your .env file.");
    alert("Database Configuration Missing.");
}

export { db };
