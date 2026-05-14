// ============================================================================
// 시설 선택 화면
// ============================================================================
'use client';

import { useState, useEffect } from 'react';
import { useAppStore } from '@/stores/useAppStore';
import type { Facility } from '@/types';

interface FacilitySelectProps {
  onSelect: (facility: Facility, mode: string) => void;
}

export default function FacilitySelect({ onSelect }: FacilitySelectProps) {
  const { facilities, setFacilities } = useAppStore();
  const [newName, setNewName] = useState('');
  const [mounted, setMounted] = useState(false);

  useEffect(() => {
    try {
      const stored = JSON.parse(
        localStorage.getItem('__fac_list') || '[]'
      ) as Facility[];
      if (stored.length === 0) {
        const defaults: Facility[] = [
          { code: 'jp', name: '잠사박물관 플레이팜' },
        ];
        localStorage.setItem('__fac_list', JSON.stringify(defaults));
        setFacilities(defaults);
      } else {
        setFacilities(stored);
      }
    } catch {
      const defaults: Facility[] = [
        { code: 'jp', name: '잠사박물관 플레이팜' },
      ];
      setFacilities(defaults);
    }
    setMounted(true);
  }, [setFacilities]);

  const addFacility = () => {
    const name = newName.trim();
    if (!name) return;
    const updated = [
      ...facilities,
      { code: `f${Date.now()}`, name },
    ];
    localStorage.setItem('__fac_list', JSON.stringify(updated));
    setFacilities(updated);
    setNewName('');
  };

  return (
    <div className="flex justify-center items-center min-h-screen bg-gradient-to-br from-museum-primary to-museum-secondary p-5">
      <div className="bg-white rounded-[20px] p-8 max-w-[420px] w-full shadow-2xl">
        <div className="text-center mb-6">
          <div className="text-[40px] mb-2">🏕️</div>
          <h1 className="text-xl font-extrabold text-museum-primary mb-1">
            단체예약 관리 시스템
          </h1>
          <p className="text-xs text-gray-400">시설을 선택하세요</p>
        </div>

        <div className="flex flex-col gap-2 mb-4 max-h-[400px] overflow-y-auto">
          {facilities.length === 0 ? (
            <div className="text-center py-5 text-gray-400 text-xs">
              등록된 시설이 없습니다.
              <br />
              아래에서 시설을 추가하세요.
            </div>
          ) : (
            facilities.map((f, i) => (
              <div
                key={f.code}
                className="bg-gray-50 border-2 border-gray-200 rounded-[14px] p-3.5"
              >
                <div className="text-[15px] font-extrabold text-museum-primary mb-2.5">
                  🏕️ {f.name}
                </div>
                <div className="flex gap-1.5 flex-wrap">
                  <button
                    onClick={() => onSelect(f, 'booking')}
                    className="flex-1 py-2.5 px-2 bg-gradient-to-br from-museum-primary to-museum-secondary text-white border-none rounded-lg cursor-pointer text-[11px] font-bold hover:shadow-lg transition-shadow"
                  >
                    📝 예약신청
                  </button>
                  <button
                    onClick={() => onSelect(f, 'check')}
                    className="flex-1 py-2.5 px-2 bg-gradient-to-br from-blue-700 to-blue-400 text-white border-none rounded-lg cursor-pointer text-[11px] font-bold hover:shadow-lg transition-shadow"
                  >
                    🔍 예약조회
                  </button>
                  <button
                    onClick={() => onSelect(f, 'agency')}
                    className="flex-1 py-2.5 px-2 bg-gradient-to-br from-purple-800 to-purple-500 text-white border-none rounded-lg cursor-pointer text-[11px] font-bold hover:shadow-lg transition-shadow"
                  >
                    🏢 대행사
                  </button>
                  <button
                    onClick={() => onSelect(f, 'admin')}
                    className="flex-1 py-2.5 px-2 bg-gradient-to-br from-orange-700 to-orange-500 text-white border-none rounded-lg cursor-pointer text-[11px] font-bold hover:shadow-lg transition-shadow"
                  >
                    🔐 관리자
                  </button>
                </div>
              </div>
            ))
          )}
        </div>

        {/* 부가기능 */}
        <div className="mt-5 pt-4 border-t-2 border-gray-100">
          <div className="text-xs font-bold text-gray-500 mb-3 text-center">🎯 부가기능</div>
          <div className="grid grid-cols-3 gap-2">
            <a href="/review-crew.html" className="flex flex-col items-center gap-1 py-3 px-1 bg-green-50 rounded-xl text-center no-underline hover:bg-green-100 transition-colors border border-green-200">
              <span className="text-[22px]">🎯</span>
              <span className="text-[10px] font-bold text-green-800 leading-tight">리뷰체험단</span>
            </a>
            <a href="/restaurant.html" className="flex flex-col items-center gap-1 py-3 px-1 bg-amber-50 rounded-xl text-center no-underline hover:bg-amber-100 transition-colors border border-amber-200">
              <span className="text-[22px]">🍽️</span>
              <span className="text-[10px] font-bold text-amber-800 leading-tight">식당메뉴</span>
            </a>
            <a href="/event.html" className="flex flex-col items-center gap-1 py-3 px-1 bg-pink-50 rounded-xl text-center no-underline hover:bg-pink-100 transition-colors border border-pink-200">
              <span className="text-[22px]">🎉</span>
              <span className="text-[10px] font-bold text-pink-800 leading-tight">이벤트응모</span>
            </a>
            <a href="/ar-game.html" className="flex flex-col items-center gap-1 py-3 px-1 bg-purple-50 rounded-xl text-center no-underline hover:bg-purple-100 transition-colors border border-purple-200">
              <span className="text-[22px]">🎮</span>
              <span className="text-[10px] font-bold text-purple-800 leading-tight">AR 증강게임</span>
            </a>
            <a href="/find-me.html" className="flex flex-col items-center gap-1 py-3 px-1 bg-blue-50 rounded-xl text-center no-underline hover:bg-blue-100 transition-colors border border-blue-200">
              <span className="text-[22px]">📍</span>
              <span className="text-[10px] font-bold text-blue-800 leading-tight">내위치찾기</span>
            </a>
            <a href="/reservation.html" className="flex flex-col items-center gap-1 py-3 px-1 bg-gray-50 rounded-xl text-center no-underline hover:bg-gray-100 transition-colors border border-gray-200">
              <span className="text-[22px]">📋</span>
              <span className="text-[10px] font-bold text-gray-700 leading-tight">예약시스템</span>
            </a>
          </div>
        </div>

        {/* 시설 추가 */}
        <div className="flex gap-2 mt-4">
          <input
            type="text"
            value={newName}
            onChange={(e) => setNewName(e.target.value)}
            placeholder="새 시설명 입력"
            className="flex-1 border-2 border-museum-border rounded-lg px-3 py-2 text-sm outline-none focus:border-museum-tertiary"
            onKeyDown={(e) => e.key === 'Enter' && addFacility()}
          />
          <button
            onClick={addFacility}
            className="px-4 py-2 bg-museum-primary text-white border-none rounded-lg text-xs font-bold cursor-pointer hover:bg-museum-secondary transition-colors"
          >
            + 추가
          </button>
        </div>
      </div>
    </div>
  );
}
