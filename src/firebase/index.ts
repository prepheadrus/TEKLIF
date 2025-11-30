
import { getApp, getApps, initializeApp, type FirebaseApp } from 'firebase/app';
import { getAuth, connectAuthEmulator, type Auth } from 'firebase/auth';
import {
  getFirestore,
  connectFirestoreEmulator,
  type Firestore,
} from 'firebase/firestore';

import { firebaseConfig } from './config';

export * from './provider';

let app: FirebaseApp;
let auth: Auth;
let firestore: Firestore;

export function initializeFirebase(): {
  app: FirebaseApp;
  auth: Auth;
  firestore: Firestore;
} {
  if (getApps().length === 0) {
    app = initializeApp(firebaseConfig);
    auth = getAuth(app);
    firestore = getFirestore(app);

    // If you want to use the local emulators, uncomment the following lines.
    // Make sure you have the Firebase CLI installed and are running the emulators.
    // connectAuthEmulator(auth, "http://127.0.0.1:9099", { disableWarnings: true });
    // connectFirestoreEmulator(firestore, "127.0.0.1", 8080);

  } else {
    app = getApp();
    auth = getAuth(app);
    firestore = getFirestore(app);
  }

  return { app, auth, firestore };
}
