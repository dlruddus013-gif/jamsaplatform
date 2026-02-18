// ============================================================================
// Supabase 클라이언트 초기화 및 API
// ============================================================================
import { createClient, SupabaseClient } from '@supabase/supabase-js';
import type { Booking, BookingRow } from '@/types';

const SB_URL = process.env.NEXT_PUBLIC_SUPABASE_URL || '';
const SB_KEY = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY || '';

let supabaseClient: SupabaseClient | null = null;

export function getSupabase(): SupabaseClient | null {
  if (!SB_URL || !SB_KEY || SB_URL.includes('YOUR_PROJECT_ID')) {
    return null;
  }
  if (!supabaseClient) {
    supabaseClient = createClient(SB_URL, SB_KEY);
  }
  return supabaseClient;
}

export function isSupabaseConfigured(): boolean {
  return !!SB_URL && !!SB_KEY && !SB_URL.includes('YOUR_PROJECT_ID');
}

// ── 예약 변환: Supabase Row → 앱 Booking ──
export function bookingFromRow(r: BookingRow): Booking {
  return {
    id: r.id ?? 0,
    date: r.date,
    name: r.name,
    phone: r.phone ?? '',
    arrival: r.arrival,
    departure: r.departure,
    students: r.students || 0,
    teachers: r.teachers || 0,
    studentsChild: r.students_child || 0,
    studentsElem: r.students_elem || 0,
    ageGroup: r.age_group || '유아',
    courseType: r.course_type || '기본코스',
    meal: r.meal || '이용안함',
    addons: r.addons || [],
    status: r.status || '접수',
    etc: r.etc ?? undefined,
    agency: r.agency ?? undefined,
    agencyName: r.agency_name ?? undefined,
    channel: r.channel ?? undefined,
    category: r.category,
    paidAmount: r.paid_amount,
    actualStudents: r.actual_students,
    actualTeachers: r.actual_teachers,
    actualStudentsChild: r.actual_students_child,
    actualStudentsElem: r.actual_students_elem,
    actualAddons: r.actual_addons,
    actualMeal: r.actual_meal,
    actualAddonQty: r.actual_addon_qty,
    actualEntryPrices: r.actual_entry_prices,
    actualMealQty: r.actual_meal_qty,
    created: r.created,
  };
}

// ── 예약 변환: 앱 Booking → Supabase Row ──
export function bookingToRow(b: Booking, facilityCode: string): BookingRow {
  return {
    facility_code: facilityCode,
    date: b.date,
    name: b.name,
    phone: b.phone || null,
    arrival: b.arrival,
    departure: b.departure,
    students: b.students || 0,
    teachers: b.teachers || 0,
    students_child: b.studentsChild || 0,
    students_elem: b.studentsElem || 0,
    age_group: b.ageGroup || '유아',
    course_type: b.courseType || '기본코스',
    meal: b.meal || '이용안함',
    addons: b.addons || [],
    status: b.status || '접수',
    etc: b.etc || null,
    agency: b.agency || null,
    agency_name: b.agencyName || null,
    channel: b.channel || null,
    category: b.category || '미분류',
    paid_amount: b.paidAmount ?? null,
    actual_students: b.actualStudents ?? null,
    actual_teachers: b.actualTeachers ?? null,
    actual_students_child: b.actualStudentsChild ?? null,
    actual_students_elem: b.actualStudentsElem ?? null,
    actual_addons: b.actualAddons || null,
    actual_meal: b.actualMeal || null,
    actual_addon_qty: b.actualAddonQty || null,
    actual_entry_prices: b.actualEntryPrices || null,
    actual_meal_qty: b.actualMealQty || null,
    created: b.created || new Date().toISOString().split('T')[0],
  };
}
