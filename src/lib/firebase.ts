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
import firebaseConfig from '../../firebase-applet-config.json';

const app = getApps().length === 0 ? initializeApp(firebaseConfig) : getApp();

const dbId = firebaseConfig.firestoreDatabaseId || '(default)';

// Enable Multi-Tab Offline Persistent Cache
export const db = initializeFirestore(app, {
  localCache: persistentLocalCache({
    tabManager: persistentMultipleTabManager()
  })
}, dbId);

export const MESS_DOC_REF = doc(db, 'mess_app', 'default');

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
  historyList?: any[];
  adminPin?: string;
  editorPin?: string;
  activeEditors?: Array<{ id: string; name: string; joinedAt: string }>;
  editorRequests?: Array<{ id: string; name: string; requestedAt: string; status: 'pending' | 'approved' | 'rejected' }>;
  blockedUsers?: string[];
  sessionLogs?: any[];
  lastUpdated?: string;
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
    const docSnap = await getDoc(MESS_DOC_REF);
    const updatedPayload = {
      ...dataPartial,
      lastUpdated: new Date().toISOString()
    };
    if (!docSnap.exists()) {
      await setDoc(MESS_DOC_REF, updatedPayload, { merge: true });
    } else {
      await updateDoc(MESS_DOC_REF, updatedPayload);
    }
  } catch (err) {
    console.error('Failed to update Firestore realtime data:', err);
    // Fallback merge
    await setDoc(MESS_DOC_REF, { ...dataPartial, lastUpdated: new Date().toISOString() }, { merge: true });
  }
}
