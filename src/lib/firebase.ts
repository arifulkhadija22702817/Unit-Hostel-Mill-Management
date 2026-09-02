import { initializeApp, getApps, getApp } from 'firebase/app';
import { 
  initializeFirestore, 
  persistentLocalCache, 
  persistentMultipleTabManager, 
  doc, 
  onSnapshot, 
  setDoc, 
  updateDoc, 
  getDoc 
} from 'firebase/firestore';
import { 
  getAuth, 
  GoogleAuthProvider, 
  signInWithPopup, 
  signOut, 
  onAuthStateChanged,
  type User 
} from 'firebase/auth';
import firebaseConfig from '../../firebase-applet-config.json';

const app = getApps().length === 0 ? initializeApp(firebaseConfig) : getApp();

const dbId = firebaseConfig.firestoreDatabaseId || '(default)';

// Enable Multi-Tab Offline Persistent Cache
export const db = initializeFirestore(app, {
  localCache: persistentLocalCache({
    tabManager: persistentMultipleTabManager()
  })
}, dbId);

export const auth = getAuth(app);
export const googleProvider = new GoogleAuthProvider();
googleProvider.setCustomParameters({ prompt: 'select_account' });

export const MESS_DOC_REF = doc(db, 'mess_app', 'default');

export interface ConfiguredEditor {
  id?: string;
  name: string;
  email: string;
  pin: string;
}

export interface MessRealtimeData {
  millMembers?: any[];
  millDate?: string;
  millManager?: string;
  attendanceData?: Record<string, Record<string, boolean>>;
  mealOffDays?: any[];
  fineEnabled?: boolean;
  attStartDate?: string;
  attEndDate?: string;
  guestRate?: number;
  guestDateList?: string[];
  guestData?: Record<string, Record<string, boolean>>;
  depositData?: Record<string, any>;
  bazarData?: any[];
  bazarStartDate?: string;
  bazarEndDate?: string;
  manualSmallBazar?: number;
  manualBigBazar?: number;
  historyList?: any[];
  adminPin?: string;
  editorPin?: string;
  configuredEditors?: ConfiguredEditor[];
  activeEditors?: Array<{ id: string; name: string; joinedAt: string }>;
  editorRequests?: Array<{ id: string; name: string; requestedAt: string; status: 'pending' | 'approved' | 'rejected' }>;
  blockedUsers?: string[];
  sessionLogs?: any[];
  memberEmails?: Record<string, string>;
  memberPins?: Record<string, string>;
  adminEmails?: string[];
  lastUpdated?: string;
}

// Google Sign-In with Popup
export async function loginWithGoogle(): Promise<{ user: User | null; error: string | null }> {
  try {
    const result = await signInWithPopup(auth, googleProvider);
    return { user: result.user, error: null };
  } catch (error: any) {
    if (error?.code !== 'auth/popup-closed-by-user') {
      console.error('Google Sign In Error:', error);
    }
    let msg = error.message || 'গুগল সাইন-ইন সম্পন্ন হতে সমস্যা হয়েছে!';
    if (error.code === 'auth/popup-closed-by-user') {
      msg = 'গুগল লগইন পপআপ উইন্ডোটি বন্ধ করা হয়েছে।';
    } else if (error.code === 'auth/popup-blocked') {
      msg = 'ব্রাউজারে পপআপ ব্লক করা আছে। দয়া করে ব্রাউজার সেটিংসে পপআপ অনুমোদন করুন।';
    }
    return { user: null, error: msg };
  }
}

// Logout from Firebase
export async function logoutFromFirebase(): Promise<void> {
  try {
    await signOut(auth);
  } catch (e) {
    console.error('Firebase Logout Error:', e);
  }
}

// Subscribe to real-time updates from Firestore
export function subscribeToMessData(onData: (data: MessRealtimeData) => void, onError?: (err: any) => void) {
  return onSnapshot(
    MESS_DOC_REF,
    (snapshot) => {
      if (snapshot.exists()) {
        onData(snapshot.data() as MessRealtimeData);
      } else {
        onData({});
      }
    },
    (error) => {
      console.error('Firestore Realtime Error:', error);
      if (onError) onError(error);
    }
  );
}

// Push updates to Firestore
export async function pushMessDataUpdate(dataPartial: Partial<MessRealtimeData>) {
  try {
    const updatedPayload = {
      ...dataPartial,
      lastUpdated: new Date().toISOString()
    };
    await setDoc(MESS_DOC_REF, updatedPayload, { merge: true });
  } catch (err) {
    console.error('Failed to update Firestore realtime data:', err);
  }
}
