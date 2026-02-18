// ============================================================================
// 주간 개요 컴포넌트
// ============================================================================
'use client';

import { useState, useMemo } from 'react';
import { useAppStore } from '@/stores/useAppStore';
import Card from '@/components/common/Card';
import { StatusBadge } from '@/components/common/Badge';
import { fmtWon, getDayName } from '@/utils/format';
import { getEstimate } from '@/utils/pricing';

export default function WeeklyOverview() {
  const { bookings, formConfig } = useAppStore();
  const [weekOffset, setWeekOffset] = useState(0);

  const weekData = useMemo(() => {
    const now = new Date();
    const dow = now.getDay();
    const diff = (dow + 6) % 7;
    const mon = new Date(now);
    mon.setDate(mon.getDate() - diff + weekOffset * 7);

    const days: Array<{
      date: string;
      dayName: string;
      bookings: typeof bookings;
      totalPeople: number;
      estimate: number;
    }> = [];

    for (let i = 0; i < 7; i++) {
      const d = new Date(mon);
      d.setDate(mon.getDate() + i);
      const dateStr = d.toISOString().split('T')[0];
      const dayBks = bookings.filter(
        (b) => b.date === dateStr && b.status !== '취소'
      );
      days.push({
        date: dateStr,
        dayName: getDayName(dateStr),
        bookings: dayBks,
        totalPeople: dayBks.reduce(
          (s, b) => s + b.students + b.teachers,
          0
        ),
        estimate: dayBks.reduce(
          (s, b) => s + getEstimate(b, formConfig),
          0
        ),
      });
    }

    const weekLabel =
      weekOffset === 0
        ? '이번주'
        : weekOffset === -1
          ? '지난주'
          : weekOffset === 1
            ? '다음주'
            : `${weekOffset > 0 ? '+' : ''}${weekOffset}주`;

    return { days, weekLabel, from: days[0].date, to: days[6].date };
  }, [bookings, formConfig, weekOffset]);

  const todayStr = new Date().toISOString().split('T')[0];

  return (
    <Card
      title={`📅 ${weekData.weekLabel} (${weekData.from} ~ ${weekData.to})`}
      icon=""
      action={
        <div className="flex gap-1">
          <button
            onClick={() => setWeekOffset((w) => w - 1)}
            className="px-2 py-1 bg-gray-100 border-none rounded-md text-xs cursor-pointer hover:bg-gray-200"
          >
            ◀
          </button>
          <button
            onClick={() => setWeekOffset(0)}
            className="px-2 py-1 bg-museum-primary text-white border-none rounded-md text-xs cursor-pointer"
          >
            이번주
          </button>
          <button
            onClick={() => setWeekOffset((w) => w + 1)}
            className="px-2 py-1 bg-gray-100 border-none rounded-md text-xs cursor-pointer hover:bg-gray-200"
          >
            ▶
          </button>
        </div>
      }
    >
      <div className="grid grid-cols-7 gap-2">
        {weekData.days.map((day) => (
          <div
            key={day.date}
            className={`border rounded-xl p-2.5 text-center transition-all ${
              day.date === todayStr
                ? 'border-museum-tertiary bg-green-50 shadow-sm'
                : 'border-museum-border'
            }`}
          >
            <div
              className={`text-[11px] font-bold mb-1 ${
                day.dayName === '일'
                  ? 'text-red-500'
                  : day.dayName === '토'
                    ? 'text-blue-500'
                    : 'text-gray-500'
              }`}
            >
              {day.dayName} {day.date.split('-')[2]}일
            </div>
            {day.bookings.length > 0 ? (
              <>
                <div className="text-lg font-black text-museum-primary">
                  {day.bookings.length}
                </div>
                <div className="text-[10px] text-blue-600 font-bold">
                  {day.totalPeople}명
                </div>
                <div className="mt-1.5 space-y-0.5">
                  {day.bookings.slice(0, 3).map((b) => (
                    <div
                      key={b.id}
                      className="text-[9px] bg-white rounded px-1 py-0.5 truncate border border-gray-100"
                      title={`${b.name} ${b.students}+${b.teachers}명`}
                    >
                      <StatusBadge status={b.status} /> {b.name}
                    </div>
                  ))}
                  {day.bookings.length > 3 && (
                    <div className="text-[9px] text-gray-400">
                      +{day.bookings.length - 3}건 더
                    </div>
                  )}
                </div>
              </>
            ) : (
              <div className="text-gray-300 text-lg mt-2">-</div>
            )}
          </div>
        ))}
      </div>

      {/* 주간 요약 */}
      <div className="mt-4 flex gap-4 text-xs text-gray-500 bg-gray-50 rounded-lg px-4 py-2.5">
        <span>
          총{' '}
          <strong className="text-museum-primary">
            {weekData.days.reduce((s, d) => s + d.bookings.length, 0)}
          </strong>
          건
        </span>
        <span>
          총{' '}
          <strong className="text-blue-600">
            {weekData.days.reduce((s, d) => s + d.totalPeople, 0)}
          </strong>
          명
        </span>
        <span>
          견적{' '}
          <strong className="text-museum-primary">
            ₩{fmtWon(weekData.days.reduce((s, d) => s + d.estimate, 0))}
          </strong>
        </span>
      </div>
    </Card>
  );
}
