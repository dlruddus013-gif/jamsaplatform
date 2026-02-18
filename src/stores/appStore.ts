import { create } from 'zustand';
import type {
  MainTab,
  MasterSubTab,
  User,
  Notification,
  DashboardStats,
  Reservation,
  Facility,
  Program,
  Agency,
  Schedule,
  ChatRoom,
  ChatMessage,
  SystemUpdate,
  LocalPatch,
  ActivityLog,
  ReservationFormConfig,
} from '../types';

// 앱 전역 상태
interface AppState {
  // 네비게이션
  activeMainTab: MainTab;
  activeMasterSubTab: MasterSubTab;
  sidebarCollapsed: boolean;
  setActiveMainTab: (tab: MainTab) => void;
  setActiveMasterSubTab: (tab: MasterSubTab) => void;
  toggleSidebar: () => void;

  // 사용자
  currentUser: User | null;
  setCurrentUser: (user: User | null) => void;

  // 알림
  notifications: Notification[];
  unreadNotificationCount: number;
  addNotification: (notification: Notification) => void;
  markNotificationRead: (id: string) => void;
  clearNotifications: () => void;

  // 로딩
  isLoading: boolean;
  setLoading: (loading: boolean) => void;

  // 토스트 메시지
  toasts: Toast[];
  addToast: (toast: Omit<Toast, 'id'>) => void;
  removeToast: (id: string) => void;
}

interface Toast {
  id: string;
  type: 'success' | 'error' | 'warning' | 'info';
  title: string;
  message?: string;
  duration?: number;
}

export const useAppStore = create<AppState>((set) => ({
  // 네비게이션
  activeMainTab: 'master',
  activeMasterSubTab: 'system',
  sidebarCollapsed: false,
  setActiveMainTab: (tab) => set({ activeMainTab: tab }),
  setActiveMasterSubTab: (tab) => set({ activeMasterSubTab: tab }),
  toggleSidebar: () => set((state) => ({ sidebarCollapsed: !state.sidebarCollapsed })),

  // 사용자
  currentUser: {
    id: '1',
    email: 'admin@jamsa.museum',
    name: '관리자',
    role: 'superadmin',
    department: '운영팀',
    created_at: '2024-01-01T00:00:00Z',
    last_login_at: new Date().toISOString(),
  },
  setCurrentUser: (user) => set({ currentUser: user }),

  // 알림
  notifications: [
    {
      id: '1',
      title: '새 예약 접수',
      message: '한국초등학교 외 2건의 새 예약이 접수되었습니다.',
      type: 'info',
      read: false,
      created_at: new Date().toISOString(),
    },
    {
      id: '2',
      title: '시스템 업데이트 완료',
      message: 'v2.10.0 업데이트가 성공적으로 적용되었습니다.',
      type: 'success',
      read: false,
      created_at: new Date(Date.now() - 3600000).toISOString(),
    },
    {
      id: '3',
      title: '예약 취소 알림',
      message: '내일 예정된 체험프로그램 1건이 취소되었습니다.',
      type: 'warning',
      read: true,
      created_at: new Date(Date.now() - 7200000).toISOString(),
    },
  ],
  unreadNotificationCount: 2,
  addNotification: (notification) =>
    set((state) => ({
      notifications: [notification, ...state.notifications],
      unreadNotificationCount: state.unreadNotificationCount + 1,
    })),
  markNotificationRead: (id) =>
    set((state) => ({
      notifications: state.notifications.map((n) =>
        n.id === id ? { ...n, read: true } : n
      ),
      unreadNotificationCount: Math.max(0, state.unreadNotificationCount - 1),
    })),
  clearNotifications: () =>
    set({
      notifications: [],
      unreadNotificationCount: 0,
    }),

  // 로딩
  isLoading: false,
  setLoading: (loading) => set({ isLoading: loading }),

  // 토스트 메시지
  toasts: [],
  addToast: (toast) =>
    set((state) => ({
      toasts: [...state.toasts, { ...toast, id: crypto.randomUUID() }],
    })),
  removeToast: (id) =>
    set((state) => ({
      toasts: state.toasts.filter((t) => t.id !== id),
    })),
}));

