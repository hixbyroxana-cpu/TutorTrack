import { initializeApp } from 'firebase/app';
import { getAuth, signInAnonymously } from 'firebase/auth';
import { getFirestore } from 'firebase/firestore';

const firebaseConfig = {
  apiKey: (import.meta as ImportMeta & { env?: Record<string, string> }).env?.VITE_FIREBASE_API_KEY,
  authDomain: (import.meta as ImportMeta & { env?: Record<string, string> }).env?.VITE_FIREBASE_AUTH_DOMAIN,
  projectId: (import.meta as ImportMeta & { env?: Record<string, string> }).env?.VITE_FIREBASE_PROJECT_ID,
  storageBucket: (import.meta as ImportMeta & { env?: Record<string, string> }).env?.VITE_FIREBASE_STORAGE_BUCKET,
  messagingSenderId: (import.meta as ImportMeta & { env?: Record<string, string> }).env?.VITE_FIREBASE_MESSAGING_SENDER_ID,
  appId: (import.meta as ImportMeta & { env?: Record<string, string> }).env?.VITE_FIREBASE_APP_ID,
};

const hasFirebaseConfig = Object.values(firebaseConfig).every(
  (value) => typeof value === 'string' && value.length > 0
);

const app = hasFirebaseConfig ? initializeApp(firebaseConfig) : null;

const auth = app ? getAuth(app) : null;
export const firestore = app ? getFirestore(app) : null;
export const isFirestoreConfigured = hasFirebaseConfig;

export async function ensureFirebaseAuth(): Promise<void> {
  if (!auth || auth.currentUser) return;
  await signInAnonymously(auth);
}
