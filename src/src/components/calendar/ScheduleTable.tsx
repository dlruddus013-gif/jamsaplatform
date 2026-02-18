// ============================================================================
// 일정표 (타임슬롯 × 활동) 컴포넌트
// ============================================================================
'use client';

import { useMemo } from 'react';
import { useAppStore } from '@/stores/useAppStore';
import Card from '@/components/common/Card';
import { generateTimeSlots, ACTIVITY_COLORS } from '@/types';
import { today } from '@/utils/format';
import type { Booking } from '@/types';

export default function ScheduleTable() {
  const { bookings, activities, selectedDate, setSelectedDate } =
    useAppStore();
  const timeSlots = useMemo(() => generateTimeSlots(), []);

  const currentDate = selectedDate || today();

  // 해당일 예약
  const dayBookings = useMemo(
    () =>
      bookings.filter(
        (b) => b.date === currentDate && b.status !== '취소'
      ),
    [bookings, currentDate]
  );

  // 타임슬롯별 활동 배치
  const grid = useMemo(() => {
    const matrix: (Booking[] | null)[][] = timeSlots.map(() =>
      activities.map(() => null)
    );

    // 간단 배치: 도착~출발 시간에 첫 번째 빈 활동 칸에 배치
    dayBookings.forEach((bk) => {
      const [ah, am] = bk.arrival.split(':').map(Number);
      const [dh, dm] = bk.departure.split(':').map(Number);
      const startIdx = Math.max(0, (ah - 10) * 2 + (am >= 30 ? 1 : 0));
      const endIdx = Math.min(
        timeSlots.length,
        (dh - 10) * 2 + (dm >= 30 ? 1 : 0)
      );

      // 활동 인덱스 순서대로 배치 시도
      for (let ci = 0; ci < activities.length; ci++) {
        let canPlace = true;
        for (let si = startIdx; si < endIdx; si++) {
          if (matrix[si][ci] !== null) {
            canPlace = false;
            break;
          }
        }
        if (canPlace) {
          for (let si = startIdx; si < endIdx; si++) {
            if (!matrix[si][ci]) matrix[si][ci] = [];
            matrix[si][ci]!.push(bk);
          }
          break;
        }
      }
    });

    return matrix;
  }, [dayBookings, timeSlots, activities]);

  // 날짜 이동
  const navigateDay = (delta: number) => {
    const d = new Date(currentDate);
    d.setDate(d.getDate() + delta);
    setSelectedDate(d.toISOString().split('T')[0]);
  };

  const totalPeople = dayBookings.reduce(
    (s, b) => s + b.students + b.teachers,
    0
  );

  return (
    <Card>
      {/* 헤더 */}
      <div className="bg-gradient-to-br from-museum-primary to-museum-secondary px-5 py-4 text-white flex justify-between items-center -m-5 mb-4">
        <div>
          <h2 className="text-lg font-extrabold">
            📅 {currentDate} 일정표
          </h2>
          <p className="text-xs opacity-80 mt-0.5">
            {dayBookings.length}팀 / {totalPeople}명
          </p>
        </div>
        <div className="flex gap-1.5">
          <button
            onClick={() => navigateDay(-1)}
            className="bg-white/15 border-none text-white w-8 h-8 rounded-lg text-[15px] cursor-pointer hover:bg-white/30"
          >
            ◀
          </button>
          <button
            onClick={() => setSelectedDate(today())}
            className="bg-white/15 border-none text-white px-3 h-8 rounded-lg text-xs font-bold cursor-pointer hover:bg-white/30"
          >
            오늘
          </button>
          <button
            onClick={() => navigateDay(1)}
            className="bg-white/15 border-none text-white w-8 h-8 rounded-lg text-[15px] cursor-pointer hover:bg-white/30"
          >
            ▶
          </button>
        </div>
      </div>

      {dayBookings.length === 0 ? (
        <div className="text-center py-12 text-gray-400">
          <div className="text-4xl mb-3">📅</div>
          <p className="text-sm">이 날짜에 예약이 없습니다.</p>
        </div>
      ) : (
        <div className="overflow-x-auto">
          <table className="w-full border-collapse text-[11px]">
            <thead>
              <tr>
                <th className="bg-gray-100 sticky left-0 z-[2] min-w-[110px] px-3 py-3 font-extrabold border-b-[3px] border-gray-300 text-center text-sm">
                  시간
                </th>
                {activities.map((act, ci) => {
                  const color = ACTIVITY_COLORS[ci % ACTIVITY_COLORS.length];
                  return (
                    <th
                      key={act}
                      className="px-3 py-3 font-extrabold border-b-[3px] border-gray-300 text-center text-sm min-w-[120px]"
                      style={{ backgroundColor: color.b, color: color.t }}
                    >
                      {act}
                    </th>
                  );
                })}
              </tr>
            </thead>
            <tbody>
              {timeSlots.map((slot, si) => (
                <tr key={slot.l}>
                  <td className="font-bold text-gray-700 border-r-2 border-gray-200 sticky left-0 z-[1] bg-white px-3 py-2.5 text-center text-[13px]">
                    {slot.l}
                  </td>
                  {activities.map((act, ci) => {
                    const bks = grid[si][ci];
                    const color =
                      ACTIVITY_COLORS[ci % ACTIVITY_COLORS.length];
                    return (
                      <td
                        key={act}
                        className="px-3 py-2.5 text-center border-l border-gray-200 font-semibold text-[13px] cursor-pointer transition-colors hover:opacity-80"
                        style={
                          bks
                            ? { backgroundColor: color.b, color: color.t }
                            : {}
                        }
                      >
                        {bks &&
                          [...new Set(bks.map((b) => b.name))].map(
                            (name) => (
                              <div key={name} className="text-xs font-bold">
                                {name}
                              </div>
                            )
                          )}
                      </td>
                    );
                  })}
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </Card>
  );
}
