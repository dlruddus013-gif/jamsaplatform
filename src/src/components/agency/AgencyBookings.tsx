// ============================================================================
// 대행사 예약 목록 컴포넌트
// ============================================================================
'use client';

import { useMemo } from 'react';
import { useAppStore } from '@/stores/useAppStore';
import Card from '@/components/common/Card';
import { StatusBadge } from '@/components/common/Badge';
import { fmtWon } from '@/utils/format';
import { getEstimate } from '@/utils/pricing';

export default function AgencyBookings() {
  const { bookings, formConfig, currentAgency } = useAppStore();

  const myBookings = useMemo(
    () =>
      bookings
        .filter((b) => b.agency === currentAgency?.code)
        .sort((a, b) => b.date.localeCompare(a.date)),
    [bookings, currentAgency]
  );

  const totalPeople = myBookings.reduce(
    (s, b) => s + b.students + b.teachers,
    0
  );
  const totalEst = myBookings.reduce(
    (s, b) => s + getEstimate(b, formConfig),
    0
  );

  return (
    <Card
      title={`📋 ${currentAgency?.name || '대행사'} 예약 현황`}
      action={
        <div className="text-xs text-gray-500">
          {myBookings.length}건 / {totalPeople}명 / ₩{fmtWon(totalEst)}
        </div>
      }
    >
      {myBookings.length === 0 ? (
        <div className="text-center py-8 text-gray-400 text-sm">
          등록된 예약이 없습니다.
        </div>
      ) : (
        <div className="overflow-x-auto">
          <table className="w-full border-collapse text-xs">
            <thead>
              <tr>
                {['날짜', '단체명', '시간', '인원', '상태', '견적'].map(
                  (h) => (
                    <th
                      key={h}
                      className="bg-[#fafaf8] px-3 py-2.5 font-bold text-gray-500 border-b-2 border-museum-border text-left whitespace-nowrap"
                    >
                      {h}
                    </th>
                  )
                )}
              </tr>
            </thead>
            <tbody>
              {myBookings.map((b) => (
                <tr
                  key={b.id}
                  className="hover:bg-[#fafaf8] transition-colors"
                >
                  <td className="px-3 py-2.5 border-b border-[#f5f3ee]">
                    {b.date}
                  </td>
                  <td className="px-3 py-2.5 border-b border-[#f5f3ee] font-bold">
                    {b.name}
                  </td>
                  <td className="px-3 py-2.5 border-b border-[#f5f3ee] whitespace-nowrap">
                    {b.arrival}~{b.departure}
                  </td>
                  <td className="px-3 py-2.5 border-b border-[#f5f3ee] text-center font-bold">
                    {b.students}+{b.teachers}
                  </td>
                  <td className="px-3 py-2.5 border-b border-[#f5f3ee] text-center">
                    <StatusBadge status={b.status} />
                  </td>
                  <td className="px-3 py-2.5 border-b border-[#f5f3ee] text-right">
                    ₩{fmtWon(getEstimate(b, formConfig))}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </Card>
  );
}
