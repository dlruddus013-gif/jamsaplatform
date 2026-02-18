// ============================================================================
// 잠사박물관 통합 운영 플랫폼 — 메인 앱 엔트리
// ============================================================================
'use client';

import { useEffect } from 'react';
import { useAppStore } from '@/stores/useAppStore';
import { ToastProvider } from '@/components/common/Toast';
import FacilitySelect from '@/components/common/FacilitySelect';
import LoginScreen from '@/components/common/LoginScreen';
import TopNav from '@/components/common/TopNav';
import Dashboard from '@/components/dashboard/Dashboard';
import BookingForm from '@/components/reservation/BookingForm';
import BookingList from '@/components/reservation/BookingList';
import BookingDetail from '@/components/reservation/BookingDetail';
import MonthCalendar from '@/components/calendar/MonthCalendar';
import ScheduleTable from '@/components/calendar/ScheduleTable';
import AgencyBookings from '@/components/agency/AgencyBookings';
import ChatPanel from '@/components/chat/ChatPanel';
import SettingsPanel from '@/components/settings/SettingsPanel';
import type { Facility, Booking } from '@/types';
import { useState } from 'react';

export default function Home() {
  const {
    mode,
    currentPage,
    currentFacility,
    setCurrentFacility,
    setCurrentPage,
    loadFacilityData,
    setMode,
    setUserPhone,
  } = useAppStore();

  const [detailBooking, setDetailBooking] = useState<Booking | null>(null);

  // 시설 선택 핸들러
  const handleFacilitySelect = (facility: Facility, entryMode: string) => {
    setCurrentFacility(facility);
    loadFacilityData(facility.code);
    if (entryMode === 'booking') {
      setCurrentPage('login-booking');
    } else if (entryMode === 'check') {
      setCurrentPage('login-check');
    } else if (entryMode === 'admin') {
      setCurrentPage('login-admin');
    } else if (entryMode === 'agency') {
      setCurrentPage('login-agency');
    } else {
      setCurrentPage('login');
    }
  };

  // 예약 추가 핸들러
  const handleBookingSubmit = (booking: Omit<Booking, 'id'>) => {
    const { bookings, addBooking } = useAppStore.getState();
    const id = bookings.length > 0 ? Math.max(...bookings.map((b) => b.id)) + 1 : 1;
    addBooking({ ...booking, id });
    // localStorage 저장
    const fp = currentFacility?.code ? `${currentFacility.code}_` : 'jp_';
    try {
      const updated = useAppStore.getState().bookings;
      localStorage.setItem(`${fp}bk`, JSON.stringify(updated));
    } catch { /* ignore */ }
  };

  // 시설 미선택 시 시설 선택 화면
  if (!currentFacility || currentPage === 'facility') {
    return (
      <ToastProvider>
        <FacilitySelect onSelect={handleFacilitySelect} />
      </ToastProvider>
    );
  }

  // 로그인 화면
  if (!mode || currentPage.startsWith('login')) {
    const loginMode = currentPage.includes('booking')
      ? 'booking'
      : currentPage.includes('check')
        ? 'check'
        : currentPage.includes('admin')
          ? 'admin'
          : currentPage.includes('agency')
            ? 'agency'
            : 'main';
    return (
      <ToastProvider>
        <LoginScreen initialMode={loginMode} />
      </ToastProvider>
    );
  }

  // 메인 앱
  return (
    <ToastProvider>
      <div className="min-h-screen bg-museum-bg">
        <TopNav />

        <main className="p-5 max-w-[1600px] mx-auto">
          {/* 관리자 페이지들 */}
          {mode === 'admin' && currentPage === 'dashboard' && <Dashboard />}

          {mode === 'admin' && currentPage === 'calendar' && (
            <MonthCalendar />
          )}

          {mode === 'admin' && currentPage === 'bookings' && (
            <>
              <BookingList onDetail={setDetailBooking} />
              {detailBooking && (
                <BookingDetail
                  booking={detailBooking}
                  isOpen={!!detailBooking}
                  onClose={() => setDetailBooking(null)}
                />
              )}
            </>
          )}

          {mode === 'admin' && currentPage === 'schedule' && (
            <ScheduleTable />
          )}

          {mode === 'admin' && currentPage === 'agency' && (
            <AgencyBookings />
          )}

          {mode === 'admin' && currentPage === 'chat' && <ChatPanel />}

          {mode === 'admin' && currentPage === 'settings' && (
            <SettingsPanel />
          )}

          {/* 고객 페이지들 */}
          {mode === 'customer' && currentPage === 'customer-booking' && (
            <BookingForm onSubmit={handleBookingSubmit} />
          )}

          {mode === 'customer' && currentPage === 'customer-check' && (
            <BookingList />
          )}

          {/* 대행사 페이지들 */}
          {mode === 'agency' && currentPage === 'agency-booking' && (
            <BookingForm
              onSubmit={handleBookingSubmit}
              isAgency
            />
          )}

          {mode === 'agency' && currentPage === 'agency-list' && (
            <AgencyBookings />
          )}
        </main>
      </div>
    </ToastProvider>
  );
}
