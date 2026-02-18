// ============================================================================
// 대시보드 통계 카드 컴포넌트
// ============================================================================
'use client';

import { useMemo } from 'react';
import { useAppStore } from '@/stores/useAppStore';
import { fmtWon, today } from '@/utils/format';
import { getEstimate } from '@/utils/pricing';

export default function StatCards() {
  const { bookings, formConfig } = useAppStore();
  const todayStr = today();
  const currentMonth = todayStr.substring(0, 7);

  const stats = useMemo(() => {
    const todayBks = bookings.filter(
      (b) => b.date === todayStr && b.status !== '취소'
    );
    const todayPpl = todayBks.reduce(
      (s, b) => s + b.students + b.teachers,
      0
    );
    const pending = bookings.filter((b) => b.status === '대기');
    const pendPpl = pending.reduce(
      (s, b) => s + b.students + b.teachers,
      0
    );
    const confirmed = bookings.filter((b) => b.status === '확정');
    const confPpl = confirmed.reduce(
      (s, b) => s + b.students + b.teachers,
      0
    );
    const monthBks = bookings.filter(
      (b) => b.date.startsWith(currentMonth) && b.status !== '취소'
    );
    const monthPpl = monthBks.reduce(
      (s, b) => s + b.students + b.teachers,
      0
    );
    const monthEst = monthBks.reduce(
      (s, b) => s + getEstimate(b, formConfig),
      0
    );
    const monthPaidBks = monthBks.filter((b) => b.paidAmount != null);
    const monthPaid = monthPaidBks.reduce(
      (s, b) => s + (b.paidAmount ?? 0),
      0
    );
    const monthPaidPpl = monthPaidBks.reduce(
      (s, b) => s + b.students + b.teachers,
      0
    );

    return [
      {
        value: todayBks.length,
        label: '오늘 예약',
        sub: `${todayPpl}명`,
        color: 'var(--p)',
        colorClass: 'text-museum-primary',
      },
      {
        value: pending.length,
        label: '대기 중',
        sub: `${pendPpl}명`,
        color: '#f39c12',
        colorClass: 'text-orange-500',
      },
      {
        value: confirmed.length,
        label: '확정',
        sub: `${confPpl}명`,
        color: '#27ae60',
        colorClass: 'text-green-600',
      },
      {
        value: monthBks.length,
        label: '이번달',
        sub: `${monthPpl}명`,
        color: '#2980b9',
        colorClass: 'text-blue-600',
      },
      {
        value: `₩${fmtWon(monthEst)}`,
        label: '이달 견적',
        sub: `${monthBks.length}건 / ${monthPpl}명`,
        color: 'var(--p)',
        colorClass: 'text-museum-primary',
        small: true,
      },
      {
        value: `₩${fmtWon(monthPaid)}`,
        label: '이달 실결제',
        sub: `${monthPaidBks.length}건 / ${monthPaidPpl}명`,
        color: '#1565C0',
        colorClass: 'text-blue-800',
        small: true,
      },
    ];
  }, [bookings, formConfig, todayStr, currentMonth]);

  return (
    <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-6 gap-3 mb-5">
      {stats.map((card) => (
        <div
          key={card.label}
          className="bg-white rounded-[14px] shadow-sm border border-museum-border p-3 text-center cursor-pointer hover:border-museum-tertiary hover:shadow-md transition-all"
        >
          <div
            className={`font-black leading-tight whitespace-nowrap ${card.colorClass} ${
              card.small ? 'text-sm sm:text-base' : 'text-xl sm:text-3xl'
            }`}
          >
            {card.value}
          </div>
          <div className="text-[13px] text-gray-600 mt-1 font-bold">
            {card.label}
          </div>
          {card.sub && (
            <div className="text-[13px] text-museum-primary font-extrabold mt-0.5">
              {card.sub}
            </div>
          )}
        </div>
      ))}
    </div>
  );
}
