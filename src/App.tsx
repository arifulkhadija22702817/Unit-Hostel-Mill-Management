import React, { useState, useEffect, useMemo, useRef } from 'react';
import { LogOut } from 'lucide-react';
import { ThemeType, MillMember, AttendanceData, MealOffDay, GuestData, DepositDataMap, BazarRow, HistoryEntry, EditorAccessRequest, UserSessionLog } from './types';
import { PREDEFINED_MEMBERS } from './constants';
import { getBangladeshDateString, formatBnTime } from './utils/timeUtils';
import { Navbar } from './components/Navbar';
import { TabMeal } from './components/TabMeal';
import { TabAttendance } from './components/TabAttendance';
import { TabGuest } from './components/TabGuest';
import { TabDeposit } from './components/TabDeposit';
import { TabBazar } from './components/TabBazar';
import { ConfirmationModal } from './components/ConfirmationModal';
import { RoleAccessModal, UserRole, ActiveEditorSession } from './components/RoleAccessModal';
import { ATMAuthScreen } from './components/ATMAuthScreen';
import { subscribeToMessData, pushMessDataUpdate, MessRealtimeData, loginWithGoogle, logoutFromFirebase } from './lib/firebase';
import { MemberEmailMap, MemberPinMap } from './types';

export default function App() {
  // Navigation & UI State
  const [activeTab, setActiveTab] = useState<string>('mill');
  const [theme, setTheme] = useState<ThemeType>(() => {
    return (localStorage.getItem('mainTheme') as ThemeType) || 'light';
  });
  const [isAppAuthenticated, setIsAppAuthenticated] = useState<boolean>(() => {
    return localStorage.getItem('isAppAuthenticated') === 'true';
  });
  // Realtime & Role Management State
  const [isRealtimeSynced, setIsRealtimeSynced] = useState<boolean>(false);
  const [userRole, setUserRole] = useState<UserRole>(() => {
    return (localStorage.getItem('userRole') as UserRole) || 'viewer';
  });
  const [currentMemberName, setCurrentMemberName] = useState<string>(() => {
    return localStorage.getItem('currentMemberName') || '';
  });
  const [currentUserEmail, setCurrentUserEmail] = useState<string>(() => {
    return localStorage.getItem('currentUserEmail') || '';
  });

  const [memberEmails, setMemberEmails] = useState<MemberEmailMap>(() => {
    const saved = localStorage.getItem('memberEmails');
    if (saved) {
      try {
        return JSON.parse(saved);
      } catch (e) {}
    }
    return {};
  });

  const [memberPins, setMemberPins] = useState<MemberPinMap>(() => {
    const saved = localStorage.getItem('memberPins');
    if (saved) {
      try {
        return JSON.parse(saved);
      } catch (e) {}
    }
    return {};
  });

  const [adminEmails, setAdminEmails] = useState<string[]>(() => {
    const saved = localStorage.getItem('adminEmails');
    if (saved) {
      try {
        return JSON.parse(saved);
      } catch (e) {}
    }
    return [];
  });

  const [isInstallModalOpen, setIsInstallModalOpen] = useState<boolean>(false);
  const [isRoleModalOpen, setIsRoleModalOpen] = useState<boolean>(false);
  const [roleModalTab, setRoleModalTab] = useState<'login' | 'google_link' | 'management' | 'logs' | 'settings'>('login');

  const handleOpenRoleModal = (tab: 'login' | 'google_link' | 'management' | 'logs' | 'settings' = 'login') => {
    if (userRole !== 'admin' && (tab === 'management' || tab === 'settings')) {
      setRoleModalTab(tab === 'management' ? 'google_link' : 'login');
    } else {
      setRoleModalTab(tab);
    }
    setIsRoleModalOpen(true);
  };
  const [adminPin, setAdminPin] = useState<string>('1234');
  const [editorPin, setEditorPin] = useState<string>('5678');
  const [activeEditors, setActiveEditors] = useState<ActiveEditorSession[]>([]);
  const [editorRequests, setEditorRequests] = useState<EditorAccessRequest[]>([]);
  const [blockedUsers, setBlockedUsers] = useState<string[]>([]);
  
  // Unique Session ID for current client tab/device (Persisted in localStorage for login state persistence)
  const currentSessionId = useMemo(() => {
    let sid = localStorage.getItem('mess_session_id');
    if (!sid) {
      sid = 'sess_' + Math.random().toString(36).substring(2, 9) + '_' + Date.now();
      localStorage.setItem('mess_session_id', sid);
    }
    return sid;
  }, []);

  const myEditorSession = useMemo(() => {
    return activeEditors.find(e => e.id === currentSessionId);
  }, [activeEditors, currentSessionId]);

  // Saved Pins at login for auto password-change invalidation checks
  const [savedEditorPinAtLogin, setSavedEditorPinAtLogin] = useState<string>(() => {
    return localStorage.getItem('savedEditorPinAtLogin') || '';
  });
  const [savedAdminPinAtLogin, setSavedAdminPinAtLogin] = useState<string>(() => {
    return localStorage.getItem('savedAdminPinAtLogin') || '';
  });

  const [sessionLogs, setSessionLogs] = useState<UserSessionLog[]>(() => {
    const saved = localStorage.getItem('sessionLogs');
    if (saved) {
      try {
        return JSON.parse(saved);
      } catch (e) {}
    }
    return [];
  });

  const isRemoteUpdateRef = useRef<boolean>(false);

  // Confirmation Modal State
  const [confirmModal, setConfirmModal] = useState<{
    isOpen: boolean;
    message: string;
    onConfirm: () => void;
  }>({
    isOpen: false,
    message: '',
    onConfirm: () => {},
  });

  const requestConfirmation = (message: string, action: () => void) => {
    setConfirmModal({
      isOpen: true,
      message,
      onConfirm: () => {
        action();
        setConfirmModal(prev => ({ ...prev, isOpen: false }));
      },
    });
  };

  // Permission Verification Helpers
  const canEditData = userRole === 'admin' || userRole === 'editor';
  const canAdminData = userRole === 'admin';

  const requireEditPermission = (action: () => void) => {
    if (canEditData) {
      action();
    } else {
      setIsRoleModalOpen(true);
    }
  };

  const requireAdminAction = (action: () => void) => {
    if (canAdminData) {
      action();
    } else {
      setIsRoleModalOpen(true);
    }
  };

  // 1. MILL STATE
  const [millMembers, setMillMembers] = useState<MillMember[]>(() => {
    const saved = localStorage.getItem('millMembers');
    if (saved) {
      try {
        return JSON.parse(saved);
      } catch (e) {}
    }
    return PREDEFINED_MEMBERS.map(name => ({
      name,
      fineMeals: 0,
      presentMeals: 0,
      presentExtra: 0,
      guestMeals: 0,
      deposit: 0,
      paid: false,
    }));
  });

  const [millDate, setMillDate] = useState<string>(() => {
    return localStorage.getItem('mill_date') || getBangladeshDateString();
  });

  const [millManager, setMillManager] = useState<string>(() => {
    return localStorage.getItem('mill_manager') || '';
  });

  const [historyList, setHistoryList] = useState<HistoryEntry[]>(() => {
    const saved = localStorage.getItem('savedHistory');
    if (saved) {
      try {
        return JSON.parse(saved);
      } catch (e) {
        return [];
      }
    }
    return [];
  });

  // 2. ATTENDANCE STATE
  const [attStartDate, setAttStartDate] = useState<string>(() => {
    return localStorage.getItem('att_start_date') || '';
  });

  const [attEndDate, setAttEndDate] = useState<string>(() => {
    return localStorage.getItem('att_end_date') || '';
  });

  const [dateRange, setDateRange] = useState<Date[]>([]);

  const [attendanceData, setAttendanceData] = useState<AttendanceData>(() => {
    const saved = localStorage.getItem('attendanceData');
    if (saved) {
      try {
        return JSON.parse(saved);
      } catch (e) {}
    }
    return {};
  });

  const [mealOffDays, setMealOffDays] = useState<MealOffDay[]>(() => {
    const saved = localStorage.getItem('mealOffDays');
    if (saved) {
      try {
        return JSON.parse(saved);
      } catch (e) {}
    }
    return [];
  });

  const [fineEnabled, setFineEnabled] = useState<boolean>(() => {
    const saved = localStorage.getItem('fineEnabled');
    return saved !== null ? saved === 'true' : true;
  });

  // 3. GUEST STATE
  const [guestRate, setGuestRate] = useState<number>(() => {
    const saved = localStorage.getItem('guestRate');
    return saved ? parseFloat(saved) || 0 : 0;
  });

  const [guestDateList, setGuestDateList] = useState<string[]>(() => {
    const saved = localStorage.getItem('guestDateList');
    if (saved) {
      try {
        return JSON.parse(saved);
      } catch (e) {}
    }
    return [];
  });

  const [guestData, setGuestData] = useState<GuestData>(() => {
    const saved = localStorage.getItem('guestData');
    if (saved) {
      try {
        return JSON.parse(saved);
      } catch (e) {}
    }
    return {};
  });

  // 4. DEPOSIT STATE
  const [depositData, setDepositData] = useState<DepositDataMap>(() => {
    const saved = localStorage.getItem('depositData');
    let map: DepositDataMap = {};
    if (saved) {
      try {
        map = JSON.parse(saved);
      } catch (e) {}
    }
    PREDEFINED_MEMBERS.forEach(name => {
      if (!map[name]) {
        map[name] = { entries: [], total: 0, extra: 0 };
      }
    });
    return map;
  });

  // 5. BAZAR STATE
  const [bazarStartDate, setBazarStartDate] = useState<string>(() => {
    return localStorage.getItem('bazar_start_date') || '';
  });

  const [bazarEndDate, setBazarEndDate] = useState<string>(() => {
    return localStorage.getItem('bazar_end_date') || '';
  });

  const [bazarData, setBazarData] = useState<BazarRow[]>(() => {
    const saved = localStorage.getItem('bazarData');
    if (saved) {
      try {
        return JSON.parse(saved);
      } catch (e) {}
    }
    return [];
  });

  const [manualSmallBazar, setManualSmallBazar] = useState<number | null>(() => {
    const saved = localStorage.getItem('manualSmallBazar');
    return saved !== null && saved !== '' ? parseFloat(saved) : null;
  });

  const [manualBigBazar, setManualBigBazar] = useState<number | null>(() => {
    const saved = localStorage.getItem('manualBigBazar');
    return saved !== null && saved !== '' ? parseFloat(saved) : null;
  });

  // ── FIREBASE REALTIME SUBSCRIPTION ──
  useEffect(() => {
    const unsubscribe = subscribeToMessData((remote) => {
      setIsRealtimeSynced(true);
      isRemoteUpdateRef.current = true;

      if (remote.millMembers) setMillMembers(remote.millMembers);
      if (remote.millDate) setMillDate(remote.millDate);
      if (remote.millManager !== undefined) setMillManager(remote.millManager);
      if (remote.historyList) setHistoryList(remote.historyList);
      if (remote.attStartDate !== undefined) setAttStartDate(remote.attStartDate);
      if (remote.attEndDate !== undefined) setAttEndDate(remote.attEndDate);
      if (remote.attendanceData) setAttendanceData(remote.attendanceData);
      if (remote.mealOffDays) setMealOffDays(remote.mealOffDays);
      if (remote.fineEnabled !== undefined) setFineEnabled(remote.fineEnabled);
      if (remote.guestRate !== undefined) setGuestRate(remote.guestRate);
      if (remote.guestDateList) setGuestDateList(remote.guestDateList);
      if (remote.guestData) setGuestData(remote.guestData);
      if (remote.depositData) setDepositData(remote.depositData);
      if (remote.bazarStartDate !== undefined) setBazarStartDate(remote.bazarStartDate);
      if (remote.bazarEndDate !== undefined) setBazarEndDate(remote.bazarEndDate);
      if (remote.bazarData) setBazarData(remote.bazarData);
      if (remote.manualSmallBazar !== undefined) setManualSmallBazar(remote.manualSmallBazar);
      if (remote.manualBigBazar !== undefined) setManualBigBazar(remote.manualBigBazar);
      if (remote.adminPin) setAdminPin(remote.adminPin);
      if (remote.editorPin) setEditorPin(remote.editorPin);
      if (remote.activeEditors) setActiveEditors(remote.activeEditors);
      if (remote.editorRequests) setEditorRequests(remote.editorRequests);
      if (remote.blockedUsers) setBlockedUsers(remote.blockedUsers);
      if (remote.sessionLogs) setSessionLogs(remote.sessionLogs);
      if (remote.memberEmails) setMemberEmails(remote.memberEmails);
      if (remote.memberPins) setMemberPins(remote.memberPins);
      if (remote.adminEmails) setAdminEmails(remote.adminEmails);

      setTimeout(() => {
        isRemoteUpdateRef.current = false;
      }, 100);
    });

    return () => unsubscribe();
  }, []);

  // Save Role & Theme
  useEffect(() => {
    localStorage.setItem('mainTheme', theme);
  }, [theme]);

  useEffect(() => {
    localStorage.setItem('userRole', userRole);
  }, [userRole]);

  // Sync state changes to Firebase
  const syncToFirebase = (partial: Partial<MessRealtimeData>) => {
    if (!isRemoteUpdateRef.current) {
      pushMessDataUpdate(partial);
    }
  };

  // State update handlers with automatic Firebase Realtime Syncing & Permission check
  const updateMillMembers = (action: React.SetStateAction<MillMember[]>) => {
    requireEditPermission(() => {
      setMillMembers(prev => {
        const next = typeof action === 'function' ? action(prev) : action;
        localStorage.setItem('millMembers', JSON.stringify(next));
        syncToFirebase({ millMembers: next });
        return next;
      });
    });
  };

  const updateMillDate = (d: string) => {
    requireEditPermission(() => {
      setMillDate(d);
      localStorage.setItem('mill_date', d);
      syncToFirebase({ millDate: d });
    });
  };

  const updateMillManager = (m: string) => {
    requireEditPermission(() => {
      setMillManager(m);
      localStorage.setItem('mill_manager', m);
      syncToFirebase({ millManager: m });
    });
  };

  const updateAttendanceData = (action: React.SetStateAction<AttendanceData>) => {
    if (userRole === 'admin' || userRole === 'editor' || userRole === 'member') {
      setAttendanceData(prev => {
        const next = typeof action === 'function' ? action(prev) : action;
        localStorage.setItem('attendanceData', JSON.stringify(next));
        syncToFirebase({ attendanceData: next });
        return next;
      });
    } else {
      setIsRoleModalOpen(true);
    }
  };

  const updateMealOffDays = (action: React.SetStateAction<MealOffDay[]>) => {
    requireEditPermission(() => {
      setMealOffDays(prev => {
        const next = typeof action === 'function' ? action(prev) : action;
        localStorage.setItem('mealOffDays', JSON.stringify(next));
        syncToFirebase({ mealOffDays: next });
        return next;
      });
    });
  };

  const updateFineEnabled = (enabled: boolean) => {
    requireAdminAction(() => {
      setFineEnabled(enabled);
      localStorage.setItem('fineEnabled', enabled.toString());
      syncToFirebase({ fineEnabled: enabled });
    });
  };

  const updateGuestRate = (rate: number) => {
    requireAdminAction(() => {
      setGuestRate(rate);
      localStorage.setItem('guestRate', rate.toString());
      syncToFirebase({ guestRate: rate });
    });
  };

  const updateGuestDateList = (action: React.SetStateAction<string[]>) => {
    requireEditPermission(() => {
      setGuestDateList(prev => {
        const next = typeof action === 'function' ? action(prev) : action;
        localStorage.setItem('guestDateList', JSON.stringify(next));
        syncToFirebase({ guestDateList: next });
        return next;
      });
    });
  };

  const updateGuestData = (action: React.SetStateAction<GuestData>) => {
    requireEditPermission(() => {
      setGuestData(prev => {
        const next = typeof action === 'function' ? action(prev) : action;
        localStorage.setItem('guestData', JSON.stringify(next));
        syncToFirebase({ guestData: next });
        return next;
      });
    });
  };

  const updateDepositData = (action: React.SetStateAction<DepositDataMap>) => {
    requireEditPermission(() => {
      setDepositData(prev => {
        const next = typeof action === 'function' ? action(prev) : action;
        localStorage.setItem('depositData', JSON.stringify(next));
        syncToFirebase({ depositData: next });
        return next;
      });
    });
  };

  const updateBazarData = (action: React.SetStateAction<BazarRow[]>) => {
    requireEditPermission(() => {
      setBazarData(prev => {
        const next = typeof action === 'function' ? action(prev) : action;
        localStorage.setItem('bazarData', JSON.stringify(next));
        syncToFirebase({ bazarData: next });
        return next;
      });
    });
  };

  // Generate Attendance Date Range on mount or dates change
  useEffect(() => {
    if (attStartDate && attEndDate) {
      const start = new Date(attStartDate);
      const end = new Date(attEndDate);
      if (start <= end) {
        const range: Date[] = [];
        let curr = new Date(start);
        let count = 0;
        while (curr <= end && count < 60) {
          range.push(new Date(curr));
          curr.setDate(curr.getDate() + 1);
          count++;
        }
        setDateRange(range);
      }
    }
  }, [attStartDate, attEndDate]);

  // Calculate Fixed Meal
  const totalMealDays = useMemo(() => {
    const offDates = mealOffDays.map(d => d.date);
    return dateRange.filter(d => !offDates.includes(d.toISOString().split('T')[0])).length;
  }, [dateRange, mealOffDays]);

  const fixedMeal = useMemo(() => {
    if (totalMealDays <= 0) return 0;
    return totalMealDays % 2 === 0 ? totalMealDays / 2 : (totalMealDays - 1) / 2;
  }, [totalMealDays]);

  // Guest Count per Date Map
  const guestCountPerDate = useMemo(() => {
    const map: { [dateStr: string]: number } = {};
    guestDateList.forEach(dateStr => {
      let sum = 0;
      millMembers.forEach(m => {
        if (guestData[m.name]?.[dateStr]) sum++;
      });
      map[dateStr] = sum;
    });
    return map;
  }, [guestDateList, millMembers, guestData]);

  // Total Meal Value calculation
  const totalMealValue = useMemo(() => {
    let sum = 0;
    millMembers.forEach(m => {
      let presentCount = 0;
      dateRange.forEach(d => {
        const dStr = d.toISOString().split('T')[0];
        if (!mealOffDays.some(off => off.date === dStr)) {
          if (attendanceData[m.name]?.[dStr]) presentCount++;
        }
      });
      const fine = (fixedMeal > presentCount && fineEnabled) ? (fixedMeal - presentCount) : 0;
      sum += presentCount + fine;
    });
    return sum;
  }, [millMembers, dateRange, mealOffDays, attendanceData, fixedMeal, fineEnabled]);

  // Bazar Sums & Guest Cost adjustment
  const totalGuestMealsSum = useMemo(() => {
    let count = 0;
    millMembers.forEach(m => {
      guestDateList.forEach(d => {
        if (guestData[m.name]?.[d]) count++;
      });
    });
    return count;
  }, [millMembers, guestDateList, guestData]);

  const totalBazarSums = useMemo(() => {
    let big = 0;
    let small = 0;
    bazarData.forEach(row => {
      big += row.bigBazar || 0;
      small += row.smallBazar || 0;
    });
    return { big, small, rawBig: big };
  }, [bazarData]);

  const effectiveSmallBazar = manualSmallBazar !== null ? manualSmallBazar : totalBazarSums.small;
  const effectiveBigBazar = manualBigBazar !== null ? manualBigBazar : totalBazarSums.big;

  const handleSetMillSmall = (val: number) => {
    requireEditPermission(() => {
      setManualSmallBazar(val);
      localStorage.setItem('manualSmallBazar', val.toString());
      syncToFirebase({ manualSmallBazar: val });
    });
  };

  const handleSetMillBig = (val: number) => {
    requireEditPermission(() => {
      setManualBigBazar(val);
      localStorage.setItem('manualBigBazar', val.toString());
      syncToFirebase({ manualBigBazar: val });
    });
  };

  // Synchronize Attendance, Guests, Deposits into MillMembers
  useEffect(() => {
    setMillMembers(prev => {
      return prev.map(m => {
        // 1. Attendance present & fine
        let presentCount = 0;
        dateRange.forEach(d => {
          const dStr = d.toISOString().split('T')[0];
          if (!mealOffDays.some(off => off.date === dStr)) {
            if (attendanceData[m.name]?.[dStr]) presentCount++;
          }
        });
        const fine = (fixedMeal > presentCount && fineEnabled) ? (fixedMeal - presentCount) : 0;

        // 2. Guest count
        let guestCount = 0;
        guestDateList.forEach(dStr => {
          if (guestData[m.name]?.[dStr]) guestCount++;
        });

        // 3. Deposit & Extra
        const depInfo = depositData[m.name] || { total: 0, extra: 0 };

        return {
          ...m,
          presentMeals: presentCount,
          fineMeals: fine,
          guestMeals: guestCount,
          deposit: depInfo.total || 0,
          presentExtra: depInfo.extra || 0,
        };
      });
    });
  }, [dateRange, attendanceData, mealOffDays, fixedMeal, fineEnabled, guestDateList, guestData, depositData]);

  // Role & Session Sync Monitoring (Persisted Login until Admin Remove/Block/Pin Change or Self Logout)
  useEffect(() => {
    if (!isRealtimeSynced) return;

    if (userRole === 'editor') {
      const mySession = activeEditors.find(e => e.id === currentSessionId);
      const isSessionActive = !!mySession;
      const isBlocked = mySession ? blockedUsers.some(b => b.toLowerCase() === mySession.name.toLowerCase()) : false;
      const isPinMismatch = savedEditorPinAtLogin && editorPin && savedEditorPinAtLogin !== editorPin;

      if (!isSessionActive || isBlocked || isPinMismatch) {
        setUserRole('viewer');
        localStorage.setItem('userRole', 'viewer');
        localStorage.removeItem('savedEditorPinAtLogin');
        setSavedEditorPinAtLogin('');
      }
    } else if (userRole === 'admin') {
      const isPinMismatch = savedAdminPinAtLogin && adminPin && savedAdminPinAtLogin !== adminPin;
      if (isPinMismatch) {
        setUserRole('viewer');
        localStorage.setItem('userRole', 'viewer');
        localStorage.removeItem('savedAdminPinAtLogin');
        setSavedAdminPinAtLogin('');
      }
    } else if (userRole === 'viewer') {
      // Auto-restore editor role if session is in activeEditors and valid
      const mySession = activeEditors.find(e => e.id === currentSessionId);
      if (mySession) {
        const isBlocked = blockedUsers.some(b => b.toLowerCase() === mySession.name.toLowerCase());
        const isPinMismatch = savedEditorPinAtLogin && editorPin && savedEditorPinAtLogin !== editorPin;
        if (!isBlocked && !isPinMismatch) {
          setUserRole('editor');
          localStorage.setItem('userRole', 'editor');
        }
      }
    }
  }, [isRealtimeSynced, activeEditors, blockedUsers, currentSessionId, userRole, editorPin, adminPin, savedEditorPinAtLogin, savedAdminPinAtLogin]);

  // Session Log Helper
  const addSessionLog = (logData: Omit<UserSessionLog, 'id' | 'timestamp'>) => {
    const newEntry: UserSessionLog = {
      id: Date.now().toString() + '_' + Math.random().toString(36).substring(2, 6),
      timestamp: new Date().toISOString(),
      ...logData,
    };
    setSessionLogs(prev => {
      const updated = [newEntry, ...prev].slice(0, 100);
      localStorage.setItem('sessionLogs', JSON.stringify(updated));
      syncToFirebase({ sessionLogs: updated });
      return updated;
    });
  };

  const logActivity = (details: string, actionType: 'update' | 'reset' = 'update') => {
    let name = 'ভিউয়ার';
    let role: 'admin' | 'editor' | 'viewer' = userRole;

    if (userRole === 'admin') {
      name = 'এডমিন';
    } else if (userRole === 'editor') {
      const activeEd = activeEditors.find(e => e.id === currentSessionId);
      name = activeEd ? `${activeEd.name} (এডিটর)` : 'এডিটর';
    }

    addSessionLog({
      name,
      role,
      action: actionType,
      details,
    });
  };

  const handleClearSessionLogs = () => {
    setSessionLogs([]);
    localStorage.removeItem('sessionLogs');
    syncToFirebase({ sessionLogs: [] });
  };

  // Role Login & Logout Handlers
  const handleLoginAdmin = () => {
    const nextEditors = activeEditors.filter(e => e.id !== currentSessionId);
    const activeAdminPin = adminPin || '1234';
    setActiveEditors(nextEditors);
    setUserRole('admin');
    setSavedAdminPinAtLogin(activeAdminPin);
    localStorage.setItem('userRole', 'admin');
    localStorage.setItem('savedAdminPinAtLogin', activeAdminPin);
    localStorage.removeItem('savedEditorPinAtLogin');
    setSavedEditorPinAtLogin('');
    syncToFirebase({ activeEditors: nextEditors });

    addSessionLog({
      name: 'এডমিন',
      role: 'admin',
      action: 'login',
      details: 'এডমিন পিন দিয়ে সফলভাবে মোডে প্রবেশ করেছেন',
    });
  };

  const handleDirectEditorLogin = (editorName: string, usedPin: string) => {
    const newSession: ActiveEditorSession = {
      id: currentSessionId,
      name: editorName,
      joinedAt: new Date().toISOString(),
    };

    const nextEditors = [...activeEditors.filter(e => e.id !== currentSessionId), newSession];
    setActiveEditors(nextEditors);
    setUserRole('editor');
    setSavedEditorPinAtLogin(usedPin);
    localStorage.setItem('userRole', 'editor');
    localStorage.setItem('savedEditorPinAtLogin', usedPin);
    syncToFirebase({ activeEditors: nextEditors });

    addSessionLog({
      name: editorName,
      role: 'editor',
      action: 'login',
      details: 'এডিটর সরাসরি পাসওয়ার্ড দিয়ে লগইন করেছেন',
    });
  };

  const handleRequestEditorAccess = (editorName: string) => {
    const newReq: EditorAccessRequest = {
      id: currentSessionId,
      name: editorName,
      requestedAt: new Date().toISOString(),
      status: 'pending',
    };

    setSavedEditorPinAtLogin(editorPin);
    localStorage.setItem('savedEditorPinAtLogin', editorPin);

    const nextRequests = [newReq, ...editorRequests.filter(r => r.id !== currentSessionId)];
    setEditorRequests(nextRequests);
    syncToFirebase({ editorRequests: nextRequests });
  };

  const handleApproveEditorRequest = (requestId: string) => {
    const req = editorRequests.find(r => r.id === requestId);
    if (!req) return;

    if (activeEditors.length >= 3) {
      alert('⚠️ ইতোমধ্যে সর্বোচ্চ ৩ জন এডিটর সক্রিয় আছে! আগে যেকোনো একজনকে রিমুভ করুন।');
      return;
    }

    const nextReqs = editorRequests.map(r => r.id === requestId ? { ...r, status: 'approved' as const } : r);
    
    const newSession: ActiveEditorSession = {
      id: req.id,
      name: req.name,
      joinedAt: new Date().toISOString(),
    };

    const nextEditors = [...activeEditors.filter(e => e.id !== req.id), newSession];

    setEditorRequests(nextReqs);
    setActiveEditors(nextEditors);
    syncToFirebase({ editorRequests: nextReqs, activeEditors: nextEditors });

    addSessionLog({
      name: req.name,
      role: 'editor',
      action: 'approved',
      details: 'এডমিন কর্তৃক এডিটর রিকোয়েস্ট অনুমোদিত হয়েছে',
    });
  };

  const handleRejectEditorRequest = (requestId: string) => {
    const req = editorRequests.find(r => r.id === requestId);
    const nextReqs = editorRequests.map(r => r.id === requestId ? { ...r, status: 'rejected' as const } : r);
    setEditorRequests(nextReqs);
    syncToFirebase({ editorRequests: nextReqs });

    if (req) {
      addSessionLog({
        name: req.name,
        role: 'editor',
        action: 'rejected',
        details: 'এডমিন কর্তৃক এডিটর রিকোয়েস্ট বাতিল করা হয়েছে',
      });
    }
  };

  const handleRemoveEditor = (editorId: string) => {
    const target = activeEditors.find(e => e.id === editorId);
    const nextEditors = activeEditors.filter(e => e.id !== editorId);
    const nextReqs = editorRequests.filter(r => r.id !== editorId);
    setActiveEditors(nextEditors);
    setEditorRequests(nextReqs);
    syncToFirebase({ activeEditors: nextEditors, editorRequests: nextReqs });

    if (target) {
      addSessionLog({
        name: target.name,
        role: 'editor',
        action: 'removed',
        details: 'এডমিন কর্তৃক এডিটর স্লট থেকে রিমুভ করা হয়েছে',
      });
    }
  };

  const handleBlockUser = (userName: string) => {
    const nameTrimmed = userName.trim();
    if (!nameTrimmed) return;

    if (!blockedUsers.some(u => u.toLowerCase() === nameTrimmed.toLowerCase())) {
      const nextBlocked = [...blockedUsers, nameTrimmed];
      const nextEditors = activeEditors.filter(e => e.name.toLowerCase() !== nameTrimmed.toLowerCase());
      const nextReqs = editorRequests.filter(r => r.name.toLowerCase() !== nameTrimmed.toLowerCase());

      setBlockedUsers(nextBlocked);
      setActiveEditors(nextEditors);
      setEditorRequests(nextReqs);

      syncToFirebase({ 
        blockedUsers: nextBlocked, 
        activeEditors: nextEditors, 
        editorRequests: nextReqs 
      });

      addSessionLog({
        name: nameTrimmed,
        role: 'editor',
        action: 'removed',
        details: 'এডমিন কর্তৃক ইউজার কে ব্লকড করা হয়েছে',
      });
    }
  };

  const handleUnblockUser = (userName: string) => {
    const nextBlocked = blockedUsers.filter(u => u.toLowerCase() !== userName.toLowerCase());
    setBlockedUsers(nextBlocked);
    syncToFirebase({ blockedUsers: nextBlocked });
  };

  const handleLoginMember = (name: string, email?: string) => {
    const trimmed = name.trim();
    if (!trimmed) return;
    setUserRole('member');
    setCurrentMemberName(trimmed);
    localStorage.setItem('userRole', 'member');
    localStorage.setItem('currentMemberName', trimmed);
    if (email) {
      setCurrentUserEmail(email);
      localStorage.setItem('currentUserEmail', email);
    }
    addSessionLog({
      name: trimmed,
      role: 'member',
      action: 'login',
      details: email ? `${trimmed} (${email}) গুগল ভেরিফাইড আইডি দিয়ে লগইন করেছেন` : `${trimmed} সদস্য হিসেবে লগইন করেছেন`,
    });
  };

  const handleLoginWithGoogle = async (targetRole: 'member' | 'admin' = 'member'): Promise<{ success: boolean; message?: string; userEmail?: string; isUnlinked?: boolean; memberName?: string }> => {
    try {
      const { user, error } = await loginWithGoogle();
      if (error || !user) {
        return { success: false, message: error || 'গুগল সাইন-ইন সম্পন্ন হতে সমস্যা হয়েছে।' };
      }
      const userEmail = (user.email || '').trim().toLowerCase();
      if (!userEmail) {
        return { success: false, message: 'গুগল অ্যাকাউন্ট থেকে ইমেইল অ্যাড্রেস পাওয়া যায়নি।' };
      }

      setCurrentUserEmail(userEmail);
      localStorage.setItem('currentUserEmail', userEmail);

      if (targetRole === 'admin') {
        const isAdmin = adminEmails.some(em => em.toLowerCase() === userEmail);
        if (isAdmin || adminEmails.length === 0) {
          // If no admin emails registered yet, auto-register this first user as admin!
          if (adminEmails.length === 0) {
            const nextAdminEmails = [userEmail];
            setAdminEmails(nextAdminEmails);
            localStorage.setItem('adminEmails', JSON.stringify(nextAdminEmails));
            syncToFirebase({ adminEmails: nextAdminEmails });
          }

          const nextEditors = activeEditors.filter(e => e.id !== currentSessionId);
          setActiveEditors(nextEditors);
          setUserRole('admin');
          localStorage.setItem('userRole', 'admin');
          syncToFirebase({ activeEditors: nextEditors });

          addSessionLog({
            name: user.displayName || 'এডমিন',
            role: 'admin',
            action: 'login',
            details: `এডমিন (${userEmail}) গুগল দিয়ে সরাসরি লগইন করেছেন`,
          });

          return {
            success: true,
            userEmail,
            message: `✅ স্বাগতম এডমিন (${user.displayName || userEmail})! আপনি গুগল দিয়ে সফলভাবে এডমিন মোডে প্রবেশ করেছেন।`,
          };
        } else {
          return {
            success: false,
            userEmail,
            message: `⚠️ "${userEmail}" এডমিন হিসেবে অনুমোদিত নয়। লিঙ্ক অপশন থেকে এডমিন পিন দিয়ে এই ইমেইলটি এডমিন লিস্টে যুক্ত করুন।`,
          };
        }
      } else {
        // Target role is member - lookup bound member name
        const matchedEntry = Object.entries(memberEmails).find(
          ([_, boundEmail]) => (String(boundEmail || '')).trim().toLowerCase() === userEmail
        );

        if (matchedEntry) {
          const [memberName] = matchedEntry;
          handleLoginMember(memberName, userEmail);
          setActiveTab('attendance'); // Direct redirect to attendance sheet!
          return {
            success: true,
            userEmail,
            memberName,
            message: `✅ স্বাগতম, ${memberName}! আপনার গুগল অ্যাকাউন্ট (${userEmail}) সফলভাবে ভেরিফাই হয়েছে এবং সরাসরি হাজিরা শিটে প্রবেশ করেছেন।`,
          };
        } else {
          // First time sign-in with Google -> initially in viewer mode as requested
          setUserRole('viewer');
          localStorage.setItem('userRole', 'viewer');
          return {
            success: true,
            userEmail,
            isUnlinked: true,
            message: `👋 স্বাগতম! গুগল সাইন-ইন সম্পন্ন (${userEmail})। আপনি বর্তমানে ভিউয়ার মোডে আছেন। নিজের হাজিরা দিতে নিচের ফর্মে আপনার নাম ও পিন দিয়ে ভেরিফাই করুন।`,
          };
        }
      }
    } catch (err: any) {
      return {
        success: false,
        message: err?.message || 'গুগল সাইন-ইনে সমস্যা হয়েছে।',
      };
    }
  };

  const handleVerifyMemberWithPin = async (
    memberName: string,
    email: string,
    pin: string
  ): Promise<{ success: boolean; message: string }> => {
    const trimmedName = memberName.trim();
    const normalizedEmail = (email || '').trim().toLowerCase();
    const trimmedPin = (pin || '').trim();

    if (!trimmedName) {
      return { success: false, message: '⚠️ অনুগ্রহ করে সদস্যের নাম নির্বাচন করুন!' };
    }
    if (!normalizedEmail || !normalizedEmail.includes('@')) {
      return { success: false, message: '⚠️ অনুগ্রহ করে সঠিক জিমেইল (Gmail) অ্যাড্রেস দিন!' };
    }
    if (!trimmedPin || trimmedPin.length < 4) {
      return { success: false, message: '⚠️ মেম্বার পিন কোড অন্তত ৪ ডিজিটের হতে হবে!' };
    }

    const existingPin = memberPins[trimmedName];
    const effectiveAdminPin = adminPin || '1234';

    // If PIN already exists for this member, check match with either member PIN or admin PIN
    if (existingPin && existingPin !== trimmedPin && trimmedPin !== effectiveAdminPin) {
      return {
        success: false,
        message: `❌ "${trimmedName}" এর পিন কোড মেলেনি! আপনার পূর্বে সেট করা ৪-সংখ্যার মেম্বার পিন দিন (অথবা এডমিন পিন ব্যবহার করুন)।`,
      };
    }

    const nextPins = { ...memberPins, [trimmedName]: trimmedPin };
    const nextEmails = { ...memberEmails, [trimmedName]: normalizedEmail };

    setMemberPins(nextPins);
    setMemberEmails(nextEmails);
    localStorage.setItem('memberPins', JSON.stringify(nextPins));
    localStorage.setItem('memberEmails', JSON.stringify(nextEmails));

    syncToFirebase({
      memberPins: nextPins,
      memberEmails: nextEmails,
    });

    // Login as this member
    setUserRole('member');
    setCurrentMemberName(trimmedName);
    setCurrentUserEmail(normalizedEmail);
    localStorage.setItem('userRole', 'member');
    localStorage.setItem('currentMemberName', trimmedName);
    localStorage.setItem('currentUserEmail', normalizedEmail);

    // Directly navigate to Attendance tab from verification window!
    setActiveTab('attendance');

    addSessionLog({
      name: trimmedName,
      role: 'member',
      action: 'login',
      details: `সদস্য "${trimmedName}" (${normalizedEmail}) নিজস্ব পিন ভেরিফাই করে সরাসরি হাজিরা শিটে প্রবেশ করেছেন`,
    });

    return {
      success: true,
      message: `✅ স্বাগতম, ${trimmedName}! আপনার ইমেইল ও পিন ভেরিফাই হয়েছে। আপনি সরাসরি আপনার হাজিরা শিটে প্রবেশ করেছেন।`,
    };
  };

  const handleLinkGoogleAccount = async (
    targetType: 'member' | 'admin',
    targetName: string,
    email: string,
    enteredPin?: string
  ): Promise<{ success: boolean; message: string }> => {
    const normalizedEmail = (email || '').trim().toLowerCase();
    if (!normalizedEmail || !normalizedEmail.includes('@')) {
      return { success: false, message: '⚠️ অনুগ্রহ করে সঠিক জিমেইল আইডি (Gmail Address) দিন।' };
    }

    // Check PIN if user is not currently in admin mode
    if (userRole !== 'admin') {
      const effectiveAdminPin = adminPin || '1234';
      if (!enteredPin || enteredPin.trim() !== effectiveAdminPin) {
        return { success: false, message: '❌ ভুল এডমিন পিন কোড! এডমিন পিন (ডিফল্ট: 1234) দিয়ে লিংক কনফার্ম করুন।' };
      }
    }

    if (targetType === 'admin') {
      const nextAdminEmails = Array.from(new Set([...adminEmails, normalizedEmail]));
      setAdminEmails(nextAdminEmails);
      localStorage.setItem('adminEmails', JSON.stringify(nextAdminEmails));
      syncToFirebase({ adminEmails: nextAdminEmails });

      const nextEditors = activeEditors.filter(e => e.id !== currentSessionId);
      setActiveEditors(nextEditors);
      setUserRole('admin');
      setCurrentUserEmail(normalizedEmail);
      localStorage.setItem('userRole', 'admin');
      localStorage.setItem('currentUserEmail', normalizedEmail);
      syncToFirebase({ activeEditors: nextEditors });

      addSessionLog({
        name: 'এডমিন',
        role: 'admin',
        action: 'update',
        details: `এডমিন হিসেবে জিমেইল "${normalizedEmail}" লিঙ্ক করা হয়েছে এবং স্বয়ংক্রিয়ভাবে এডমিন মোডে লগইন হয়েছে`,
      });

      return {
        success: true,
        message: `✅ জিমেইল (${normalizedEmail}) সফলভাবে এডমিন হিসেবে লিঙ্ক করা হয়েছে এবং এডমিন মোড সক্রিয় হয়েছে!`,
      };
    } else {
      const member = targetName.trim();
      if (!member) {
        return { success: false, message: '⚠️ মেস সদস্যের নাম নির্বাচন করুন।' };
      }

      const nextMemberEmails = { ...memberEmails, [member]: normalizedEmail };
      setMemberEmails(nextMemberEmails);
      localStorage.setItem('memberEmails', JSON.stringify(nextMemberEmails));
      syncToFirebase({ memberEmails: nextMemberEmails });

      // Automatically login as this member!
      handleLoginMember(member, normalizedEmail);

      addSessionLog({
        name: member,
        role: 'member',
        action: 'update',
        details: `সদস্য "${member}" এর সাথে জিমেইল (${normalizedEmail}) লিঙ্ক করা হয়েছে এবং মেম্বার লগইন সম্পন্ন হয়েছে`,
      });

      return {
        success: true,
        message: `✅ সদস্য "${member}" এর সাথে জিমেইল (${normalizedEmail}) সফলভাবে লিঙ্ক হয়েছে এবং লগইন সম্পন্ন হয়েছে!`,
      };
    }
  };

  const handleUpdateMemberEmail = (memberName: string, email: string) => {
    requireAdminAction(() => {
      const normalizedEmail = email.trim().toLowerCase();
      setMemberEmails(prev => {
        const next = { ...prev, [memberName]: normalizedEmail };
        localStorage.setItem('memberEmails', JSON.stringify(next));
        syncToFirebase({ memberEmails: next });
        return next;
      });

      addSessionLog({
        name: 'এডমিন',
        role: 'admin',
        action: 'update',
        details: `"${memberName}" এর জন্য জিমেইল (${normalizedEmail || 'মুছে ফেলা হয়েছে'}) লিঙ্ক করা হয়েছে`,
      });
    });
  };

  const handleAddAdminEmail = (email: string) => {
    requireAdminAction(() => {
      const normalized = email.trim().toLowerCase();
      if (!normalized || !normalized.includes('@')) return;
      setAdminEmails(prev => {
        if (prev.includes(normalized)) return prev;
        const next = [...prev, normalized];
        localStorage.setItem('adminEmails', JSON.stringify(next));
        syncToFirebase({ adminEmails: next });
        return next;
      });

      addSessionLog({
        name: 'এডমিন',
        role: 'admin',
        action: 'update',
        details: `নতুন এডমিন জিমেইল "${normalized}" যোগ করা হয়েছে`,
      });
    });
  };

  const handleRemoveAdminEmail = (email: string) => {
    requireAdminAction(() => {
      const normalized = email.trim().toLowerCase();
      setAdminEmails(prev => {
        const next = prev.filter(em => em.toLowerCase() !== normalized);
        localStorage.setItem('adminEmails', JSON.stringify(next));
        syncToFirebase({ adminEmails: next });
        return next;
      });
    });
  };

  const handleSwitchToViewer = () => {
    const myEditor = activeEditors.find(e => e.id === currentSessionId);
    const previousRole = userRole;
    const previousMemberName = currentMemberName;

    logoutFromFirebase().catch(() => {});

    const nextEditors = activeEditors.filter(e => e.id !== currentSessionId);
    const nextReqs = editorRequests.filter(r => r.id !== currentSessionId);
    setActiveEditors(nextEditors);
    setEditorRequests(nextReqs);
    setUserRole('viewer');
    setCurrentMemberName('');
    setCurrentUserEmail('');
    setIsAppAuthenticated(false);
    localStorage.removeItem('isAppAuthenticated');
    localStorage.setItem('userRole', 'viewer');
    localStorage.removeItem('currentMemberName');
    localStorage.removeItem('currentUserEmail');
    localStorage.removeItem('savedEditorPinAtLogin');
    localStorage.removeItem('savedAdminPinAtLogin');
    setSavedEditorPinAtLogin('');
    setSavedAdminPinAtLogin('');
    syncToFirebase({ activeEditors: nextEditors, editorRequests: nextReqs });

    if (previousRole === 'admin') {
      addSessionLog({
        name: 'এডমিন',
        role: 'admin',
        action: 'logout',
        details: 'এডমিন ম্যানুয়ালি লগআউট করেছেন',
      });
    } else if (previousRole === 'editor' && myEditor) {
      addSessionLog({
        name: myEditor.name,
        role: 'editor',
        action: 'logout',
        details: 'এডিটর ম্যানুয়ালি লগআউট করেছেন',
      });
    } else if (previousRole === 'member' && previousMemberName) {
      addSessionLog({
        name: previousMemberName,
        role: 'member',
        action: 'logout',
        details: `${previousMemberName} সদস্য লগআউট করেছেন`,
      });
    }
  };

  const handleChangeAdminPin = (newPin: string) => {
    setAdminPin(newPin);
    setSavedAdminPinAtLogin(newPin);
    localStorage.setItem('savedAdminPinAtLogin', newPin);
    syncToFirebase({ adminPin: newPin });
  };

  const handleChangeEditorPin = (newPin: string) => {
    setEditorPin(newPin);
    setActiveEditors([]);
    setEditorRequests([]);
    syncToFirebase({ editorPin: newPin, activeEditors: [], editorRequests: [] });

    addSessionLog({
      name: 'সকল এডিটর',
      role: 'editor',
      action: 'logout',
      details: 'এডমিন পাসওয়ার্ড পরিবর্তন করায় সকল এডিটরকে সাইন-আউট করানো হয়েছে',
    });
  };

  const handleClearActiveEditors = () => {
    setActiveEditors([]);
    setEditorRequests([]);
    syncToFirebase({ activeEditors: [], editorRequests: [] });

    addSessionLog({
      name: 'সকল এডিটর',
      role: 'editor',
      action: 'removed',
      details: 'এডমিন এক ক্লিকে সব এডিটর সেসন ক্লিয়ার করেছেন',
    });
  };

  // Generate Attendance Sheet (Admin required)
  const handleGenerateAttendanceSheet = () => {
    requireAdminAction(() => {
      if (!attStartDate || !attEndDate) {
        alert('⚠️ দয়া করে শুরুর এবং শেষের তারিখ নির্বাচন করুন!');
        return;
      }
      if (new Date(attStartDate) > new Date(attEndDate)) {
        alert('⚠️ শুরুর তারিখ শেষের তারিখের চেয়ে ছোট হতে হবে!');
        return;
      }

      const start = new Date(attStartDate);
      const end = new Date(attEndDate);
      const range: Date[] = [];
      let curr = new Date(start);
      let count = 0;

      while (curr <= end && count < 60) {
        range.push(new Date(curr));
        curr.setDate(curr.getDate() + 1);
        count++;
      }

      setDateRange(range);

      const newAttData = { ...attendanceData };
      millMembers.forEach(m => {
        if (!newAttData[m.name]) newAttData[m.name] = {};
        range.forEach(d => {
          const dStr = d.toISOString().split('T')[0];
          if (!(dStr in newAttData[m.name])) {
            newAttData[m.name][dStr] = false;
          }
        });
      });

      setAttendanceData(newAttData);
      localStorage.setItem('attendanceData', JSON.stringify(newAttData));
      syncToFirebase({ attStartDate, attEndDate, attendanceData: newAttData });
      alert(`✅ ${range.length} দিনের হাজিরা শীট সফলভাবে তৈরি হয়েছে!`);
    });
  };

  // Generate Bazar Sheet (Admin & Editor allowed)
  const handleGenerateBazarSheet = () => {
    requireEditPermission(() => {
      if (!bazarStartDate || !bazarEndDate) {
        alert('⚠️ দয়া করে শুরুর এবং শেষের তারিখ নির্বাচন করুন!');
        return;
      }
      if (new Date(bazarStartDate) > new Date(bazarEndDate)) {
        alert('⚠️ শুরুর তারিখ শেষের তারিখের চেয়ে ছোট হতে হবে!');
        return;
      }

      const start = new Date(bazarStartDate);
      const end = new Date(bazarEndDate);
      const rows: BazarRow[] = [];
      let curr = new Date(start);
      let count = 0;

      while (curr <= end && count < 60) {
        const dStr = curr.toISOString().split('T')[0];
        rows.push({
          date: dStr,
          bigBazar: 0,
          bigSignature: '',
          smallBazar: 0,
          smallSignature: '',
        });
        curr.setDate(curr.getDate() + 1);
        count++;
      }

      setBazarData(rows);
      localStorage.setItem('bazarData', JSON.stringify(rows));
      syncToFirebase({ bazarStartDate, bazarEndDate, bazarData: rows });
      alert(`✅ ${rows.length} দিনের বাজার শীট সফলভাবে তৈরি হয়েছে!`);
    });
  };

  // Helper: Create & Save Complete Database Snapshot before Reset or Manual Save
  const saveCurrentStateToDatabaseHistory = (resetTypeLabel: string): HistoryEntry[] => {
    const timestampStr = formatBnTime();
    let text = `═══════════════════════════════════════════════\n📅 সেভ/রিসেট সময়: ${timestampStr} (বাংলাদেশ সময়)\n🏷️ ধরণ: ${resetTypeLabel}\n👤 রোল: ${userRole === 'admin' ? 'এডমিন (Admin)' : 'এডিটর (Editor)'}\n═══════════════════════════════════════════════\n\n`;

    text += `🍛 মিলের হিসাব:\n───────────────────────────────────────────\n`;
    text += `📅 তারিখ: ${millDate || 'নির্ধারিত নয়'}\n👤 ম্যানেজার: ${millManager || 'নির্ধারিত নয়'}\n`;
    text += `🛒 ছোট বাজার: ${totalBazarSums.small} ৳\n🛒 বড় বাজার: ${totalBazarSums.big} ৳\n`;
    text += `🍚 মোট মিল: ${totalMealValue}\n📊 সদস্য সংখ্যা: ${millMembers.length}\n\n`;

    text += `📋 হাজিরা শীট:\n───────────────────────────────────────────\n`;
    text += `📅 শুরুর তারিখ: ${attStartDate || 'নির্ধারিত নয়'}\n📅 শেষের তারিখ: ${attEndDate || 'নির্ধারিত নয়'}\n`;
    text += `📌 Fixed Meal: ${fixedMeal}\n⚠️ জরিমানা গণনা: ${fineEnabled ? 'চালু (ON)' : 'বন্ধ (OFF)'}\n\n`;

    text += `🧑‍🤝‍🧑 গেস্ট মিল:\n───────────────────────────────────────────\n`;
    text += `🗓️ গেস্ট দিন: ${guestDateList.length}টি\n🍽️ মোট গেস্ট মিল: ${totalGuestMealsSum}\n💰 গেস্ট রেট: ${guestRate} ৳\n\n`;

    const newEntry: HistoryEntry = {
      id: 'snap_' + Date.now() + '_' + Math.random().toString(36).substring(2, 7),
      timestamp: new Date().toISOString(),
      resetByRole: userRole === 'admin' ? 'admin' : 'editor',
      resetType: resetTypeLabel,
      data: text,
      snapshotData: {
        millMembers: JSON.parse(JSON.stringify(millMembers)),
        millDate,
        millManager,
        attStartDate,
        attEndDate,
        attendanceData: JSON.parse(JSON.stringify(attendanceData)),
        mealOffDays: JSON.parse(JSON.stringify(mealOffDays)),
        fineEnabled,
        guestRate,
        guestDateList: JSON.parse(JSON.stringify(guestDateList)),
        guestData: JSON.parse(JSON.stringify(guestData)),
        depositData: JSON.parse(JSON.stringify(depositData)),
        bazarStartDate,
        bazarEndDate,
        bazarData: JSON.parse(JSON.stringify(bazarData)),
      },
    };

    const updatedHistory = [newEntry, ...historyList].slice(0, 50);
    setHistoryList(updatedHistory);
    localStorage.setItem('savedHistory', JSON.stringify(updatedHistory));
    return updatedHistory;
  };

  // Manual Save History Snapshot
  const handleSaveHistory = () => {
    requireEditPermission(() => {
      const updated = saveCurrentStateToDatabaseHistory('ম্যানুয়াল সেভ');
      syncToFirebase({ historyList: updated });
      alert('✅ মেসের সম্পূর্ণ হিসাবের ইতিহাস ডাটাবেসে সফলভাবে সেভ করা হয়েছে!');
    });
  };

  // Editor-enabled Resets with Automatic Database Archiving
  const handleResetMill = () => {
    requireEditPermission(() => {
      // 1. Save active data to database history before resetting UI
      const updatedHistory = saveCurrentStateToDatabaseHistory('মিলের হিসাব রিসেট');

      // 2. Clear Mill UI State
      const resetMembers = PREDEFINED_MEMBERS.map(name => ({
        name,
        fineMeals: 0,
        presentMeals: 0,
        presentExtra: 0,
        guestMeals: 0,
        deposit: 0,
        paid: false,
      }));
      const today = getBangladeshDateString();
      setMillMembers(resetMembers);
      setMillDate(today);
      setMillManager('');

      localStorage.setItem('millMembers', JSON.stringify(resetMembers));
      localStorage.setItem('mill_date', today);
      localStorage.setItem('mill_manager', '');

      // 3. Sync to Firebase
      syncToFirebase({
        historyList: updatedHistory,
        millMembers: resetMembers,
        millDate: today,
        millManager: '',
      });

      alert('✅ মিলের হিসাব UI থেকে রিসেট হয়েছে! রিসেট করার পূর্বের সম্পূর্ণ ডাটা ডাটাবেস হিস্টোরিতে সেভ করা হয়েছে (প্রয়োজনে এডমিন এটি রিস্টোর/ইমপোর্ট করতে পারবে)।');
    });
  };

  const handleResetAttendance = () => {
    requireEditPermission(() => {
      const updatedHistory = saveCurrentStateToDatabaseHistory('হাজিরা শীট রিসেট');

      setAttendanceData({});
      setDateRange([]);
      setMealOffDays([]);
      setAttStartDate('');
      setAttEndDate('');

      localStorage.removeItem('attendanceData');
      localStorage.removeItem('mealOffDays');
      localStorage.removeItem('att_start_date');
      localStorage.removeItem('att_end_date');

      syncToFirebase({
        historyList: updatedHistory,
        attStartDate: '',
        attEndDate: '',
        attendanceData: {},
        mealOffDays: [],
      });

      alert('✅ হাজিরা শীট UI থেকে রিসেট হয়েছে এবং ডাটা ডাটাবেস হিস্টোরিতে সেভ রাখা হয়েছে!');
    });
  };

  const handleResetGuest = () => {
    requireEditPermission(() => {
      const updatedHistory = saveCurrentStateToDatabaseHistory('গেস্ট মিল রিসেট');

      setGuestData({});
      setGuestDateList([]);

      localStorage.removeItem('guestData');
      localStorage.removeItem('guestDateList');

      syncToFirebase({
        historyList: updatedHistory,
        guestData: {},
        guestDateList: [],
      });

      alert('✅ গেস্ট মিল UI থেকে রিসেট হয়েছে এবং ডাটা ডাটাবেস হিস্টোরিতে সেভ রাখা হয়েছে!');
    });
  };

  const handleResetDeposit = () => {
    requireEditPermission(() => {
      const updatedHistory = saveCurrentStateToDatabaseHistory('জমা ও ধারের হিসাব রিসেট');

      const map: DepositDataMap = {};
      PREDEFINED_MEMBERS.forEach(name => {
        map[name] = { entries: [], total: 0, extra: 0 };
      });
      setDepositData(map);
      localStorage.setItem('depositData', JSON.stringify(map));

      syncToFirebase({
        historyList: updatedHistory,
        depositData: map,
      });

      alert('✅ জমা ও ধারের হিসাব UI থেকে রিসেট হয়েছে এবং ডাটা ডাটাবেস হিস্টোরিতে সেভ রাখা হয়েছে!');
    });
  };

  const handleResetBazar = () => {
    requireEditPermission(() => {
      const updatedHistory = saveCurrentStateToDatabaseHistory('বাজার হিসাব রিসেট');

      setBazarData([]);
      setBazarStartDate('');
      setBazarEndDate('');

      localStorage.removeItem('bazarData');
      localStorage.removeItem('bazar_start_date');
      localStorage.removeItem('bazar_end_date');

      syncToFirebase({
        historyList: updatedHistory,
        bazarStartDate: '',
        bazarEndDate: '',
        bazarData: [],
      });

      alert('✅ বাজার হিসাব UI থেকে রিসেট হয়েছে এবং ডাটা ডাটাবেস হিস্টোরিতে সেভ রাখা হয়েছে!');
    });
  };

  // Restore Snapshot from History to Active UI (ADMIN ONLY)
  const handleRestoreHistorySnapshot = (entry: HistoryEntry) => {
    requireAdminAction(() => {
      if (!entry.snapshotData) {
        alert('⚠️ এই ঐতিহাসিক রেকর্ডে সম্পূর্ণ স্ন্যাপশট ডাটা পাওয়া যায়নি!');
        return;
      }
      const snap = entry.snapshotData;

      if (snap.millMembers) setMillMembers(snap.millMembers);
      if (snap.millDate) setMillDate(snap.millDate);
      if (snap.millManager !== undefined) setMillManager(snap.millManager);
      if (snap.attStartDate !== undefined) setAttStartDate(snap.attStartDate);
      if (snap.attEndDate !== undefined) setAttEndDate(snap.attEndDate);
      if (snap.attendanceData) setAttendanceData(snap.attendanceData);
      if (snap.mealOffDays) setMealOffDays(snap.mealOffDays);
      if (snap.fineEnabled !== undefined) setFineEnabled(snap.fineEnabled);
      if (snap.guestRate !== undefined) setGuestRate(snap.guestRate);
      if (snap.guestDateList) setGuestDateList(snap.guestDateList);
      if (snap.guestData) setGuestData(snap.guestData);
      if (snap.depositData) setDepositData(snap.depositData);
      if (snap.bazarStartDate !== undefined) setBazarStartDate(snap.bazarStartDate);
      if (snap.bazarEndDate !== undefined) setBazarEndDate(snap.bazarEndDate);
      if (snap.bazarData) setBazarData(snap.bazarData);

      // Save locally
      if (snap.millMembers) localStorage.setItem('millMembers', JSON.stringify(snap.millMembers));
      if (snap.millDate) localStorage.setItem('mill_date', snap.millDate);
      if (snap.millManager !== undefined) localStorage.setItem('mill_manager', snap.millManager);
      if (snap.attendanceData) localStorage.setItem('attendanceData', JSON.stringify(snap.attendanceData));
      if (snap.mealOffDays) localStorage.setItem('mealOffDays', JSON.stringify(snap.mealOffDays));
      if (snap.guestData) localStorage.setItem('guestData', JSON.stringify(snap.guestData));
      if (snap.guestDateList) localStorage.setItem('guestDateList', JSON.stringify(snap.guestDateList));
      if (snap.depositData) localStorage.setItem('depositData', JSON.stringify(snap.depositData));
      if (snap.bazarData) localStorage.setItem('bazarData', JSON.stringify(snap.bazarData));

      // Sync to Firebase Database
      syncToFirebase({
        millMembers: snap.millMembers,
        millDate: snap.millDate,
        millManager: snap.millManager,
        attStartDate: snap.attStartDate,
        attEndDate: snap.attEndDate,
        attendanceData: snap.attendanceData,
        mealOffDays: snap.mealOffDays,
        fineEnabled: snap.fineEnabled,
        guestRate: snap.guestRate,
        guestDateList: snap.guestDateList,
        guestData: snap.guestData,
        depositData: snap.depositData,
        bazarStartDate: snap.bazarStartDate,
        bazarEndDate: snap.bazarEndDate,
        bazarData: snap.bazarData,
      });

      alert(`✅ "${entry.resetType || 'সংরক্ষিত'}" ডাটা ডাটাবেস হিস্টোরি থেকে সফলভাবে রিস্টোর ও স্ক্রিনে ইমপোর্ট করা হয়েছে!`);
    });
  };

  // Delete Individual History Record (ADMIN ONLY)
  const handleDeleteHistoryEntry = (index: number) => {
    requireAdminAction(() => {
      const updatedHistory = historyList.filter((_, i) => i !== index);
      setHistoryList(updatedHistory);
      localStorage.setItem('savedHistory', JSON.stringify(updatedHistory));
      syncToFirebase({ historyList: updatedHistory });
      alert('✅ ইতিহাস রেকর্ডটি ডাটাবেস থেকে মুছে ফেলা হয়েছে!');
    });
  };

  // Clear All Database History (ADMIN ONLY)
  const handleClearAllHistory = () => {
    requireAdminAction(() => {
      setHistoryList([]);
      localStorage.removeItem('savedHistory');
      syncToFirebase({ historyList: [] });
      alert('🗑️ ডাটাবেসের সমস্ত সেভ করা ইতিহাস রিসেট/ক্লিয়ার করা হয়েছে!');
    });
  };

  // Restore complete app backup from JSON file
  const handleRestoreAppData = (data: any) => {
    requireAdminAction(() => {
      if (data.millMembers) setMillMembers(data.millMembers);
      if (data.millDate) setMillDate(data.millDate);
      if (data.millManager !== undefined) setMillManager(data.millManager);
      if (data.historyList) {
        setHistoryList(data.historyList);
        localStorage.setItem('savedHistory', JSON.stringify(data.historyList));
      }
      if (data.attStartDate) setAttStartDate(data.attStartDate);
      if (data.attEndDate) setAttEndDate(data.attEndDate);
      if (data.attendanceData) setAttendanceData(data.attendanceData);
      if (data.mealOffDays) setMealOffDays(data.mealOffDays);
      if (data.fineEnabled !== undefined) setFineEnabled(data.fineEnabled);
      if (data.guestRate !== undefined) setGuestRate(data.guestRate);
      if (data.guestDateList) setGuestDateList(data.guestDateList);
      if (data.guestData) setGuestData(data.guestData);
      if (data.depositData) setDepositData(data.depositData);
      if (data.bazarStartDate) setBazarStartDate(data.bazarStartDate);
      if (data.bazarEndDate) setBazarEndDate(data.bazarEndDate);
      if (data.bazarData) setBazarData(data.bazarData);

      syncToFirebase(data);
      alert('✅ মেসের সমস্ত ডাটা রিয়েলটাইমে ব্যাকআপ থেকে সফলভাবে রিস্টোর হয়েছে!');
    });
  };

  const allAppDataObject = {
    millMembers,
    millDate,
    millManager,
    historyList,
    attStartDate,
    attEndDate,
    attendanceData,
    mealOffDays,
    fineEnabled,
    guestRate,
    guestDateList,
    guestData,
    depositData,
    bazarStartDate,
    bazarEndDate,
    bazarData,
  };

  // Theme Class Resolver
  const themeClassMap: { [key in ThemeType]: string } = {
    light: 'theme-light bg-slate-100 text-slate-800',
    dark: 'theme-dark bg-slate-950 text-slate-100 dark',
    'dark-purple': 'theme-dark-purple bg-purple-950 text-purple-200 dark',
    'dark-green': 'theme-dark-green bg-emerald-950 text-emerald-200 dark',
    blue: 'theme-blue bg-blue-50/70 text-blue-950',
    green: 'theme-green bg-emerald-50/70 text-emerald-950',
    purple: 'theme-purple bg-purple-50/80 text-purple-950',
    pink: 'theme-pink bg-gradient-to-br from-pink-50 via-fuchsia-50 to-rose-50 text-slate-900',
  };

  return (
    <div className={`min-h-screen pb-20 md:pb-8 ${themeClassMap[theme]} relative`}>
      {/* Blurred background wrapper when not authenticated */}
      <div className={`${!isAppAuthenticated ? 'filter blur-lg pointer-events-none select-none transition-all duration-500' : ''}`}>
      {/* Top Bar Navigation */}
      <Navbar
        activeTab={activeTab}
        setActiveTab={setActiveTab}
        currentTheme={theme}
        setTheme={setTheme}
        currentRole={userRole}
        currentMemberName={currentMemberName}
        activeEditorsCount={activeEditors.length}
        pendingRequestsCount={editorRequests.filter(r => r.status === 'pending').length}
        onOpenRoleModal={handleOpenRoleModal}
        onLogout={handleSwitchToViewer}
        isRealtimeSynced={isRealtimeSynced}
      />

      {/* Main Container */}
      <main className="max-w-7xl mx-auto px-3 sm:px-4 py-4 space-y-4">
        {/* Banner notification for Viewer Mode */}
        {userRole === 'viewer' && (
          <div className="bg-amber-500/10 border border-amber-500/30 rounded-2xl p-3 text-xs text-amber-800 dark:text-amber-300 flex items-center justify-between gap-2 shadow-xs">
            <div className="flex items-center gap-2">
              <span className="text-base">👁️</span>
              <div>
                <span className="font-bold">আপনি বর্তমানে ভিউয়ার (লগইন ছাড়া) মোডে আছেন।</span>
                <span className="hidden sm:inline text-[11px] text-amber-700 dark:text-amber-400 block sm:inline sm:ml-1">
                  হাজিরা বা হিসাব এডিট করতে এডমিন অথবা এডিটর মোডে লগইন করুন।
                </span>
              </div>
            </div>
            <button
              onClick={() => handleOpenRoleModal('login')}
              className="px-3 py-1.5 bg-amber-500 hover:bg-amber-600 text-slate-950 font-bold rounded-xl text-xs cursor-pointer flex-shrink-0 transition-all active:scale-95"
            >
              লগইন / আনলক
            </button>
          </div>
        )}

        {/* Banner notification for Admin Mode */}
        {userRole === 'admin' && (
          <div className="bg-amber-500/15 border border-amber-500/40 rounded-2xl p-3 text-xs text-amber-900 dark:text-amber-200 flex items-center justify-between gap-2 shadow-xs">
            <div className="flex items-center gap-2">
              <span className="text-lg">👑</span>
              <div>
                <span className="font-extrabold text-amber-950 dark:text-amber-100">আপনি এডমিন (Admin) মোডে আছেন</span>
                <span className="text-[11px] text-amber-800 dark:text-amber-300 block sm:inline sm:ml-1">
                  — আপনার সম্পূর্ণ নিয়ন্ত্রণ ও এডিট এক্সেস রয়েছে।
                </span>
              </div>
            </div>
            <div className="flex items-center gap-1.5 shrink-0">
              <button
                onClick={() => handleOpenRoleModal('management')}
                className="px-2.5 py-1.5 bg-amber-500 hover:bg-amber-600 text-slate-950 font-bold rounded-xl text-xs cursor-pointer transition-all active:scale-95 hidden sm:inline-block"
              >
                কন্ট্রোল প্যানেল
              </button>
              <button
                onClick={handleSwitchToViewer}
                className="px-2.5 py-1.5 bg-rose-600 hover:bg-rose-700 text-white font-bold rounded-xl text-xs cursor-pointer transition-all active:scale-95 flex items-center gap-1 shadow-xs"
                title="এডমিন মোড থেকে লগআউট করুন"
              >
                <LogOut className="w-3.5 h-3.5" />
                <span>লগআউট</span>
              </button>
            </div>
          </div>
        )}

        {/* Banner notification for Editor Mode */}
        {userRole === 'editor' && (
          <div className="bg-emerald-500/15 border border-emerald-500/40 rounded-2xl p-3 text-xs text-emerald-900 dark:text-emerald-200 flex items-center justify-between gap-2 shadow-xs">
            <div className="flex items-center gap-2">
              <span className="text-lg">✏️</span>
              <div>
                <span className="font-extrabold text-emerald-950 dark:text-emerald-100">
                  আপনি এডিটর মোডে আছেন {myEditorSession?.name ? `(${myEditorSession.name})` : ''}
                </span>
                <span className="text-[11px] text-emerald-800 dark:text-emerald-300 block sm:inline sm:ml-1">
                  — হাজিরা ও মেস ডাটা এডিট সক্রিয়।
                </span>
              </div>
            </div>
            <div className="flex items-center gap-1.5 shrink-0">
              <button
                onClick={handleSwitchToViewer}
                className="px-2.5 py-1.5 bg-rose-600 hover:bg-rose-700 text-white font-bold rounded-xl text-xs cursor-pointer transition-all active:scale-95 flex items-center gap-1 shadow-xs"
                title="এডিটর মোড থেকে লগআউট করুন"
              >
                <LogOut className="w-3.5 h-3.5" />
                <span>লগআউট</span>
              </button>
            </div>
          </div>
        )}

        {/* Banner notification for Member Mode */}
        {userRole === 'member' && (
          <div className="bg-sky-500/10 border border-sky-500/30 rounded-2xl p-3 text-xs text-sky-800 dark:text-sky-300 flex items-center justify-between gap-2 shadow-xs">
            <div className="flex items-center gap-2">
              <span className="text-base">👤</span>
              <div>
                <span className="font-bold">স্বাগতম, {currentMemberName}! আপনি সদস্য মোডে আছেন।</span>
                <span className="text-[11px] text-sky-700 dark:text-sky-400 block sm:inline sm:ml-1">
                  (হাজিরা ও মেসের ডাটা এডিট শুধুমাত্র এডমিন ও এডিটর করতে পারবেন)।
                </span>
              </div>
            </div>
            <div className="flex items-center gap-1.5 shrink-0">
              <button
                onClick={() => handleOpenRoleModal('login')}
                className="px-2.5 py-1.5 bg-sky-500 hover:bg-sky-600 text-white font-bold rounded-xl text-xs cursor-pointer transition-all active:scale-95"
              >
                রোল পরিবর্তন
              </button>
              <button
                onClick={handleSwitchToViewer}
                className="px-2.5 py-1.5 bg-rose-600 hover:bg-rose-700 text-white font-bold rounded-xl text-xs cursor-pointer transition-all active:scale-95 flex items-center gap-1 shadow-xs"
                title="সদস্য মোড থেকে লগআউট করুন"
              >
                <LogOut className="w-3.5 h-3.5" />
                <span>লগআউট</span>
              </button>
            </div>
          </div>
        )}

        {activeTab === 'mill' && (
          <TabMeal
            userRole={userRole}
            millDate={millDate}
            setMillDate={updateMillDate}
            millManager={millManager}
            setMillManager={updateMillManager}
            millSmall={effectiveSmallBazar}
            setMillSmall={handleSetMillSmall}
            millBig={effectiveBigBazar}
            setMillBig={handleSetMillBig}
            millTotalMeals={totalMealValue}
            millMembers={millMembers}
            setMillMembers={updateMillMembers}
            fineEnabled={fineEnabled}
            guestRate={guestRate}
            historyList={historyList}
            onSaveHistory={handleSaveHistory}
            onResetMill={handleResetMill}
            onRestoreHistorySnapshot={handleRestoreHistorySnapshot}
            onDeleteHistoryEntry={handleDeleteHistoryEntry}
            onClearAllHistory={handleClearAllHistory}
            onRequestConfirm={requestConfirmation}
          />
        )}

        {activeTab === 'attendance' && (
          <TabAttendance
            userRole={userRole}
            currentMemberName={currentMemberName}
            onOpenRoleModal={handleOpenRoleModal}
            attStartDate={attStartDate}
            setAttStartDate={(d) => requireEditPermission(() => { setAttStartDate(d); syncToFirebase({ attStartDate: d }); })}
            attEndDate={attEndDate}
            setAttEndDate={(d) => requireEditPermission(() => { setAttEndDate(d); syncToFirebase({ attEndDate: d }); })}
            dateRange={dateRange}
            setDateRange={setDateRange}
            attendanceData={attendanceData}
            setAttendanceData={updateAttendanceData}
            attMembers={millMembers}
            fineEnabled={fineEnabled}
            setFineEnabled={(e) => requireAdminAction(() => updateFineEnabled(e))}
            guestCountPerDate={guestCountPerDate}
            fixedMeal={fixedMeal}
            totalMealValue={totalMealValue}
            onGenerateSheet={handleGenerateAttendanceSheet}
            onResetAttendance={handleResetAttendance}
            onRequestConfirm={requestConfirmation}
          />
        )}

        {activeTab === 'guest' && (
          <TabGuest
            userRole={userRole}
            guestRate={guestRate}
            setGuestRate={(r) => requireAdminAction(() => updateGuestRate(r))}
            guestDateList={guestDateList}
            setGuestDateList={updateGuestDateList}
            guestMembers={millMembers}
            guestData={guestData}
            setGuestData={updateGuestData}
            dateRange={dateRange}
            onResetGuest={handleResetGuest}
            onRequestConfirm={requestConfirmation}
          />
        )}

        {activeTab === 'deposit' && (
          <TabDeposit
            userRole={userRole}
            depositData={depositData}
            setDepositData={updateDepositData}
            members={millMembers}
            onResetDeposit={handleResetDeposit}
            onRequestConfirm={requestConfirmation}
            onLogActivity={(details) => logActivity(details)}
          />
        )}

        {activeTab === 'bazar' && (
          <TabBazar
            userRole={userRole}
            currentSessionId={currentSessionId}
            activeEditors={activeEditors}
            members={millMembers}
            bazarStartDate={bazarStartDate}
            setBazarStartDate={(d) => requireEditPermission(() => { setBazarStartDate(d); syncToFirebase({ bazarStartDate: d }); })}
            bazarEndDate={bazarEndDate}
            setBazarEndDate={(d) => requireEditPermission(() => { setBazarEndDate(d); syncToFirebase({ bazarEndDate: d }); })}
            bazarData={bazarData}
            setBazarData={updateBazarData}
            onGenerateBazarSheet={handleGenerateBazarSheet}
            onResetBazar={handleResetBazar}
            onRequestConfirm={requestConfirmation}
            onLogActivity={(details) => logActivity(details)}
          />
        )}
      </main>

      {/* Role & Access Control Modal */}
      <RoleAccessModal
        isOpen={isRoleModalOpen}
        onClose={() => setIsRoleModalOpen(false)}
        initialTab={roleModalTab}
        currentRole={userRole}
        currentMemberName={currentMemberName}
        memberNames={millMembers.map(m => m.name)}
        currentSessionId={currentSessionId}
        adminPin={adminPin}
        editorPin={editorPin}
        activeEditors={activeEditors}
        editorRequests={editorRequests}
        blockedUsers={blockedUsers}
        sessionLogs={sessionLogs}
        currentUserEmail={currentUserEmail}
        memberEmails={memberEmails}
        memberPins={memberPins}
        adminEmails={adminEmails}
        onLoginWithGoogle={handleLoginWithGoogle}
        onVerifyMemberWithPin={handleVerifyMemberWithPin}
        onLinkGoogleAccount={handleLinkGoogleAccount}
        onUpdateMemberEmail={handleUpdateMemberEmail}
        onAddAdminEmail={handleAddAdminEmail}
        onRemoveAdminEmail={handleRemoveAdminEmail}
        onLoginAdmin={handleLoginAdmin}
        onLoginMember={handleLoginMember}
        onDirectEditorLogin={handleDirectEditorLogin}
        onRequestEditorAccess={handleRequestEditorAccess}
        onApproveEditorRequest={handleApproveEditorRequest}
        onRejectEditorRequest={handleRejectEditorRequest}
        onRemoveEditor={handleRemoveEditor}
        onBlockUser={handleBlockUser}
        onUnblockUser={handleUnblockUser}
        onSwitchToViewer={handleSwitchToViewer}
        onChangeAdminPin={handleChangeAdminPin}
        onChangeEditorPin={handleChangeEditorPin}
        onClearActiveEditors={handleClearActiveEditors}
        onClearSessionLogs={handleClearSessionLogs}
      />
      </div>

      {/* Confirmation Modal */}
      <ConfirmationModal
        isOpen={confirmModal.isOpen}
        message={confirmModal.message}
        onConfirm={confirmModal.onConfirm}
        onCancel={() => setConfirmModal(prev => ({ ...prev, isOpen: false }))}
      />

      {/* ATM Smart Card Authentication Gate - When Not Authenticated */}
      {!isAppAuthenticated && (
        <ATMAuthScreen
          existingMembers={millMembers.map(m => m.name)}
          adminEmails={adminEmails}
          onLoginSuccess={({ name, email, role }) => {
            setIsAppAuthenticated(true);
            localStorage.setItem('isAppAuthenticated', 'true');
            setCurrentUserEmail(email);
            localStorage.setItem('currentUserEmail', email);
            setCurrentMemberName(name);
            localStorage.setItem('currentMemberName', name);
            setUserRole(role);
            localStorage.setItem('userRole', role);
            logActivity(`ইউজার ${name} (${email}) ATM স্মার্ট কার্ড দিয়ে সিস্টেমে প্রবেশ করেছেন (${role})`);
          }}
        />
      )}
    </div>
  );
}
