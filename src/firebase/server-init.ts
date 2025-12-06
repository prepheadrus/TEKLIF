import { initializeApp, getApps, getApp, cert, App } from 'firebase-admin/app';
import { getFirestore, Firestore } from 'firebase-admin/firestore';
import { firebaseConfig } from './config';

// This is a placeholder for your service account key.
// In a real application, this should be loaded securely, e.g., from environment variables.
const serviceAccount = process.env.FIREBASE_SERVICE_ACCOUNT
  ? JSON.parse(process.env.FIREBASE_SERVICE_ACCOUNT)
  : undefined;

function getAdminServices() {
  if (!serviceAccount) {
    console.warn(
      'Firebase Admin SDK service account not found. Firestore operations on the server will fail.'
    );
    return { app: null, firestore: null };
  }

  const app = !getApps().length
    ? initializeApp({
        credential: cert(serviceAccount),
        databaseURL: firebaseConfig.databaseURL,
      })
    : getApp();

  return {
    app,
    firestore: getFirestore(app),
  };
}

// Wrapper function to initialize and get SDKs.
// This is what you'll import into your server-side code.
export function initializeFirebase(): { app: App | null; firestore: Firestore | null } {
  return getAdminServices();
}
