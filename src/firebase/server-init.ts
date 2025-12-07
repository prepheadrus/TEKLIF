import { initializeApp, getApps, getApp, cert, App } from 'firebase-admin/app';
import { getFirestore, Firestore } from 'firebase-admin/firestore';
import { firebaseConfig } from './config';

// This is a placeholder for your service account key.
// In a real application, this should be loaded securely, e.g., from environment variables.
const serviceAccount = process.env.FIREBASE_SERVICE_ACCOUNT
  ? JSON.parse(process.env.FIREBASE_SERVICE_ACCOUNT)
  : undefined;

function getAdminServices() {
  // If the service account isn't configured, server-side operations will fail.
  // Return null for the services to indicate they are unavailable.
  if (!serviceAccount) {
    console.warn(
      'Firebase Admin SDK service account not found. Server-side Firestore operations will be skipped.'
    );
    return { app: null, firestore: null };
  }

  try {
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
  } catch (error) {
    console.error("Failed to initialize Firebase Admin SDK:", error);
    // If initialization fails, return null services to prevent crashes.
    return { app: null, firestore: null };
  }
}

// Wrapper function to initialize and get SDKs.
// This is what you'll import into your server-side code.
export function initializeFirebase(): { app: App | null; firestore: Firestore | null } {
  return getAdminServices();
}
