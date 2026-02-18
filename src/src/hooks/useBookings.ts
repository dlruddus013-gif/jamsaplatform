// ============================================================================
// 예약 관련 커스텀 훅
// ============================================================================
'use client';

import { useEffect, useCallback } from 'react';
import { useAppStore } from '@/stores/useAppStore';
import {
  fetchBookings,
  saveBookings,
  subscribeToBookings,
} from '@/api/reservation';
import type { Booking } from '@/types';
import { today } from '@/utils/format';

export function useBookings() {
  const {
    bookings,
    currentFacility,
    formConfig,
    setBookings,
    addBooking: storeAdd,
    updateBooking: storeUpdate,
    removeBooking: storeRemove,
    pushUndo,
    addActivityLog,
    currentAdmin,
    mode,
  } = useAppStore();

  const facilityCode = currentFacility?.code || 'jp';

  // 로그 기록 헬퍼
  const log = useCallback(
    (action: string, desc: string, snapshot?: string | null) => {
      const who =
        mode === 'admin' && currentAdmin
          ? currentAdmin.name
          : mode === 'agency'
            ? '대행사'
            : '고객';
      addActivityLog({
        action,
        desc,
        time: new Date().toLocaleString('ko-KR'),
        user: who,
        snap: snapshot || null,
        reason: null,
      });
    },
    [addActivityLog, currentAdmin, mode]
  );

  // 초기 로드
  useEffect(() => {
    if (!facilityCode) return;
    fetchBookings(facilityCode).then(setBookings);
  }, [facilityCode, setBookings]);

  // 실시간 구독
  useEffect(() => {
    if (!facilityCode) return;
    const unsub = subscribeToBookings(facilityCode, setBookings);
    return () => {
      unsub?.();
    };
  }, [facilityCode, setBookings]);

  // 예약 저장 (디바운스)
  const save = useCallback(
    (bks: Booking[]) => {
      saveBookings(bks, facilityCode);
    },
    [facilityCode]
  );

  // 예약 추가
  const add = useCallback(
    (booking: Omit<Booking, 'id'>) => {
      pushUndo('입력', `${booking.name} 예약 추가`);
      const id =
        bookings.length > 0
          ? Math.max(...bookings.map((b) => b.id)) + 1
          : 1;
      const newBk: Booking = { ...booking, id };
      storeAdd(newBk);
      save([...bookings, newBk]);
      log('입력', `${booking.name} 예약 추가`);
      return newBk;
    },
    [bookings, storeAdd, save, pushUndo, log]
  );

  // 예약 수정
  const update = useCallback(
    (id: number, updates: Partial<Booking>) => {
      const bk = bookings.find((b) => b.id === id);
      if (!bk) return;
      pushUndo('수정', `${bk.name} 수정`);
      storeUpdate(id, updates);
      const updated = bookings.map((b) =>
        b.id === id ? { ...b, ...updates } : b
      );
      save(updated);
      log('수정', `${bk.name} 수정`);
    },
    [bookings, storeUpdate, save, pushUndo, log]
  );

  // 상태 변경
  const setStatus = useCallback(
    (id: number, status: string) => {
      const bk = bookings.find((b) => b.id === id);
      if (!bk) return;
      pushUndo('상태변경', `${bk.name}: ${bk.status} → ${status}`);
      storeUpdate(id, { status });
      const updated = bookings.map((b) =>
        b.id === id ? { ...b, status } : b
      );
      save(updated);
      log('상태변경', `${bk.name}: ${bk.status} → ${status}`);
    },
    [bookings, storeUpdate, save, pushUndo, log]
  );

  // 예약 삭제
  const remove = useCallback(
    (id: number) => {
      const bk = bookings.find((b) => b.id === id);
      if (!bk) return;
      pushUndo('삭제', `${bk.name} 삭제`);
      storeRemove(id);
      save(bookings.filter((b) => b.id !== id));
      log('삭제', `${bk.name} 삭제`, JSON.stringify(bookings));
    },
    [bookings, storeRemove, save, pushUndo, log]
  );

  // 필터링 헬퍼
  const todayBookings = bookings.filter(
    (b) => b.date === today() && b.status !== '취소'
  );
  const pendingBookings = bookings.filter((b) => b.status === '대기');
  const confirmedBookings = bookings.filter((b) => b.status === '확정');
  const monthBookings = bookings.filter(
    (b) =>
      b.date.startsWith(today().substring(0, 7)) && b.status !== '취소'
  );

  return {
    bookings,
    todayBookings,
    pendingBookings,
    confirmedBookings,
    monthBookings,
    formConfig,
    add,
    update,
    setStatus,
    remove,
    save,
  };
}
