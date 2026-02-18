// ============================================================================
// 구분별 통계 컴포넌트
// ============================================================================
'use client';

import { useMemo } from 'react';
import { useAppStore } from '@/stores/useAppStore';
import Card from '@/components/common/Card';
import { fmtWon } from '@/utils/format';
import { getEstimate } from '@/utils/pricing';

export default function CategoryStats() {
  const { bookings, formConfig } = useAppStore();

  const categories = useMemo(() => {
    const active = bookings.filter((b) => b.status !== '취소');
    const map: Record<
      string,
      { count: number; people: number; estimate: number }
    > = {};

    active.forEach((b) => {
      const cat = b.category || '미분류';
      if (!map[cat]) map[cat] = { count: 0, people: 0, estimate: 0 };
      map[cat].count++;
      map[cat].people += b.students + b.teachers;
      map[cat].estimate += getEstimate(b, formConfig);
    });

    const total = active.length;
    return Object.entries(map)
      .sort((a, b) => b[1].count - a[1].count)
      .map(([name, data]) => ({
        name,
        ...data,
        pct: total > 0 ? Math.round((data.count / total) * 100) : 0,
        avgPeople: data.count > 0 ? Math.round(data.people / data.count) : 0,
        avgEst: data.count > 0 ? Math.round(data.estimate / data.count) : 0,
      }));
  }, [bookings, formConfig]);

  const colors = [
    '#1a472a', '#2d6a4f', '#40916c', '#52b788', '#74c69d',
    '#2196F3', '#FF9800', '#9C27B0', '#F44336', '#00BCD4',
  ];

  const maxCount = Math.max(...categories.map((c) => c.count), 1);

  return (
    <Card title="📂 구분별 통계">
      {categories.length === 0 ? (
        <div className="text-center py-8 text-gray-400 text-sm">
          분석할 데이터가 없습니다.
        </div>
      ) : (
        <div className="space-y-3">
          {categories.map((cat, i) => (
            <div key={cat.name}>
              <div className="flex justify-between items-center mb-1">
                <div className="flex items-center gap-2">
                  <span
                    className="w-3 h-3 rounded-sm inline-block"
                    style={{ backgroundColor: colors[i % colors.length] }}
                  />
                  <span className="text-xs font-bold text-gray-700">
                    {cat.name}
                  </span>
                  <span className="text-[10px] text-gray-400">
                    {cat.count}건 ({cat.pct}%)
                  </span>
                </div>
                <div className="text-[10px] text-gray-500">
                  평균 {cat.avgPeople}명 / ₩{fmtWon(cat.avgEst)}
                </div>
              </div>
              <div className="w-full bg-gray-100 rounded-full h-4 relative overflow-hidden">
                <div
                  className="h-full rounded-full transition-all duration-500"
                  style={{
                    width: `${(cat.count / maxCount) * 100}%`,
                    backgroundColor: colors[i % colors.length],
                  }}
                />
                <span className="absolute right-2 top-0 text-[9px] text-gray-600 font-bold leading-4">
                  {cat.people}명 / ₩{fmtWon(cat.estimate)}
                </span>
              </div>
            </div>
          ))}
        </div>
      )}
    </Card>
  );
}
