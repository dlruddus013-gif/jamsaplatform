// ============================================================================
// 앱 전역 상태 관리 — Zustand
// ============================================================================
import { create } from 'zustand';
import type {
  AppMode,
  Facility,
  AdminAccount,
  Agency,
  Booking,
  FormConfig,
  ActivityLog,
  DayLimit,
  ChatRoom,
  FaqItem,
  CourseInfo,
} from '@/types';
import { DEFAULT_FORM_CONFIG, DEFAULT_ACTIVITIES } from '@/types';

interface AppState {
  // ── 시설 ──
  facilities: Facility[];
  currentFacility: Facility | null;
  facilityPrefix: string;

  // ── 인증 ──
  mode: AppMode;
  currentAdmin: AdminAccount | null;
  currentAgency: Agency | null;
  adminAccounts: AdminAccount[];
  userPhone: string;

  // ── 예약 ──
  bookings: Booking[];
  nextId: number;

  // ── 활동 ──
  activities: string[];

  // ── 대행사 ──
  agencies: Agency[];

  // ── 설정 ──
  formConfig: FormConfig;
  dayLimits: Record<string, DayLimit>;

  // ── 채팅 ──
  chatRooms: Record<string, ChatRoom>;
  chatFaq: FaqItem[];

  // ── 로그 ──
  activityLog: ActivityLog[];

  // ── 코스 정보 ──
  courseInfo: CourseInfo;

  // ── 메모 ──
  memos: Record<string, string>;

  // ── UI 상태 ──
  currentPage: string;
  calendarYear: number;
  calendarMonth: number;
  selectedDate: string | null;

  // ── Undo/Redo ──
  undoStack: Array<{ action: string; desc: string; oldData: string; time: string }>;
  redoStack: Array<{ action: string; desc: string; oldData: string; time: string }>;

  // ── Actions ──
  setFacilities: (facilities: Facility[]) => void;
  setCurrentFacility: (facility: Facility | null) => void;
  setMode: (mode: AppMode) => void;
  setCurrentAdmin: (admin: AdminAccount | null) => void;
  setCurrentAgency: (agency: Agency | null) => void;
  setAdminAccounts: (accounts: AdminAccount[]) => void;
  setUserPhone: (phone: string) => void;
  setBookings: (bookings: Booking[]) => void;
  addBooking: (booking: Booking) => void;
  updateBooking: (id: number, updates: Partial<Booking>) => void;
  removeBooking: (id: number) => void;
  setActivities: (activities: string[]) => void;
  setAgencies: (agencies: Agency[]) => void;
  setFormConfig: (config: FormConfig) => void;
  setDayLimits: (limits: Record<string, DayLimit>) => void;
  setChatRooms: (rooms: Record<string, ChatRoom>) => void;
  setChatFaq: (faq: FaqItem[]) => void;
  setActivityLog: (log: ActivityLog[]) => void;
  addActivityLog: (entry: ActivityLog) => void;
  setCourseInfo: (info: CourseInfo) => void;
  setMemos: (memos: Record<string, string>) => void;
  setCurrentPage: (page: string) => void;
  setCalendar: (year: number, month: number) => void;
  setSelectedDate: (date: string | null) => void;
  pushUndo: (action: string, desc: string) => void;
  undo: () => void;
  redo: () => void;
  loadFacilityData: (facilityCode: string) => void;
  logout: () => void;
}

const now = new Date();

