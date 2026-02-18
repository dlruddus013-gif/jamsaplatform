// ============================================================================
// 월간 달력 컴포넌트
// ============================================================================
'use client';

import { useMemo } from 'react';
import { useAppStore } from '@/stores/useAppStore';
import Card from '@/components/common/Card';
import { today } from '@/utils/format';

export default function MonthCalendar() {
  const { bookings, calendarYear, calendarMonth, setCalendar, setSelectedDate, setCurrentPage } =
    useAppStore();

  const todayStr = today();

  const { days, firstDow } = useMemo(() => {
    const y = calendarYear;
    const m = calendarMonth;
    const daysInMonth = new Date(y, m + 1, 0).getDate();
    const firstDay = new Date(y, m, 1).getDay();
    const daysInPrevMonth = new Date(y, m, 0).getDate();

    const cells: Array<{ date: string; day: number; isOther: boolean }> = [];

    // 이전 월
    for (let i = firstDay - 1; i >= 0; i--) {
      const d = daysInPrevMonth - i;
      const pm = m === 0 ? 11 : m - 1;
      const py = m === 0 ? y - 1 : y;
      cells.push({
        date: `${py}-${String(pm + 1).padStart(2, '0')}-${String(d).padStart(2, '0')}`,
        day: d,
        isOther: true,
      });
    }

    // 현재 월
    for (let d = 1; d <= daysInMonth; d++) {
      cells.push({
        date: `${y}-${String(m + 1).padStart(2, '0')}-${String(d).padStart(2, '0')}`,
        day: d,
        isOther: false,
      });
    }

    // 다음 월
    const remaining = 42 - cells.length;
    for (let d = 1; d <= remaining; d++) {
      const nm = m === 11 ? 0 : m + 1;
      const ny = m === 11 ? y + 1 : y;
      cells.push({
        date: `${ny}-${String(nm + 1).padStart(2, '0')}-${String(d).padStart(2, '0')}`,
        day: d,
        isOther: true,
      });
    }

    return { days: cells, firstDow: firstDay };
  }, [calendarYear, calendarMonth]);

  // 날짜별 예약 집계
  const dayStats = useMemo(() => {
    const map: Record<string, { teams: number; people: number }> = {};
    bookings
      .filter((b) => b.status !== '취소')
      .forEach((b) => {
        if (!map[b.date]) map[b.date] = { teams: 0, people: 0 };
        map[b.date].teams++;
        map[b.date].people += b.students + b.teachers;
      });
    return map;
  }, [bookings]);

  const navigate = (delta: number) => {
    let m = calendarMonth + delta;
    let y = calendarYear;
    if (m > 11) {
      m = 0;
      y++;
    }
    if (m < 0) {
      m = 11;
      y--;
    }
    setCalendar(y, m);
  };

  const handleDayClick = (dateStr: string) => {
    setSelectedDate(dateStr);
    setCurrentPage('schedule');
  };

  const dayHeaders = ['일', '월', '화', '수', '목', '금', '토'];

  return (
    <Card>
      {/* 달력 헤더 */}
      <div className="bg-gradient-to-br from-museum-primary to-museum-secondary px-5 py-4 text-white flex justify-between items-center -m-5 mb-4">
        <h2 className="text-lg font-extrabold">
          {calendarYear}년 {calendarMonth + 1}월
        </h2>
        <div className="flex gap-1.5">
          <button
            onClick={() => navigate(-1)}
            className="bg-white/15 border-none text-white w-8 h-8 rounded-lg text-[15px] cursor-pointer hover:bg-white/30"
          >
            ◀
          </button>
          <button
            onClick={() => {
              const now = new Date();
              setCalendar(now.getFullYear(), now.getMonth());
            }}
            className="bg-white/15 border-none text-white px-3 h-8 rounded-lg text-xs font-bold cursor-pointer hover:bg-white/30"
          >
            오늘
          </button>
          <button
            onClick={() => navigate(1)}
            className="bg-white/15 border-none text-white w-8 h-8 rounded-lg text-[15px] cursor-pointer hover:bg-white/30"
          >
            ▶
          </button>
        </div>
      </div>

      {/* 요일 헤더 */}
      <div className="grid grid-cols-7">
        {dayHeaders.map((d, i) => (
          <div
            key={d}
            className={`px-2 py-2 text-center text-[11px] font-bold bg-[#fafaf8] border-b border-museum-border ${
              i === 0
                ? 'text-red-500'
                : i === 6
                  ? 'text-blue-500'
                  : 'text-gray-400'
            }`}
          >
            {d}
          </div>
        ))}
      </div>

      {/* 날짜 셀 */}
      <div className="grid grid-cols-7">
        {days.map((cell, idx) => {
          const stats = dayStats[cell.date];
          const isToday = cell.date === todayStr;
          const colIdx = idx % 7;

          return (
            <div
              key={cell.date}
              onClick={() => !cell.isOther && handleDayClick(cell.date)}
              className={`min-h-[90px] p-1.5 border-b border-r border-[#f0ede6] cursor-pointer transition-colors hover:bg-[#f5f3ee] ${
                isToday ? 'bg-yellow-50' : ''
              } ${cell.isOther ? 'opacity-20' : ''}`}
            >
              <div
                className={`text-[11px] font-bold mb-0.5 ${
                  colIdx === 0
                    ? 'text-red-500'
                    : colIdx === 6
                      ? 'text-blue-500'
                      : 'text-gray-500'
                }`}
              >
                {cell.day}
              </div>
              {stats && !cell.isOther && (
                <div className="flex gap-1 flex-wrap">
                  <span className="text-xs font-black px-1.5 py-0.5 rounded bg-museum-primary text-white">
                    {stats.teams}
                  </span>
                  <span className="text-xs font-black px-1.5 py-0.5 rounded bg-blue-500 text-white">
                    {stats.people}
                  </span>
                </div>
              )}
            </div>
          );
        })}
      </div>
    </Card>
  );
}
