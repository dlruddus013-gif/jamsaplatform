// ============================================================================
// 상단 내비게이션 바
// ============================================================================
'use client';

import { useState } from 'react';
import { useAppStore } from '@/stores/useAppStore';

interface NavGroup {
  label: string;
  icon: string;
  items: { label: string; icon: string; page: string }[];
}

const adminNavGroups: NavGroup[] = [
  {
    label: '예약관리',
    icon: '📋',
    items: [
      { label: '통계 대시보드', icon: '📊', page: 'dashboard' },
      { label: '달력', icon: '📅', page: 'calendar' },
      { label: '전체 예약', icon: '📋', page: 'bookings' },
      { label: '일정표', icon: '🕐', page: 'schedule' },
    ],
  },
  {
    label: '운영',
    icon: '⚙️',
    items: [
      { label: '대행사 관리', icon: '🏢', page: 'agency' },
      { label: '상담 채팅', icon: '💬', page: 'chat' },
      { label: '설정', icon: '⚙️', page: 'settings' },
    ],
  },
];

export default function TopNav() {
  const { currentFacility, mode, currentAdmin, currentAgency, logout, setCurrentPage } =
    useAppStore();
  const [openGroup, setOpenGroup] = useState<string | null>(null);

  const handleNavClick = (page: string) => {
    setCurrentPage(page);
    setOpenGroup(null);
  };

  if (!mode) return null;

  return (
    <nav className="bg-gradient-to-r from-museum-primary via-museum-secondary to-museum-tertiary px-5 flex items-center h-14 shadow-md sticky top-0 z-[100]">
      {/* 로고 */}
      <div className="text-[15px] font-black text-white whitespace-nowrap">
        {currentFacility?.name || '잠사박물관'}
        <span
          className={`text-[9px] font-extrabold px-2 py-0.5 rounded-full ml-1.5 align-middle ${
            mode === 'admin'
              ? 'bg-red-400 text-white'
              : mode === 'agency'
                ? 'bg-purple-500 text-white'
                : 'bg-[#FEE500] text-gray-800'
          }`}
        >
          {mode === 'admin'
            ? `관리자 (${currentAdmin?.name || ''})`
            : mode === 'agency'
              ? `대행사 (${currentAgency?.name || ''})`
              : '고객'}
        </span>
      </div>

      {/* 네비게이션 */}
      <div className="flex gap-0.5 ml-auto items-center relative">
        {mode === 'admin' &&
          adminNavGroups.map((group) => (
            <div
              key={group.label}
              className="relative"
              onMouseEnter={() => setOpenGroup(group.label)}
              onMouseLeave={() => setOpenGroup(null)}
            >
              <button className="bg-transparent border-none text-white/75 text-xs font-bold px-3 py-1.5 cursor-pointer rounded-lg transition-all hover:bg-white/20 hover:text-white flex items-center gap-1">
                {group.icon} {group.label}
                <span className="text-[8px] opacity-60">▼</span>
              </button>
              {openGroup === group.label && (
                <div className="absolute top-full left-1/2 -translate-x-1/2 min-w-[150px] bg-white rounded-xl shadow-xl p-1.5 z-[200] mt-1.5">
                  <div className="absolute -top-1.5 left-1/2 -translate-x-1/2 border-[6px] border-transparent border-b-white" />
                  {group.items.map((item) => (
                    <button
                      key={item.page}
                      onClick={() => handleNavClick(item.page)}
                      className="flex items-center gap-2 w-full bg-transparent border-none px-3 py-2 text-xs font-semibold text-gray-700 cursor-pointer rounded-lg transition-colors hover:bg-green-50 text-left whitespace-nowrap"
                    >
                      <span className="text-sm w-5 text-center">
                        {item.icon}
                      </span>
                      {item.label}
                    </button>
                  ))}
                </div>
              )}
            </div>
          ))}

        {mode === 'agency' && (
          <>
            <button
              onClick={() => handleNavClick('agency-booking')}
              className="bg-transparent border-none text-white/75 text-xs font-bold px-3 py-1.5 cursor-pointer rounded-lg hover:bg-white/20 hover:text-white"
            >
              📝 예약신청
            </button>
            <button
              onClick={() => handleNavClick('agency-list')}
              className="bg-transparent border-none text-white/75 text-xs font-bold px-3 py-1.5 cursor-pointer rounded-lg hover:bg-white/20 hover:text-white"
            >
              📋 내 예약
            </button>
            <button
              onClick={() => handleNavClick('agency-settle')}
              className="bg-transparent border-none text-white/75 text-xs font-bold px-3 py-1.5 cursor-pointer rounded-lg hover:bg-white/20 hover:text-white"
            >
              💰 정산
            </button>
          </>
        )}

        {/* 로그아웃 */}
        <button
          onClick={logout}
          className="bg-white/10 border border-white/20 text-white text-[11px] font-semibold px-3 py-1 rounded-lg cursor-pointer ml-2.5 hover:bg-white/20"
        >
          로그아웃
        </button>
      </div>
    </nav>
  );
}
