// ============================================================================
// 매출 차트 컴포넌트
// ============================================================================
'use client';

import { useState, useMemo } from 'react';
import { useAppStore } from '@/stores/useAppStore';
import Card from '@/components/common/Card';
import { fmtWon, today } from '@/utils/format';
import { getEstimate } from '@/utils/pricing';

type Period = 'month' | 'week' | 'day';
type Range = '1m' | '3m' | '6m' | '1y' | 'all';

export default function RevenueChart() {
  const { bookings, formConfig } = useAppStore();
  const [period, setPeriod] = useState<Period>('month');
  const [range, setRange] = useState<Range>('3m');

  const chartData = useMemo(() => {
    const todayStr = today();
    const rangeDate = new Date();
    if (range === '1m') rangeDate.setMonth(rangeDate.getMonth() - 1);
    else if (range === '3m') rangeDate.setMonth(rangeDate.getMonth() - 3);
    else if (range === '6m') rangeDate.setMonth(rangeDate.getMonth() - 6);
    else if (range === '1y') rangeDate.setFullYear(rangeDate.getFullYear() - 1);
    else rangeDate.setFullYear(2020);
    const fromDate = rangeDate.toISOString().split('T')[0];

    const active = bookings.filter(
      (b) => b.status !== '취소' && b.date >= fromDate && b.date <= todayStr
    );

    const groups: Record<string, { estimate: number; paid: number; count: number; people: number }> = {};

    active.forEach((b) => {
      let key: string;
      if (period === 'month') key = b.date.substring(0, 7);
      else if (period === 'week') {
        const d = new Date(b.date);
        const dayOfWeek = d.getDay();
        const monday = new Date(d);
        monday.setDate(d.getDate() - ((dayOfWeek + 6) % 7));
        key = monday.toISOString().split('T')[0];
      } else {
        key = b.date;
      }

      if (!groups[key]) groups[key] = { estimate: 0, paid: 0, count: 0, people: 0 };
      groups[key].estimate += getEstimate(b, formConfig);
      groups[key].paid += b.paidAmount ?? 0;
      groups[key].count++;
      groups[key].people += b.students + b.teachers;
    });

    return Object.entries(groups)
      .sort(([a], [b]) => a.localeCompare(b))
      .map(([key, val]) => ({ period: key, ...val }));
  }, [bookings, formConfig, period, range]);

  const maxVal = Math.max(...chartData.map((d) => d.estimate), 1);

  return (
    <Card
      title="💰 매출 분석"
      action={
        <div className="flex gap-1">
          {(['1m', '3m', '6m', '1y'] as Range[]).map((r) => (
            <button
              key={r}
              onClick={() => setRange(r)}
              className={`px-2 py-1 text-[10px] border rounded-md cursor-pointer font-bold ${
                range === r
                  ? 'bg-museum-primary text-white border-museum-primary'
                  : 'bg-white text-gray-500 border-gray-200 hover:bg-gray-50'
              }`}
            >
              {r === '1m' ? '1개월' : r === '3m' ? '3개월' : r === '6m' ? '6개월' : '1년'}
            </button>
          ))}
        </div>
      }
    >
      {/* 기간 단위 선택 */}
      <div className="flex gap-2 mb-4">
        {(['month', 'week', 'day'] as Period[]).map((p) => (
          <button
            key={p}
            onClick={() => setPeriod(p)}
            className={`px-3 py-1.5 text-xs border-2 rounded-full cursor-pointer font-extrabold ${
              period === p
                ? 'bg-gradient-to-br from-museum-primary to-museum-secondary text-white border-museum-primary shadow-sm'
                : 'bg-white text-gray-600 border-gray-200 hover:border-museum-tertiary hover:bg-green-50'
            }`}
          >
            {p === 'month' ? '월별' : p === 'week' ? '주별' : '일별'}
          </button>
        ))}
      </div>

      {chartData.length === 0 ? (
        <div className="text-center py-8 text-gray-400 text-sm">
          해당 기간의 데이터가 없습니다.
        </div>
      ) : (
        <div className="space-y-2">
          {chartData.map((d) => (
            <div key={d.period} className="flex items-center gap-3">
              <div className="w-20 text-[11px] font-bold text-gray-500 text-right shrink-0">
                {period === 'month'
                  ? d.period.substring(2).replace('-', '/')
                  : d.period.substring(5)}
              </div>
              <div className="flex-1 relative">
                {/* 견적 바 */}
                <div
                  className="h-5 bg-gradient-to-r from-green-400 to-green-600 rounded-md relative"
                  style={{
                    width: `${Math.max(2, (d.estimate / maxVal) * 100)}%`,
                  }}
                >
                  <span className="absolute right-1 top-0 text-[9px] text-white font-bold leading-5">
                    ₩{fmtWon(d.estimate)}
                  </span>
                </div>
                {/* 실결제 바 */}
                {d.paid > 0 && (
                  <div
                    className="h-3 bg-gradient-to-r from-blue-400 to-blue-600 rounded-md mt-0.5"
                    style={{
                      width: `${Math.max(1, (d.paid / maxVal) * 100)}%`,
                    }}
                  >
                    <span className="text-[8px] text-white font-bold px-1 leading-3">
                      ₩{fmtWon(d.paid)}
                    </span>
                  </div>
                )}
              </div>
              <div className="w-16 text-right text-[10px] text-gray-400 shrink-0">
                {d.count}건 {d.people}명
              </div>
            </div>
          ))}
        </div>
      )}

      {/* 범례 */}
      <div className="flex gap-4 mt-4 text-[10px] text-gray-400">
        <span className="flex items-center gap-1">
          <span className="w-3 h-3 rounded bg-gradient-to-r from-green-400 to-green-600 inline-block" />
          견적
        </span>
        <span className="flex items-center gap-1">
          <span className="w-3 h-3 rounded bg-gradient-to-r from-blue-400 to-blue-600 inline-block" />
          실결제
        </span>
      </div>
    </Card>
  );
}