// 대시보드 스토어
interface DashboardState {
  stats: DashboardStats;
  dateRange: { start: string; end: string };
  setDateRange: (range: { start: string; end: string }) => void;
}

export const useDashboardStore = create<DashboardState>((set) => ({
  stats: {
    today_reservations: 12,
    today_visitors: 156,
    today_revenue: 2340000,
    pending_reservations: 5,
    monthly_reservations: 248,
    monthly_revenue: 47520000,
    monthly_visitors: 3842,
    popular_programs: [
      { program: '누에고치 공예체험', count: 89 },
      { program: '실크 스카프 염색', count: 67 },
      { program: '전통 직조 체험', count: 54 },
      { program: '잠사 역사 투어', count: 48 },
      { program: '견직물 만들기', count: 35 },
    ],
    reservation_trend: Array.from({ length: 30 }, (_, i) => ({
      date: new Date(Date.now() - (29 - i) * 86400000).toISOString().split('T')[0],
      count: Math.floor(Math.random() * 15) + 5,
      revenue: Math.floor(Math.random() * 500000) + 100000,
    })),
    facility_usage: [
      { facility: '제1전시관', usage_rate: 85 },
      { facility: '체험교실A', usage_rate: 92 },
      { facility: '체험교실B', usage_rate: 78 },
      { facility: '야외체험장', usage_rate: 65 },
      { facility: '세미나실', usage_rate: 45 },
      { facility: '교육관', usage_rate: 88 },
    ],
  },
  dateRange: {
    start: new Date(new Date().getFullYear(), new Date().getMonth(), 1).toISOString().split('T')[0],
    end: new Date().toISOString().split('T')[0],
  },
  setDateRange: (range) => set({ dateRange: range }),
}));

// 예약 스토어
interface ReservationState {
  reservations: Reservation[];
  selectedReservation: Reservation | null;
  filters: {
    status: string;
    date: string;
    facility: string;
    search: string;
  };
  setReservations: (reservations: Reservation[]) => void;
  setSelectedReservation: (reservation: Reservation | null) => void;
  setFilter: (key: string, value: string) => void;
  resetFilters: () => void;
}

export const useReservationStore = create<ReservationState>((set) => ({
  reservations: [],
  selectedReservation: null,
  filters: {
    status: 'all',
    date: '',
    facility: 'all',
    search: '',
  },
  setReservations: (reservations) => set({ reservations }),
  setSelectedReservation: (reservation) => set({ selectedReservation: reservation }),
  setFilter: (key, value) =>
    set((state) => ({
      filters: { ...state.filters, [key]: value },
    })),
  resetFilters: () =>
    set({
      filters: { status: 'all', date: '', facility: 'all', search: '' },
    }),
}));

// 시설 스토어
interface FacilityState {
  facilities: Facility[];
  setFacilities: (facilities: Facility[]) => void;
}

export const useFacilityStore = create<FacilityState>((set) => ({
  facilities: [],
  setFacilities: (facilities) => set({ facilities }),
}));

// 프로그램 스토어
interface ProgramState {
  programs: Program[];
  setPrograms: (programs: Program[]) => void;
}

export const useProgramStore = create<ProgramState>((set) => ({
  programs: [],
  setPrograms: (programs) => set({ programs }),
}));

// 대행사 스토어
interface AgencyState {
  agencies: Agency[];
  selectedAgency: Agency | null;
  setAgencies: (agencies: Agency[]) => void;
  setSelectedAgency: (agency: Agency | null) => void;
}

