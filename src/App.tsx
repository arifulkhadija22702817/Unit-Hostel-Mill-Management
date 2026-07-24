import React, { useState, useEffect, useMemo, useRef } from 'react';
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
import { InstallAppModal } from './components/InstallAppModal';
import { RoleAccessModal, UserRole, ActiveEditorSession } from './components/RoleAccessModal';
import { subscribeToMessData, pushMessDataUpdate, MessRealtimeData } from './lib/firebase';

export default function App() {
  // Navigation & UI State
  const [activeTab, setActiveTab] = useState<string>('mill');
  const [theme, setTheme] = useState<ThemeType>(() => {
    return (localStorage.getItem('mainTheme') as ThemeType) || 'light';
  });
  const [isInstallModalOpen, setIsInstallModalOpen] = useState<boolean>(false);
  const [isRoleModalOpen, setIsRoleModalOpen] = useState<boolean>(false);
  const [roleModalTab, setRoleModalTab] = useState<'login' | 'management' | 'logs' | 'settings'>('login');

  const handleOpenRoleModal = (tab: 'login' | 'management' | 'logs' | 'settings' = 'login') => {
    setRoleModalTab(tab);
    setIsRoleModalOpen(true);
  };
  
  // Realtime & Role Management State
  const [isRealtimeSynced, setIsRealtimeSynced] = useState<boolean>(false);
  const [userRole, setUserRole] = useState<UserRole>(() => {
    return (localStorage.getItem('userRole') as UserRole) || 'viewer';
  });
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
      if (remote.adminPin) setAdminPin(remote.adminPin);
      if (remote.editorPin) setEditorPin(remote.editorPin);
      if (remote.activeEditors) setActiveEditors(remote.activeEditors);
      if (remote.editorRequests) setEditorRequests(remote.editorRequests);
      if (remote.blockedUsers) setBlockedUsers(remote.blockedUsers);
      if (remote.sessionLogs) setSessionLogs(remote.sessionLogs);

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
    requireEditPermission(() => {
      setAttendanceData(prev => {
        const next = typeof action === 'function' ? action(prev) : action;
        localStorage.setItem('attendanceData', JSON.stringify(next));
        syncToFirebase({ attendanceData: next });
        return next;
      });
    });
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
    const guestCost = totalGuestMealsSum * guestRate;
    const adjustedBig = Math.max(0, big - guestCost);
    return { big: adjustedBig, small, rawBig: big };
  }, [bazarData, totalGuestMealsSum, guestRate]);

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
  }, [activeEditors, blockedUsers, currentSessionId, userRole, editorPin, adminPin, savedEditorPinAtLogin, savedAdminPinAtLogin]);

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

  const handleSwitchToViewer = () => {
    const myEditor = activeEditors.find(e => e.id === currentSessionId);
    const previousRole = userRole;

    const nextEditors = activeEditors.filter(e => e.id !== currentSessionId);
    const nextReqs = editorRequests.filter(r => r.id !== currentSessionId);
    setActiveEditors(nextEditors);
    setEditorRequests(nextReqs);
    setUserRole('viewer');
    localStorage.setItem('userRole', 'viewer');
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

  // Generate Bazar Sheet (Admin required)
  const handleGenerateBazarSheet = () => {
    requireAdminAction(() => {
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
    <div className={`min-h-screen pb-20 md:pb-8 ${themeClassMap[theme]}`}>
      {/* Top Bar Navigation */}
      <Navbar
        activeTab={activeTab}
        setActiveTab={setActiveTab}
        currentTheme={theme}
        setTheme={setTheme}
        onOpenInstallModal={() => setIsInstallModalOpen(true)}
        currentRole={userRole}
        activeEditorsCount={activeEditors.length}
        pendingRequestsCount={editorRequests.filter(r => r.status === 'pending').length}
        onOpenRoleModal={handleOpenRoleModal}
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
                <span className="font-bold">আপনি বর্তমানে ভিউয়ার (Read-only) মোডে আছেন।</span>
                <span className="hidden sm:inline text-[11px] text-amber-700 dark:text-amber-400 block sm:inline sm:ml-1">
                  ডাটা এডিট করতে এডিটর (সর্বোচ্চ ৩ জন) অথবা এডমিন মোডে প্রবেশ করুন।
                </span>
              </div>
            </div>
            <button
              onClick={() => setIsRoleModalOpen(true)}
              className="px-3 py-1.5 bg-amber-500 hover:bg-amber-600 text-slate-950 font-bold rounded-xl text-xs cursor-pointer flex-shrink-0 transition-all active:scale-95"
            >
              এডিট মোড আনলক
            </button>
          </div>
        )}

        {activeTab === 'mill' && (
          <TabMeal
            userRole={userRole}
            millDate={millDate}
            setMillDate={updateMillDate}
            millManager={millManager}
            setMillManager={updateMillManager}
            millSmall={totalBazarSums.small}
            millBig={totalBazarSums.big}
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
            attStartDate={attStartDate}
            setAttStartDate={(d) => requireEditPermission(() => { setAttStartDate(d); syncToFirebase({ attStartDate: d }); })}
            attEndDate={attEndDate}
            setAttEndDate={(d) => requireEditPermission(() => { setAttEndDate(d); syncToFirebase({ attEndDate: d }); })}
            dateRange={dateRange}
            setDateRange={setDateRange}
            attendanceData={attendanceData}
            setAttendanceData={updateAttendanceData}
            attMembers={millMembers}
            mealOffDays={mealOffDays}
            setMealOffDays={updateMealOffDays}
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
          />
        )}

        {activeTab === 'bazar' && (
          <TabBazar
            userRole={userRole}
            bazarStartDate={bazarStartDate}
            setBazarStartDate={(d) => requireEditPermission(() => { setBazarStartDate(d); syncToFirebase({ bazarStartDate: d }); })}
            bazarEndDate={bazarEndDate}
            setBazarEndDate={(d) => requireEditPermission(() => { setBazarEndDate(d); syncToFirebase({ bazarEndDate: d }); })}
            bazarData={bazarData}
            setBazarData={updateBazarData}
            onGenerateBazarSheet={handleGenerateBazarSheet}
            onResetBazar={handleResetBazar}
            onRequestConfirm={requestConfirmation}
          />
        )}
      </main>

      {/* Role & Access Control Modal */}
      <RoleAccessModal
        isOpen={isRoleModalOpen}
        onClose={() => setIsRoleModalOpen(false)}
        initialTab={roleModalTab}
        currentRole={userRole}
        currentSessionId={currentSessionId}
        adminPin={adminPin}
        editorPin={editorPin}
        activeEditors={activeEditors}
        editorRequests={editorRequests}
        blockedUsers={blockedUsers}
        sessionLogs={sessionLogs}
        onLoginAdmin={handleLoginAdmin}
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

      {/* Confirmation Modal */}
      <ConfirmationModal
        isOpen={confirmModal.isOpen}
        message={confirmModal.message}
        onConfirm={confirmModal.onConfirm}
        onCancel={() => setConfirmModal(prev => ({ ...prev, isOpen: false }))}
      />

      {/* App Installation & Backup Modal */}
      <InstallAppModal
        isOpen={isInstallModalOpen}
        onClose={() => setIsInstallModalOpen(false)}
        allAppData={allAppDataObject}
        onRestoreData={handleRestoreAppData}
      />
    </div>
  );
}
