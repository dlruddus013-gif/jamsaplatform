// ============================================================
// 잠사박물관 플레이팝 - 타입 정의
// ============================================================

// 네비게이션 타입
export type MainTab = 'master' | 'dashboard' | 'calendar' | 'reservation' | 'schedule' | 'chat' | 'agency';

export type MasterSubTab = 'facility' | 'data' | 'admin' | 'account' | 'reservationForm' | 'agency' | 'system';

// 사용자 역할
export type UserRole = 'superadmin' | 'admin' | 'manager' | 'staff' | 'viewer';

// 사용자 정보
export interface User {
  id: string;
  email: string;
  name: string;
  role: UserRole;
  avatar_url?: string;
  phone?: string;
  department?: string;
  created_at: string;
  last_login_at?: string;
}

// 시설 정보
export interface Facility {
  id: string;
  name: string;
  type: FacilityType;
  capacity: number;
  location: string;
  floor: string;
  status: FacilityStatus;
  description?: string;
  equipment: string[];
  operating_hours: OperatingHours;
  image_url?: string;
  created_at: string;
  updated_at: string;
}

export type FacilityType = 'exhibition' | 'experience' | 'education' | 'event' | 'meeting' | 'outdoor';

export type FacilityStatus = 'active' | 'maintenance' | 'closed' | 'reserved';

export interface OperatingHours {
  weekday: { open: string; close: string };
  weekend: { open: string; close: string };
  holiday: { open: string; close: string } | null;
}

// 예약 관련 타입
export interface Reservation {
  id: string;
  reservation_number: string;
  facility_id: string;
  facility?: Facility;
  customer_name: string;
  customer_phone: string;
  customer_email?: string;
  organization?: string;
  program_id?: string;
  program?: Program;
  date: string;
  start_time: string;
  end_time: string;
  visitor_count: number;
  adult_count: number;
  child_count: number;
  status: ReservationStatus;
  payment_status: PaymentStatus;
  payment_amount: number;
  notes?: string;
  agency_id?: string;
  agency?: Agency;
  course_type: CourseType;
  created_at: string;
  updated_at: string;
  deleted_at?: string;
}

export type ReservationStatus = 'pending' | 'confirmed' | 'cancelled' | 'completed' | 'noshow';

export type PaymentStatus = 'unpaid' | 'partial' | 'paid' | 'refunded';

export type CourseType = 'A' | 'B' | 'C' | 'D' | 'custom';

// 프로그램 타입
export interface Program {
  id: string;
  name: string;
  description: string;
  category: ProgramCategory;
  duration_minutes: number;
  min_participants: number;
  max_participants: number;
  price_adult: number;
  price_child: number;
  price_group?: number;
  materials: string[];
  requirements?: string;
  facility_id: string;
  status: 'active' | 'inactive' | 'draft';
  image_url?: string;
  created_at: string;
  updated_at: string;
}

export type ProgramCategory = 'experience' | 'education' | 'exhibition' | 'event' | 'special';

// 대행사 타입
export interface Agency {
  id: string;
  name: string;
  business_number: string;
  contact_person: string;
  phone: string;
  email: string;
  address: string;
  commission_rate: number;
  status: 'active' | 'inactive' | 'pending';
  contract_start: string;
  contract_end: string;
  total_reservations: number;
  total_revenue: number;
  notes?: string;
  created_at: string;
  updated_at: string;
}

// 일정 타입
export interface Schedule {
  id: string;
  title: string;
  description?: string;
  date: string;
  start_time: string;
  end_time: string;
  type: ScheduleType;
  facility_id?: string;
  facility?: Facility;
  assigned_to: string[];
  status: 'scheduled' | 'in_progress' | 'completed' | 'cancelled';
  color?: string;
  recurrence?: RecurrenceRule;
  created_at: string;
  updated_at: string;
}

export type ScheduleType = 'program' | 'maintenance' | 'meeting' | 'event' | 'holiday' | 'other';

export interface RecurrenceRule {
  frequency: 'daily' | 'weekly' | 'monthly';
  interval: number;
  end_date?: string;
  days_of_week?: number[];
}

// 채팅 타입
export interface ChatMessage {
  id: string;
  room_id: string;
  sender_id: string;
  sender_name: string;
  content: string;
  type: 'text' | 'image' | 'file' | 'system';
  file_url?: string;
  read_by: string[];
  created_at: string;
}

export interface ChatRoom {
  id: string;
  name: string;
  type: 'direct' | 'group' | 'channel';
  participants: string[];
  last_message?: ChatMessage;
  unread_count: number;
  created_at: string;
  updated_at: string;
}

// 대시보드 통계 타입
export interface DashboardStats {
  today_reservations: number;
  today_visitors: number;
  today_revenue: number;
  pending_reservations: number;
  monthly_reservations: number;
  monthly_revenue: number;
  monthly_visitors: number;
  popular_programs: { program: string; count: number }[];
  reservation_trend: { date: string; count: number; revenue: number }[];
  facility_usage: { facility: string; usage_rate: number }[];
}

// 시스템 업데이트/마이그레이션 타입
export interface SystemUpdate {
  id: string;
  version: string;
  build_number: string;
  description: string;
  type: 'update' | 'migration' | 'patch';
  status: 'pending' | 'applied' | 'failed' | 'rolled_back';
  applied_at?: string;
  applied_by?: string;
  rollback_available: boolean;
  size_kb: number;
  changelog: string[];
  created_at: string;
}

export interface LocalPatch {
  id: string;
  name: string;
  description: string;
  type: 'bugfix' | 'hotfix' | 'improvement';
  status: 'applied' | 'pending' | 'failed' | 'rolled_back';
  applied_at: string;
  file_changes: string[];
  can_rollback: boolean;
  can_rerun: boolean;
}

// 활동 로그 타입
export interface ActivityLog {
  id: string;
  user_id: string;
  user_name: string;
  action: string;
  target_type: string;
  target_id: string;
  details?: Record<string, unknown>;
  ip_address?: string;
  created_at: string;
}

// 알림 타입
export interface Notification {
  id: string;
  title: string;
  message: string;
  type: 'info' | 'success' | 'warning' | 'error';
  read: boolean;
  action_url?: string;
  created_at: string;
}

// 예약 폼 설정 타입
export interface ReservationFormConfig {
  id: string;
  name: string;
  fields: FormField[];
  programs: string[];
  is_active: boolean;
  require_payment: boolean;
  confirmation_message: string;
  cancellation_policy: string;
  created_at: string;
  updated_at: string;
}

export interface FormField {
  id: string;
  label: string;
  type: 'text' | 'number' | 'email' | 'phone' | 'date' | 'time' | 'select' | 'checkbox' | 'textarea';
  required: boolean;
  options?: string[];
  placeholder?: string;
  validation?: string;
  order: number;
}

// 페이지네이션
export interface PaginationParams {
  page: number;
  limit: number;
  sort_by?: string;
  sort_order?: 'asc' | 'desc';
}

export interface PaginatedResponse<T> {
  data: T[];
  total: number;
  page: number;
  limit: number;
  total_pages: number;
}

// API 응답 타입
export interface ApiResponse<T> {
  success: boolean;
  data?: T;
  error?: string;
  message?: string;
}