export const useAgencyStore = create<AgencyState>((set) => ({
  agencies: [],
  selectedAgency: null,
  setAgencies: (agencies) => set({ agencies }),
  setSelectedAgency: (agency) => set({ selectedAgency: agency }),
}));

// 일정 스토어
interface ScheduleState {
  schedules: Schedule[];
  selectedDate: string;
  viewMode: 'day' | 'week' | 'month';
  setSchedules: (schedules: Schedule[]) => void;
  setSelectedDate: (date: string) => void;
  setViewMode: (mode: 'day' | 'week' | 'month') => void;
}

export const useScheduleStore = create<ScheduleState>((set) => ({
  schedules: [],
  selectedDate: new Date().toISOString().split('T')[0],
  viewMode: 'week',
  setSchedules: (schedules) => set({ schedules }),
  setSelectedDate: (date) => set({ selectedDate: date }),
  setViewMode: (mode) => set({ viewMode: mode }),
}));

// 채팅 스토어
interface ChatState {
  rooms: ChatRoom[];
  activeRoom: ChatRoom | null;
  messages: ChatMessage[];
  setRooms: (rooms: ChatRoom[]) => void;
  setActiveRoom: (room: ChatRoom | null) => void;
  setMessages: (messages: ChatMessage[]) => void;
  addMessage: (message: ChatMessage) => void;
}

export const useChatStore = create<ChatState>((set) => ({
  rooms: [],
  activeRoom: null,
  messages: [],
  setRooms: (rooms) => set({ rooms }),
  setActiveRoom: (room) => set({ activeRoom: room }),
  setMessages: (messages) => set({ messages }),
  addMessage: (message) =>
    set((state) => ({
      messages: [...state.messages, message],
    })),
}));

// 시스템 스토어
interface SystemState {
  currentVersion: string;
  buildNumber: string;
  updates: SystemUpdate[];
  patches: LocalPatch[];
  activityLogs: ActivityLog[];
  moduleCount: number;
  storageUsed: string;
  setUpdates: (updates: SystemUpdate[]) => void;
  setPatches: (patches: LocalPatch[]) => void;
  setActivityLogs: (logs: ActivityLog[]) => void;
}

export const useSystemStore = create<SystemState>((set) => ({
  currentVersion: 'v2.10.0',
  buildNumber: 'Build 20260213',
  updates: [],
  patches: [
    {
      id: 'p1',
      name: 'FAQ 미디어 빈 배열 수정',
      description: 'FAQ 항목에서 미디어 필드가 빈 배열일 때 발생하는 렌더링 오류를 수정했습니다.',
      type: 'bugfix',
      status: 'applied',
      applied_at: '2026-02-13T10:30:00Z',
      file_changes: ['src/components/faq/FaqList.tsx', 'src/api/faq.ts'],
      can_rollback: true,
      can_rerun: true,
    },
    {
      id: 'p2',
      name: '예약 courseType 기본값 수정',
      description: '예약 생성 시 courseType 필드의 기본값이 누락되는 문제를 수정했습니다.',
      type: 'bugfix',
      status: 'applied',
      applied_at: '2026-02-12T14:15:00Z',
      file_changes: ['src/api/reservation.ts', 'src/types/index.ts'],
      can_rollback: true,
      can_rerun: true,
    },
    {
      id: 'p3',
      name: '활동 로그 1000+ 정리',
      description: '1000건 이상의 오래된 활동 로그를 정리하여 성능을 개선했습니다.',
      type: 'improvement',
      status: 'applied',
      applied_at: '2026-02-11T09:00:00Z',
      file_changes: ['supabase/functions/cleanup-logs/index.ts'],
      can_rollback: false,
      can_rerun: true,
    },
  ],
  activityLogs: [],
  moduleCount: 7,
  storageUsed: '260KB',
  setUpdates: (updates) => set({ updates }),
  setPatches: (patches) => set({ patches }),
  setActivityLogs: (logs) => set({ activityLogs: logs }),
}));
