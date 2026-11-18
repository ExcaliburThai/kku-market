import { initializeApp } from 'firebase/app';
import { getAuth } from 'firebase/auth';
const e=import.meta.env;
export const firebaseConfigured=Boolean(e.VITE_FIREBASE_API_KEY&&!e.VITE_FIREBASE_API_KEY.startsWith('YOUR_')&&e.VITE_FIREBASE_PROJECT_ID&&e.VITE_FIREBASE_AUTH_DOMAIN&&e.VITE_FIREBASE_APP_ID);
export const auth=firebaseConfigured?getAuth(initializeApp({apiKey:e.VITE_FIREBASE_API_KEY,authDomain:e.VITE_FIREBASE_AUTH_DOMAIN,projectId:e.VITE_FIREBASE_PROJECT_ID,appId:e.VITE_FIREBASE_APP_ID})):null;
