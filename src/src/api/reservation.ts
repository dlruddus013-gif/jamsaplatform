// ============================================================================
// 예약 API — Supabase CRUD + localStorage 캐시
// ============================================================================
import { getSupabase, bookingFromRow, bookingToRow } from './supabase';
import type { Booking, BookingRow } from '@/types';

const TABLE = 'bookings';

// ── 예약 목록 조회 ──
export async function fetchBookings(facilityCode: string): Promise<Booking[]> {
  const sb = getSupabase();
  if (!sb) {
    // localStorage 전용 모드
    const raw = localStorage.getItem(`${facilityCode}_bk`);
    return raw ? JSON.parse(raw) : [];
  }

  const { data, error } = await sb
    .from(TABLE)
    .select('*')
    .eq('facility_code', facilityCode)
    .order('date', { ascending: true });

  if (error) {
    console.error('[예약 조회 오류]', error.message);
    // 폴백: localStorage
    const raw = localStorage.getItem(`${facilityCode}_bk`);
    return raw ? JSON.parse(raw) : [];
  }

  const bookings = (data as BookingRow[]).map(bookingFromRow);
  // 캐시 저장
  try {
    localStorage.setItem(`${facilityCode}_bk`, JSON.stringify(bookings));
  } catch { /* 용량 초과 무시 */ }

  return bookings;
}

// ── 예약 저장 (upsert) ──
export async function saveBookings(
  bookings: Booking[],
  facilityCode: string
): Promise<void> {
  // localStorage 먼저 저장
  try {
    localStorage.setItem(`${facilityCode}_bk`, JSON.stringify(bookings));
  } catch { /* 용량 초과 무시 */ }

  const sb = getSupabase();
  if (!sb) return;

  const rows = bookings.map((b) => ({
    id: b.id,
    ...bookingToRow(b, facilityCode),
  }));

  const { error } = await sb
    .from(TABLE)
    .upsert(rows, { onConflict: 'id' });

  if (error) {
    console.error('[예약 저장 오류]', error.message);
  }
}

// ── 예약 단건 추가 ──
export async function addBooking(
  booking: Omit<Booking, 'id'>,
  facilityCode: string
): Promise<Booking | null> {
  const sb = getSupabase();

  if (!sb) {
    // localStorage 전용
    const raw = localStorage.getItem(`${facilityCode}_bk`);
    const list: Booking[] = raw ? JSON.parse(raw) : [];
    const newId = list.length > 0 ? Math.max(...list.map((b) => b.id)) + 1 : 1;
    const newBooking: Booking = { ...booking, id: newId };
    list.push(newBooking);
    localStorage.setItem(`${facilityCode}_bk`, JSON.stringify(list));
    return newBooking;
  }

  const row = bookingToRow(booking as Booking, facilityCode);
  const { data, error } = await sb
    .from(TABLE)
    .insert(row)
    .select()
    .single();

  if (error) {
    console.error('[예약 추가 오류]', error.message);
    return null;
  }

  return bookingFromRow(data as BookingRow);
}

// ── 예약 수정 ──
export async function updateBooking(
  booking: Booking,
  facilityCode: string
): Promise<boolean> {
  const sb = getSupabase();

  // localStorage 업데이트
  const raw = localStorage.getItem(`${facilityCode}_bk`);
  const list: Booking[] = raw ? JSON.parse(raw) : [];
  const idx = list.findIndex((b) => b.id === booking.id);
  if (idx >= 0) {
    list[idx] = booking;
    localStorage.setItem(`${facilityCode}_bk`, JSON.stringify(list));
  }

  if (!sb) return true;

  const row = bookingToRow(booking, facilityCode);
  const { error } = await sb
    .from(TABLE)
    .update(row)
    .eq('id', booking.id);

  if (error) {
    console.error('[예약 수정 오류]', error.message);
    return false;
  }

  return true;
}

// ── 예약 삭제 ──
export async function deleteBooking(
  bookingId: number,
  facilityCode: string
): Promise<boolean> {
  // localStorage 삭제
  const raw = localStorage.getItem(`${facilityCode}_bk`);
  const list: Booking[] = raw ? JSON.parse(raw) : [];
  const filtered = list.filter((b) => b.id !== bookingId);
  localStorage.setItem(`${facilityCode}_bk`, JSON.stringify(filtered));

  const sb = getSupabase();
  if (!sb) return true;

  const { error } = await sb
    .from(TABLE)
    .delete()
    .eq('id', bookingId);

  if (error) {
    console.error('[예약 삭제 오류]', error.message);
    return false;
  }

  return true;
}

// ── 실시간 구독 ──
export function subscribeToBookings(
  facilityCode: string,
  onUpdate: (bookings: Booking[]) => void
): (() => void) | null {
  const sb = getSupabase();
  if (!sb) return null;

  const channel = sb
    .channel('rt-bk')
    .on(
      'postgres_changes',
      {
        event: '*',
        schema: 'public',
        table: TABLE,
        filter: `facility_code=eq.${facilityCode}`,
      },
      async () => {
        // 변경 발생 시 전체 재조회
        const bookings = await fetchBookings(facilityCode);
        onUpdate(bookings);
      }
    )
    .subscribe();

  return () => {
    sb.removeChannel(channel);
  };
}