export const useAppStore = create<AppState>((set, get) => ({
  // ── 초기 상태 ──
  facilities: [],
  currentFacility: null,
  facilityPrefix: 'jp_',
  mode: null,
  currentAdmin: null,
  currentAgency: null,
  adminAccounts: [],
  userPhone: '',
  bookings: [],
  nextId: 1,
  activities: [...DEFAULT_ACTIVITIES],
  agencies: [],
  formConfig: { ...DEFAULT_FORM_CONFIG },
  dayLimits: {},
  chatRooms: {},
  chatFaq: [],
  activityLog: [],
  courseInfo: {},
  memos: {},
  currentPage: 'facility',
  calendarYear: now.getFullYear(),
  calendarMonth: now.getMonth(),
  selectedDate: null,
  undoStack: [],
  redoStack: [],

  // ── Actions ──
  setFacilities: (facilities) => set({ facilities }),
  setCurrentFacility: (facility) =>
    set({
      currentFacility: facility,
      facilityPrefix: facility ? `${facility.code}_` : 'jp_',
    }),
  setMode: (mode) => set({ mode }),
  setCurrentAdmin: (admin) => set({ currentAdmin: admin }),
  setCurrentAgency: (agency) => set({ currentAgency: agency }),
  setAdminAccounts: (accounts) => set({ adminAccounts: accounts }),
  setUserPhone: (phone) => set({ userPhone: phone }),

  setBookings: (bookings) =>
    set({
      bookings,
      nextId:
        bookings.length > 0
          ? Math.max(...bookings.map((b) => b.id)) + 1
          : 1,
    }),

  addBooking: (booking) =>
    set((state) => ({
      bookings: [...state.bookings, booking],
      nextId: booking.id + 1,
    })),

  updateBooking: (id, updates) =>
    set((state) => ({
      bookings: state.bookings.map((b) =>
        b.id === id ? { ...b, ...updates } : b
      ),
    })),

  removeBooking: (id) =>
    set((state) => ({
      bookings: state.bookings.filter((b) => b.id !== id),
    })),

  setActivities: (activities) => set({ activities }),
  setAgencies: (agencies) => set({ agencies }),
  setFormConfig: (config) => set({ formConfig: config }),
  setDayLimits: (limits) => set({ dayLimits: limits }),
  setChatRooms: (rooms) => set({ chatRooms: rooms }),
  setChatFaq: (faq) => set({ chatFaq: faq }),

  setActivityLog: (log) => set({ activityLog: log }),
  addActivityLog: (entry) =>
    set((state) => {
      const log = [...state.activityLog, entry];
      // 200건 제한
      return { activityLog: log.length > 200 ? log.slice(-200) : log };
    }),

  setCourseInfo: (info) => set({ courseInfo: info }),
  setMemos: (memos) => set({ memos }),
  setCurrentPage: (page) => set({ currentPage: page }),

  setCalendar: (year, month) =>
    set({ calendarYear: year, calendarMonth: month }),

  setSelectedDate: (date) => set({ selectedDate: date }),

  pushUndo: (action, desc) =>
    set((state) => {
      const snapshot = JSON.stringify(state.bookings);
      const stack = [
        ...state.undoStack,
        { action, desc, oldData: snapshot, time: new Date().toLocaleString('ko-KR') },
      ];
      return {
        undoStack: stack.length > 50 ? stack.slice(-50) : stack,
        redoStack: [],
      };
    }),

  undo: () =>
    set((state) => {
      if (state.undoStack.length === 0) return state;
      const item = state.undoStack[state.undoStack.length - 1];
      const curData = JSON.stringify(state.bookings);
      return {
        bookings: JSON.parse(item.oldData),
        undoStack: state.undoStack.slice(0, -1),
        redoStack: [
          ...state.redoStack,
          { ...item, oldData: curData },
        ],
      };
    }),

  redo: () =>
    set((state) => {
      if (state.redoStack.length === 0) return state;
      const item = state.redoStack[state.redoStack.length - 1];
      const curData = JSON.stringify(state.bookings);
      return {
        bookings: JSON.parse(item.oldData),
        redoStack: state.redoStack.slice(0, -1),
        undoStack: [
          ...state.undoStack,
          { ...item, oldData: curData },
        ],
      };
    }),

  loadFacilityData: (facilityCode) => {
    const fp = `${facilityCode}_`;
    try {
      const bks = JSON.parse(localStorage.getItem(`${fp}bk`) || '[]');
      const cs = JSON.parse(
        localStorage.getItem(`${fp}cs`) || 'null'
      ) || [...DEFAULT_ACTIVITIES];
      const admins = JSON.parse(
        localStorage.getItem(`${fp}admins`) || 'null'
      ) || [{ id: 'master', name: '마스터', pw: '1234', role: 'master' as const, created: new Date().toISOString().split('T')[0] }];
      const agencies = JSON.parse(
        localStorage.getItem(`${fp}agencies`) || '[]'
      );
      const formCfg = JSON.parse(
        localStorage.getItem(`${fp}formcfg`) || 'null'
      ) || { ...DEFAULT_FORM_CONFIG };
      const dayLimits = JSON.parse(
        localStorage.getItem(`${fp}daylimits`) || '{}'
      );
      const chatFaq = JSON.parse(
        localStorage.getItem(`${fp}chatfaq`) || '[]'
      );
      const actLog = JSON.parse(
        localStorage.getItem(`${fp}actlog`) || '[]'
      );
      const courseInfo = JSON.parse(
        localStorage.getItem(`${fp}courseInfo`) || '{}'
      );
      const memos = JSON.parse(
        localStorage.getItem(`${fp}memos`) || '{}'
      );

      set({
        bookings: bks,
        nextId: bks.length > 0 ? Math.max(...bks.map((b: Booking) => b.id)) + 1 : 1,
        activities: cs,
        adminAccounts: admins,
        agencies,
        formConfig: formCfg,
        dayLimits,
        chatFaq,
        activityLog: actLog,
        courseInfo,
        memos,
      });
    } catch (e) {
      console.error('[데이터 로드 오류]', e);
    }
  },

  logout: () =>
    set({
      mode: null,
      currentAdmin: null,
      currentAgency: null,
      userPhone: '',
      currentPage: 'login',
    }),
}));
