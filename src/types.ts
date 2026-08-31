export type ThemeType = 'light' | 'dark' | 'dark-purple' | 'dark-green' | 'blue' | 'green' | 'purple' | 'pink';

export interface MillMember {
  name: string;
  fineMeals: number;
  presentMeals: number;
  presentExtra: number;
  guestMeals: number;
  deposit: number;
  paid: boolean;
}

export interface AttendanceData {
  [memberName: string]: {
    [dateStr: string]: boolean;
  };
}

export interface MealOffDay {
  date: string;
  members: number;
  timestamp: string;
}

export interface GuestData {
  [memberName: string]: {
    [dateStr: string]: boolean;
  };
}

export interface DepositEntry {
  amount: number;
  date: string;
  time: string;
  timestamp: string;
}

export interface MemberDepositData {
  entries: DepositEntry[];
  total: number;
  extra: number;
}

export interface DepositDataMap {
  [memberName: string]: MemberDepositData;
}

export interface BazarRow {
  date: string;
  bigBazar: number;
  bigSignature: string;
  smallBazar: number;
  smallSignature: string;
  updatedAt?: string;
}

export interface HistoryEntry {
  id?: string;
  timestamp: string;
  resetByRole?: 'editor' | 'admin' | 'viewer';
  resetType?: string;
  data: string;
  snapshotData?: {
    millMembers?: MillMember[];
    millDate?: string;
    millManager?: string;
    attStartDate?: string;
    attEndDate?: string;
    attendanceData?: AttendanceData;
    mealOffDays?: MealOffDay[];
    fineEnabled?: boolean;
    guestRate?: number;
    guestDateList?: string[];
    guestData?: GuestData;
    depositData?: DepositDataMap;
    bazarStartDate?: string;
    bazarEndDate?: string;
    bazarData?: BazarRow[];
  };
}

export interface EditorAccessRequest {
  id: string;
  name: string;
  requestedAt: string;
  status: 'pending' | 'approved' | 'rejected';
}

export interface ConfirmationModalState {
  isOpen: boolean;
  message: string;
  onConfirm: () => void;
  onCancel?: () => void;
}

export interface UserSessionLog {
  id: string;
  name: string;
  role: 'admin' | 'editor' | 'member' | 'viewer';
  action: 'login' | 'logout' | 'approved' | 'rejected' | 'removed' | 'update' | 'reset';
  timestamp: string;
  details?: string;
}

export type MemberEmailMap = Record<string, string>;
