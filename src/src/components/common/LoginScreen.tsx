// ============================================================================
// 로그인 화면
// ============================================================================
'use client';

import { useState } from 'react';
import { useAppStore } from '@/stores/useAppStore';
import { useToast } from './Toast';

interface LoginScreenProps {
  initialMode?: string;
}

export default function LoginScreen({ initialMode }: LoginScreenProps) {
  const {
    currentFacility,
    adminAccounts,
    agencies,
    setMode,
    setCurrentAdmin,
    setCurrentAgency,
    setUserPhone,
    setCurrentPage,
  } = useAppStore();
  const { toast } = useToast();

  const [view, setView] = useState<string>(initialMode || 'main');
  const [phone, setPhone] = useState('');
  const [adminId, setAdminId] = useState('');
  const [adminPw, setAdminPw] = useState('');
  const [agencyCode, setAgencyCode] = useState('');
  const [agencyPw, setAgencyPw] = useState('');

  const handleBooking = () => {
    if (!phone.trim()) {
      toast('연락처를 입력하세요', 'error');
      return;
    }
    setMode('customer');
    setUserPhone(phone);
    setCurrentPage('customer-booking');
  };

  const handleCheck = () => {
    if (!phone.trim()) {
      toast('연락처를 입력하세요', 'error');
      return;
    }
    setMode('customer');
    setUserPhone(phone);
    setCurrentPage('customer-check');
  };

  const handleAdminLogin = () => {
    const account = adminAccounts.find(
      (a) => a.id === adminId && a.pw === adminPw
    );
    if (!account) {
      toast('관리자 계정을 확인하세요', 'error');
      return;
    }
    setMode('admin');
    setCurrentAdmin(account);
    setCurrentPage('dashboard');
    toast(`${account.name}님 환영합니다`, 'success');
  };

  const handleAgencyLogin = () => {
    const agency = agencies.find(
      (a) => a.code === agencyCode && a.active
    );
    if (!agency) {
      toast('대행사 코드를 확인하세요', 'error');
      return;
    }
    setMode('agency');
    setCurrentAgency(agency);
    setCurrentPage('agency-booking');
    toast(`${agency.name} 환영합니다`, 'success');
  };

  return (
    <div className="flex justify-center items-center min-h-screen bg-gradient-to-br from-[#0d2818] via-museum-primary to-museum-tertiary">
      <div className="bg-white rounded-3xl p-11 w-[440px] max-w-[95vw] shadow-2xl text-center">
        <h1 className="text-[22px] font-black text-museum-primary mb-1">
          {currentFacility?.name || '잠사박물관'}
        </h1>
        <p className="text-xs text-gray-400 mb-6">
          단체예약 관리 시스템 v2.10
        </p>

        {/* 메인 진입 */}
        {view === 'main' && (
          <div className="flex flex-col gap-3">
            <div className="flex gap-3">
              <button
                onClick={() => setView('booking')}
                className="flex-1 py-7 px-3.5 border-none rounded-2xl text-white cursor-pointer transition-all bg-gradient-to-br from-museum-primary to-museum-tertiary shadow-lg hover:-translate-y-1 hover:shadow-xl text-center"
              >
                <div className="text-2xl mb-1">📝</div>
                <div className="text-sm font-extrabold">단체예약 신청</div>
                <div className="text-[10px] opacity-80 mt-1">
                  새로운 단체예약을 접수합니다
                </div>
              </button>
              <button
                onClick={() => setView('check')}
                className="flex-1 py-7 px-3.5 border-none rounded-2xl text-white cursor-pointer transition-all bg-gradient-to-br from-blue-700 to-blue-400 shadow-lg hover:-translate-y-1 hover:shadow-xl text-center"
              >
                <div className="text-2xl mb-1">🔍</div>
                <div className="text-sm font-extrabold">예약현황 조회</div>
                <div className="text-[10px] opacity-80 mt-1">
                  예약 내역을 확인합니다
                </div>
              </button>
            </div>
            <button
              onClick={() => setView('admin')}
              className="w-full py-3 bg-gradient-to-br from-museum-primary to-museum-secondary text-white border-none rounded-xl text-[15px] font-extrabold cursor-pointer shadow-md hover:-translate-y-0.5 hover:shadow-lg transition-all"
            >
              🔐 관리자 로그인
            </button>
            <button
              onClick={() => setView('agency')}
              className="w-full py-3 bg-gradient-to-br from-purple-800 to-purple-500 text-white border-none rounded-xl text-[15px] font-extrabold cursor-pointer shadow-md hover:-translate-y-0.5 hover:shadow-lg transition-all"
            >
              🏢 대행사 로그인
            </button>
          </div>
        )}

        {/* 예약 신청 */}
        {view === 'booking' && (
          <div>
            <div className="mb-3.5 text-left">
              <label className="text-[11px] font-bold text-gray-500 block mb-1">
                연락처 <span className="text-red-500">*</span>
              </label>
              <input
                type="tel"
                value={phone}
                onChange={(e) => setPhone(e.target.value)}
                placeholder="010-0000-0000"
                className="w-full border-2 border-museum-border rounded-lg px-3 py-2.5 text-sm outline-none focus:border-museum-tertiary"
              />
            </div>
            <button
              onClick={handleBooking}
              className="w-full py-3 bg-gradient-to-br from-museum-tertiary to-[#52b788] text-white border-none rounded-xl text-[15px] font-extrabold cursor-pointer shadow-md hover:-translate-y-0.5 transition-all mt-1.5"
            >
              예약 신청하기
            </button>
            <button
              onClick={() => setView('main')}
              className="mt-3 text-xs text-gray-400 bg-transparent border-none cursor-pointer hover:text-gray-600"
            >
              ← 돌아가기
            </button>
          </div>
        )}

        {/* 예약 조회 */}
        {view === 'check' && (
          <div>
            <div className="mb-3.5 text-left">
              <label className="text-[11px] font-bold text-gray-500 block mb-1">
                연락처 <span className="text-red-500">*</span>
              </label>
              <input
                type="tel"
                value={phone}
                onChange={(e) => setPhone(e.target.value)}
                placeholder="010-0000-0000"
                className="w-full border-2 border-museum-border rounded-lg px-3 py-2.5 text-sm outline-none focus:border-museum-tertiary"
              />
            </div>
            <button
              onClick={handleCheck}
              className="w-full py-3 bg-gradient-to-br from-blue-700 to-blue-400 text-white border-none rounded-xl text-[15px] font-extrabold cursor-pointer shadow-md hover:-translate-y-0.5 transition-all mt-1.5"
            >
              예약 조회하기
            </button>
            <button
              onClick={() => setView('main')}
              className="mt-3 text-xs text-gray-400 bg-transparent border-none cursor-pointer hover:text-gray-600"
            >
              ← 돌아가기
            </button>
          </div>
        )}

        {/* 관리자 로그인 */}
        {view === 'admin' && (
          <div>
            <div className="mb-3.5 text-left">
              <label className="text-[11px] font-bold text-gray-500 block mb-1">
                관리자 ID
              </label>
              <input
                type="text"
                value={adminId}
                onChange={(e) => setAdminId(e.target.value)}
                placeholder="관리자 ID"
                className="w-full border-2 border-museum-border rounded-lg px-3 py-2.5 text-sm outline-none focus:border-museum-tertiary"
              />
            </div>
            <div className="mb-3.5 text-left">
              <label className="text-[11px] font-bold text-gray-500 block mb-1">
                비밀번호
              </label>
              <input
                type="password"
                value={adminPw}
                onChange={(e) => setAdminPw(e.target.value)}
                placeholder="비밀번호"
                className="w-full border-2 border-museum-border rounded-lg px-3 py-2.5 text-sm outline-none focus:border-museum-tertiary"
                onKeyDown={(e) => e.key === 'Enter' && handleAdminLogin()}
              />
            </div>
            <button
              onClick={handleAdminLogin}
              className="w-full py-3 bg-gradient-to-br from-museum-primary to-museum-secondary text-white border-none rounded-xl text-[15px] font-extrabold cursor-pointer shadow-md hover:-translate-y-0.5 transition-all mt-1.5"
            >
              관리자 로그인
            </button>
            <button
              onClick={() => setView('main')}
              className="mt-3 text-xs text-gray-400 bg-transparent border-none cursor-pointer hover:text-gray-600"
            >
              ← 돌아가기
            </button>
          </div>
        )}

        {/* 대행사 로그인 */}
        {view === 'agency' && (
          <div>
            <div className="mb-3.5 text-left">
              <label className="text-[11px] font-bold text-gray-500 block mb-1">
                대행사 코드
              </label>
              <input
                type="text"
                value={agencyCode}
                onChange={(e) => setAgencyCode(e.target.value)}
                placeholder="대행사 코드"
                className="w-full border-2 border-museum-border rounded-lg px-3 py-2.5 text-sm outline-none focus:border-museum-tertiary"
              />
            </div>
            <div className="mb-3.5 text-left">
              <label className="text-[11px] font-bold text-gray-500 block mb-1">
                비밀번호
              </label>
              <input
                type="password"
                value={agencyPw}
                onChange={(e) => setAgencyPw(e.target.value)}
                placeholder="비밀번호"
                className="w-full border-2 border-museum-border rounded-lg px-3 py-2.5 text-sm outline-none focus:border-museum-tertiary"
                onKeyDown={(e) => e.key === 'Enter' && handleAgencyLogin()}
              />
            </div>
            <button
              onClick={handleAgencyLogin}
              className="w-full py-3 bg-gradient-to-br from-purple-800 to-purple-500 text-white border-none rounded-xl text-[15px] font-extrabold cursor-pointer shadow-md hover:-translate-y-0.5 transition-all mt-1.5"
            >
              대행사 로그인
            </button>
            <button
              onClick={() => setView('main')}
              className="mt-3 text-xs text-gray-400 bg-transparent border-none cursor-pointer hover:text-gray-600"
            >
              ← 돌아가기
            </button>
          </div>
        )}
      </div>
    </div>
  );
}
