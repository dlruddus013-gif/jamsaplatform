// ============================================================================
// 잠사박물관 통합 운영 플랫폼 — TypeScript 타입 정의
// ============================================================================

// ── 시설 ──
export interface Facility {
  code: string;
  name: string;
  created_at?: string;
}

// ── 예약 ──
export interface Booking {
  id: number;
  date: string;
  name: string;
  phone: string;
  arrival: string;
  departure: string;
  students: number;
  teachers: number;
  studentsChild: number;
  studentsElem: number;
  ageGroup: '유아' | '초등' | string;
  courseType: string;
  meal: string;
  addons: string[];
  status: '접수' | '대기' | '확정' | '취소' | string;
  etc?: string;
  agency?: string;
  agencyName?: string;
  channel?: string;
  category?: string;
  paidAmount?: number | null;
  actualStudents?: number | null;
  actualTeachers?: number | null;
  actualStudentsChild?: number | null;
  actualStudentsElem?: number | null;
  actualAddons?: string[] | null;
  actualMeal?: string | null;
  actualAddonQty?: AddonQty[] | null;
  actualEntryPrices?: EntryPrices | null;
  actualMealQty?: MealQty | null;
  created: string;
}

export interface AddonQty {
  name: string;
  qty: number;
  price?: number | null;
}

export interface EntryPrices {
  child?: number | null;
  elem?: number | null;
  teacher?: number | null;
}

export interface MealQty {
  child: number;
  elem: number;
  teacher: number;
  priceChild?: number | null;
  priceElem?: number | null;
}

// ── Supabase 예약 행 (snake_case) ──
export interface BookingRow {
  id?: number;
  facility_code: string;
  date: string;
  name: string;
  phone?: string | null;
  arrival: string;
  departure: string;
  students: number;
  teachers: number;
  students_child: number;
  students_elem: number;
  age_group: string;
  course_type: string;
  meal: string;
  addons: string[];
  status: string;
  etc?: string | null;
  agency?: string | null;
  agency_name?: string | null;
  channel?: string | null;
  category?: string;
  paid_amount?: number | null;
  actual_students?: number | null;
  actual_teachers?: number | null;
  actual_students_child?: number | null;
  actual_students_elem?: number | null;
  actual_addons?: string[] | null;
  actual_meal?: string | null;
  actual_addon_qty?: AddonQty[] | null;
  actual_entry_prices?: EntryPrices | null;
  actual_meal_qty?: MealQty | null;
  created: string;
}

// ── 관리자 ──
export interface AdminAccount {
  id: string;
  name: string;
  pw: string;
  role: 'master' | 'admin';
  created: string;
}

// ── 대행사 ──
export interface Agency {
  code: string;
  name: string;
  contact: string;
  fee: number;
  active: boolean;
  pw?: string;
}

export interface AgencyBizInfo {
  bizData?: Record<string, string>;
  bankData?: Record<string, string>;
}

export interface AgencySettlement {
  month: string;
  data: Record<string, unknown>;
  status?: '저장됨' | '정산요청' | '승인완료' | '거절';
}

// ── 채팅 ──
export interface ChatRoom {
  id: string;
  name: string;
  phone?: string;
  starred?: boolean;
  blocked?: boolean;
  done?: boolean;
  msgs: ChatMessage[];
  lastMsg?: string;
  lastMsgTime?: string;
}

export interface ChatMessage {
  from: 'customer' | 'admin' | 'system';
  sender?: string;
  text: string;
  ts: string;
  edited?: boolean;
}

// ── FAQ ──
export interface FaqItem {
  title: string;
  content: string;
  media: FaqMedia[];
  expanded?: boolean;
}

export interface FaqMedia {
  type: 'image' | 'video';
  url: string;
  name?: string;
}

// ── 폼 설정 ──
export interface FormConfig {
  meals: MealOption[];
  pkgDesc: string;
  entryP1: number;
  entryP2: number;
  entryTea: number;
  freeRatioChild: number;
  freeRatioElem: number;
  addons: AddonOption[];
  channels: string[];
}

export interface MealOption {
  name: string;
  p1: number;
  p2: number;
}

export interface AddonOption {
  name: string;
  price: number;
}

