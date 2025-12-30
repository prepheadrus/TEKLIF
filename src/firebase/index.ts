'use client';

import { firebaseConfig } from '@/firebase/config';
import { initializeApp, getApps, getApp, FirebaseApp } from 'firebase/app';
import { getAuth, signInAnonymously } from 'firebase/auth';
import { getFirestore } from 'firebase/firestore';

// IMPORTANT: This function is critical for Firebase initialization.
export function initializeFirebase() {
  if (getApps().length) {
    // If an app is already initialized, return its SDKs.
    const app = getApp();
    const auth = getAuth(app);
    // This will trigger a sign-in only if there's no user.
    // It's safe to call multiple times.
    signInAnonymously(auth); 
    return getSdks(app);
  }

  // Otherwise, initialize a new app with the provided config.
  // This is the standard and most reliable way for client-side web apps.
  const firebaseApp = initializeApp(firebaseConfig);
  const auth = getAuth(firebaseApp);
  signInAnonymously(auth);
  return getSdks(firebaseApp);
}

export function getSdks(firebaseApp: FirebaseApp) {
  return {
    firebaseApp,
    auth: getAuth(firebaseApp),
    firestore: getFirestore(firebaseApp)
  };
}

export * from './provider';
export * from './client-provider';
export * from './firestore/use-collection';
export * from './firestore/use-doc';
export * from './non-blocking-updates';
export * from './errors';
export * from './error-emitter';
