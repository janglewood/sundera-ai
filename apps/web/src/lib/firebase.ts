import { getApp, getApps, initializeApp, type FirebaseApp } from "firebase/app";
import { GoogleAuthProvider, getAuth, type Auth } from "firebase/auth";

const firebaseConfig = {
  apiKey: process.env.NEXT_PUBLIC_FIREBASE_API_KEY,
  authDomain: process.env.NEXT_PUBLIC_FIREBASE_AUTH_DOMAIN,
  projectId: process.env.NEXT_PUBLIC_FIREBASE_PROJECT_ID,
  storageBucket: process.env.NEXT_PUBLIC_FIREBASE_STORAGE_BUCKET,
  messagingSenderId: process.env.NEXT_PUBLIC_FIREBASE_MESSAGING_SENDER_ID,
  appId: process.env.NEXT_PUBLIC_FIREBASE_APP_ID,
};

// Firebase isn't configured until the console setup steps are done (see
// README/.env.example) — `isFirebaseConfigured` lets auth-context/api-client
// degrade to "signed out" instead of crashing pages that don't need auth.
export const isFirebaseConfigured = Boolean(firebaseConfig.apiKey);

let app: FirebaseApp | undefined;
let authInstance: Auth | undefined;

// Lazy: getAuth() throws synchronously on an invalid/missing API key, so it
// must not run at module import time (which would crash every page via the
// root-layout AuthProvider) — only call this from effects/handlers.
export function getFirebaseAuth(): Auth {
  if (!authInstance) {
    app ??= getApps().length ? getApp() : initializeApp(firebaseConfig);
    authInstance = getAuth(app);
  }
  return authInstance;
}

export const googleProvider = new GoogleAuthProvider();