// ── 일정 ──
export interface TimeSlot {
  s: string;
  e: string;
  l: string;
}

export interface ScheduleCell {
  activity: string;
  bookingIds: number[];
  custom?: string;
}

export interface SavedSchedule {
  date: string;
  data: ScheduleCell[][];
  memos?: Record<string, string>;
}

// ── 일일 제한 ──
export interface DayLimit {
  maxPeople?: number;
  limitData?: Record<string, unknown>;
}

// ── 활동 로그 ──
export interface ActivityLog {
  action: string;
  desc: string;
  time: string;
  user: string;
  snap?: string | null;
  reason?: string | null;
}

// ── 색상 스키마 ──
export interface ColorScheme {
  b: string;
  r: string;
  t: string;
}

// ── 견적 항목 ──
export interface QuoteItem {
  cat: string;
  name: string;
  qty: number;
  unit: number;
  total: number;
}

export interface QuoteResult {
  items: QuoteItem[];
  grandTotal: number;
}

// ── 매출 통계 ──
export interface RevenueData {
  period: string;
  estimate: number;
  paid: number;
  bookings: number;
  people: number;
}

// ── 대시보드 카드 ──
export interface DashboardCard {
  value: string | number;
  label: string;
  sub?: string;
  color: string;
  key: string;
  small?: boolean;
}

// ── 자동 발송 설정 ──
export interface AutoSendConfig {
  enabled: boolean;
  method: 'kakao' | 'sms' | 'email';
  timing: string;
  template?: string;
}

// ── 코스 정보 ──
export interface CourseInfo {
  [key: string]: {
    video?: string;
    blog?: string;
  };
}

// ── 앱 모드 ──
export type AppMode = 'customer' | 'admin' | 'agency' | null;

// ── 예약 상태 ──
export const BOOKING_STATUSES = ['접수', '대기', '확정', '취소'] as const;
export type BookingStatus = (typeof BOOKING_STATUSES)[number];

// ── 기본 활동 목록 ──
export const DEFAULT_ACTIVITIES = [
  '박물관 관람',
  '양떼정원',
  '눈썰매장',
  '키즈카페',
  '누에쉼터',
  '사계절 썰매',
  '자유관람',
];

// ── 기본 폼 설정 ──
export const DEFAULT_FORM_CONFIG: FormConfig = {
  meals: [{ name: '오디돈가스', p1: 8000, p2: 10000 }],
  pkgDesc: '기본입장: 잠사박물관·양떼목장·사계절썰매장·키즈카페',
  entryP1: 12000,
  entryP2: 13000,
  entryTea: 12000,
  freeRatioChild: 10,
  freeRatioElem: 10,
  addons: [
    { name: '젤캔들', price: 10000 },
    { name: '먹이주기', price: 2000 },
    { name: '가이드(50인↑)', price: 2000 },
  ],
  channels: ['문자', '이메일', '우편물', '사이트'],
};

// ── 타임슬롯 생성 ──
export function generateTimeSlots(): TimeSlot[] {
  const slots: TimeSlot[] = [];
  for (let h = 10; h < 17; h++) {
    for (let m = 0; m < 60; m += 30) {
      const s = `${h}:${String(m).padStart(2, '0')}`;
      const eh = m === 30 ? h + 1 : h;
      const em = m === 30 ? 0 : 30;
      const e = `${eh}:${String(em).padStart(2, '0')}`;
      slots.push({ s, e, l: `${s}~${e}` });
    }
  }
  return slots;
}

// ── 색상 팔레트 ──
export const ACTIVITY_COLORS: ColorScheme[] = [
  { b: '#E8F5E9', r: '#4CAF50', t: '#1B5E20' },
  { b: '#FFF3E0', r: '#FF9800', t: '#BF360C' },
  { b: '#E3F2FD', r: '#2196F3', t: '#0D47A1' },
  { b: '#F3E5F5', r: '#9C27B0', t: '#4A148C' },
  { b: '#FFF9C4', r: '#FBC02D', t: '#E65100' },
  { b: '#FFEBEE', r: '#F44336', t: '#B71C1C' },
  { b: '#E0F7FA', r: '#00BCD4', t: '#006064' },
  { b: '#F1F8E9', r: '#8BC34A', t: '#33691E' },
];
