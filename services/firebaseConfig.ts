// Import the functions you need from the SDKs you need
import { initializeApp } from "firebase/app";
import { getAnalytics } from "firebase/analytics";
// TODO: Add SDKs for Firebase products that you want to use
// https://firebase.google.com/docs/web/setup#available-libraries

// Your web app's Firebase configuration
// For Firebase JS SDK v7.20.0 and later, measurementId is optional
const firebaseConfig = {
  apiKey: "AIzaSyBm9-55KfxxbnBC89xBbXfoK2AHGzI2KoY",
  authDomain: "dbj-queue.firebaseapp.com",
  projectId: "dbj-queue",
  storageBucket: "dbj-queue.firebasestorage.app",
  messagingSenderId: "29922630063",
  appId: "1:29922630063:web:c63e5883cd9aaa3108375a",
  measurementId: "G-QJ00PN3SDF"
};

// Initialize Firebase
const app = initializeApp(firebaseConfig);
const analytics = getAnalytics(app);
