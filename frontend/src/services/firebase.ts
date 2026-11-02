import { initializeApp, getApps, getApp, type FirebaseApp } from 'firebase/app';
import { getFirestore, type Firestore } from 'firebase/firestore';

export interface FirebaseConfig {
  apiKey: string;
  authDomain: string;
  projectId: string;
  storageBucket: string;
  messagingSenderId: string;
  appId: string;
}

export const firebaseConfig: FirebaseConfig = {
  apiKey: (import.meta.env.VITE_FIREBASE_API_KEY as string) || 'AIzaSyCi1hpPjQmgh2Oop1st11MdwmOCRzm9xaU',
  authDomain: (import.meta.env.VITE_FIREBASE_AUTH_DOMAIN as string) || 'debtlens-ise.firebaseapp.com',
  projectId: (import.meta.env.VITE_FIREBASE_PROJECT_ID as string) || 'debtlens-ise',
  storageBucket: (import.meta.env.VITE_FIREBASE_STORAGE_BUCKET as string) || 'debtlens-ise.firebasestorage.app',
  messagingSenderId: (import.meta.env.VITE_FIREBASE_MESSAGING_SENDER_ID as string) || '116394215369',
  appId: (import.meta.env.VITE_FIREBASE_APP_ID as string) || '1:116394215369:web:da2c38c7c544f61cde8a18',
};

export const isFirebaseConfigured = Boolean(
  firebaseConfig.apiKey &&
  firebaseConfig.projectId &&
  !firebaseConfig.apiKey.includes('YOUR_API_KEY')
);

export const app: FirebaseApp = getApps().length > 0 ? getApp() : initializeApp(firebaseConfig);
export const firestore: Firestore = getFirestore(app);

