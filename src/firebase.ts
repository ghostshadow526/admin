import { initializeApp } from 'firebase/app';
import {
  getAuth,
  signInWithEmailAndPassword,
  signOut,
  onAuthStateChanged,
  type User as FirebaseUser,
} from 'firebase/auth';
import {
  getFirestore,
  collection,
  getDocs,
  updateDoc,
  doc,
  getDoc,
  setDoc,
  Timestamp,
} from 'firebase/firestore';
import { getFunctions, httpsCallable } from 'firebase/functions';

import appletConfig from '../firebase-applet-config.json';

const env = import.meta.env;

// Prefer Vercel/build-time env vars, fallback to repo config.
// (Firebase Web apiKey is not a secret; it must be present client-side.)
const firebaseConfig = {
  apiKey: env.VITE_FIREBASE_API_KEY || appletConfig.apiKey,
  authDomain: env.VITE_FIREBASE_AUTH_DOMAIN || appletConfig.authDomain,
  projectId: env.VITE_FIREBASE_PROJECT_ID || appletConfig.projectId,
  storageBucket: env.VITE_FIREBASE_STORAGE_BUCKET || appletConfig.storageBucket,
  messagingSenderId: env.VITE_FIREBASE_MESSAGING_SENDER_ID || appletConfig.messagingSenderId,
  appId: env.VITE_FIREBASE_APP_ID || appletConfig.appId,
};

const app = initializeApp(firebaseConfig);
export const auth = getAuth(app);

const firestoreDatabaseId = env.VITE_FIREBASE_DATABASE_ID || appletConfig.firestoreDatabaseId;
export const db = firestoreDatabaseId ? getFirestore(app, firestoreDatabaseId) : getFirestore(app);
export const functions = getFunctions(app, 'us-central1');

export const getImagekitAuth = httpsCallable<unknown, {
  token: string;
  expire: number;
  signature: string;
  publicKey: string;
}>(functions, 'imagekitAuth');

export const createOrUpdateUserDoc = async (userId: string, email: string, userData?: any) => {
  try {
    const userRef = doc(db, 'users', userId);
    const userSnap = await getDoc(userRef);
    
    if (!userSnap.exists()) {
      // Create new user document
      await setDoc(userRef, {
        email,
        displayName: userData?.displayName || '',
        role: 'user',
        createdAt: Timestamp.now(),
        ...userData,
      });
      console.log('✓ User document created');
    } else {
      // Update last login
      await updateDoc(userRef, {
        lastLogin: Timestamp.now(),
      });
      console.log('✓ User document updated');
    }
  } catch (error: any) {
    console.error('Failed to create/update user doc:', error);
    throw error;
  }
};

export const loginAdmin = async (email: string, password: string) => {
  try {
    console.log('Signing in with email:', email);
    const userCredential = await signInWithEmailAndPassword(auth, email, password);
    const user = userCredential.user;
    console.log('✓ Login successful!', user.uid);
    
    // Create or update user document in Firestore
    await createOrUpdateUserDoc(user.uid, user.email || email);
    
    localStorage.setItem('adminEmail', user.email || '');
    localStorage.setItem('adminUid', user.uid);
    return { success: true, user };
  } catch (error: any) {
    console.error('Login failed:', error.message);
    throw error;
  }
};

export const logoutAdmin = async () => {
  try {
    await signOut(auth);
    localStorage.removeItem('adminEmail');
    localStorage.removeItem('adminUid');
  } catch (error: any) {
    console.error('Logout failed:', error);
    throw error;
  }
};

export const onAuthChange = (callback: (user: FirebaseUser | null) => void) => {
  return onAuthStateChanged(auth, callback);
};

export const promoteUserToAdmin = async (userId: string) => {
  try {
    const userRef = doc(db, 'users', userId);
    await updateDoc(userRef, { role: 'admin' });
    console.log('✓ User promoted to admin');
    return { success: true };
  } catch (error: any) {
    console.error('Failed to promote user:', error);
    throw error;
  }
};

export const createAdminInvite = async (email: string, displayName: string) => {
  try {
    // Store admin invite in Firestore
    // This will require manual user creation in Firebase Auth console
    const adminRef = doc(collection(db, 'admin-invites'));
    await setDoc(adminRef, {
      email,
      displayName,
      status: 'pending',
      createdAt: Timestamp.now(),
      createdBy: localStorage.getItem('adminEmail'),
    });
    console.log('✓ Admin invite created');
    return { success: true, inviteId: adminRef.id };

  } catch (error: any) {
    console.error('Failed to create admin invite:', error);
    throw error;
  }

};


// Firestore exports
export {
  FirebaseUser,
  collection,
  getDocs,
  updateDoc,
  doc,
  getDoc,
  setDoc,
  Timestamp,
};
