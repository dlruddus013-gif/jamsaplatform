// ============================================================================
// 전체 예약 목록 컴포넌트
// ============================================================================
'use client';

import { useState, useMemo } from 'react';
import Card from '@/components/common/Card';
import Button from '@/components/common/Button';
import { StatusBadge } from '@/components/common/Badge';
import { useBookings } from '@/hooks/useBookings';
import { fmtWon, today } from '@/utils/format';
import { getEstimate } from '@/utils/pricing';
import type { Booking } from '@/types';

interface BookingListProps {
  onDetail?: (booking: Booking) => void;
}

export default function BookingList({ onDetail }: BookingListProps) {
  const { bookings, formConfig, setStatus, remove } = useBookings();

  const [search, setSearch] = useState('');
  const [statusFilter, setStatusFilter] = useState('all');
  const [dateFrom, setDateFrom] = useState(today().substring(0, 7) + '-01');
  const [dateTo, setDateTo] = useState(today());
  const [sortKey, setSortKey] = useState<'date' | 'name' | 'students'>('date');
  const [sortAsc, setSortAsc] = useState(true);

  const filtered = useMemo(() => {
    let list = bookings.filter((b) => {
      if (dateFrom && b.date < dateFrom) return false;
      if (dateTo && b.date > dateTo) return false;
      if (statusFilter !== 'all' && b.status !== statusFilter) return false;
      if (search) {
        const q = search.toLowerCase();
        return (
          b.name.toLowerCase().includes(q) ||
          b.phone?.includes(q) ||
          b.date.includes(q) ||
          (b.category || '').toLowerCase().includes(q)
        );
      }
      return true;
    });

    list.sort((a, b) => {
      let cmp = 0;
      if (sortKey === 'date') cmp = a.date.localeCompare(b.date);
      else if (sortKey === 'name') cmp = a.name.localeCompare(b.name);
      else if (sortKey === 'students') cmp = a.students - b.students;
      return sortAsc ? cmp : -cmp;
    });

    return list;
  }, [bookings, dateFrom, dateTo, statusFilter, search, sortKey, sortAsc]);

  const totalPeople = filtered.reduce(
    (s, b) => s + b.students + b.teachers,
    0
  );
  const totalEstimate = filtered.reduce(
    (s, b) => s + getEstimate(b, formConfig),
    0
  );

  const handleSort = (key: typeof sortKey) => {
    if (sortKey === key) setSortAsc(!sortAsc);
    else {
      setSortKey(key);
      setSortAsc(true);
    }
  };

  const cycleStatus = (bk: Booking) => {
    const order = ['대기', '확정', '취소'];
    const idx = order.indexOf(bk.status);
    const next = order[(idx + 1) % order.length];
    setStatus(bk.id, next);
  };

  return (
    <div>
      {/* 필터 바 */}
      <Card>
        <div className="flex flex-wrap gap-3 items-end">
          <div className="flex flex-col gap-1">
            <label className="text-[10px] font-bold text-gray-500">시작일</label>
            <input
              type="date"
              value={dateFrom}
              onChange={(e) => setDateFrom(e.target.value)}
              className="border border-museum-border rounded-lg px-2 py-1.5 text-xs outline-none"
            />
          </div>
          <div className="flex flex-col gap-1">
            <label className="text-[10px] font-bold text-gray-500">종료일</label>
            <input
              type="date"
              value={dateTo}
              onChange={(e) => setDateTo(e.target.value)}
              className="border border-museum-border rounded-lg px-2 py-1.5 text-xs outline-none"
            />
          </div>
          <div className="flex flex-col gap-1">
            <label className="text-[10px] font-bold text-gray-500">상태</label>
            <select
              value={statusFilter}
              onChange={(e) => setStatusFilter(e.target.value)}
              className="border border-museum-border rounded-lg px-2 py-1.5 text-xs outline-none"
            >
              <option value="all">전체</option>
              <option value="대기">대기</option>
              <option value="확정">확정</option>
              <option value="취소">취소</option>
            </select>
          </div>
          <div className="flex-1 min-w-[150px]">
            <input
              type="text"
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              placeholder="🔍 단체명, 연락처, 날짜 검색..."
              className="w-full border border-museum-border rounded-lg px-3 py-1.5 text-xs outline-none"
            />
          </div>
        </div>
        <div className="flex gap-3 mt-3 text-xs text-gray-500">
          <span>
            검색결과: <strong className="text-museum-primary">{filtered.length}</strong>건
          </span>
          <span>
            총 인원: <strong className="text-blue-600">{totalPeople}</strong>명
          </span>
          <span>
            견적 합계:{' '}
            <strong className="text-museum-primary">
              ₩{fmtWon(totalEstimate)}
            </strong>
          </span>
        </div>
      </Card>

      {/* 예약 테이블 */}
      <Card title="전체 예약" icon="📋">
        <div className="overflow-x-auto">
          <table className="w-full border-collapse text-xs">
            <thead>
              <tr>
                <th
                  className="bg-[#fafaf8] px-3 py-2.5 font-bold text-gray-500 border-b-2 border-museum-border text-left cursor-pointer whitespace-nowrap"
                  onClick={() => handleSort('date')}
                >
                  날짜 {sortKey === 'date' && (sortAsc ? '↑' : '↓')}
                </th>
                <th
                  className="bg-[#fafaf8] px-3 py-2.5 font-bold text-gray-500 border-b-2 border-museum-border text-left cursor-pointer whitespace-nowrap"
                  onClick={() => handleSort('name')}
                >
                  단체명 {sortKey === 'name' && (sortAsc ? '↑' : '↓')}
                </th>
                <th className="bg-[#fafaf8] px-3 py-2.5 font-bold text-gray-500 border-b-2 border-museum-border text-left whitespace-nowrap">
                  구분
                </th>
                <th className="bg-[#fafaf8] px-3 py-2.5 font-bold text-gray-500 border-b-2 border-museum-border text-left whitespace-nowrap">
                  시간
                </th>
                <th
                  className="bg-[#fafaf8] px-3 py-2.5 font-bold text-gray-500 border-b-2 border-museum-border text-center cursor-pointer whitespace-nowrap"
                  onClick={() => handleSort('students')}
                >
                  인원 {sortKey === 'students' && (sortAsc ? '↑' : '↓')}
                </th>
                <th className="bg-[#fafaf8] px-3 py-2.5 font-bold text-gray-500 border-b-2 border-museum-border text-center whitespace-nowrap">
                  상태
                </th>
                <th className="bg-[#fafaf8] px-3 py-2.5 font-bold text-gray-500 border-b-2 border-museum-border text-right whitespace-nowrap">
                  견적
                </th>
                <th className="bg-[#fafaf8] px-3 py-2.5 font-bold text-gray-500 border-b-2 border-museum-border text-center whitespace-nowrap">
                  관리
                </th>
              </tr>
            </thead>
            <tbody>
              {filtered.length === 0 ? (
                <tr>
                  <td
                    colSpan={8}
                    className="text-center py-8 text-gray-400"
                  >
                    조건에 맞는 예약이 없습니다.
                  </td>
                </tr>
              ) : (
                filtered.map((b) => (
                  <tr
                    key={b.id}
                    className="hover:bg-[#fafaf8] transition-colors cursor-pointer"
                    onClick={() => onDetail?.(b)}
                  >
                    <td className="px-3 py-2.5 border-b border-[#f5f3ee] whitespace-nowrap">
                      {b.date}
                    </td>
                    <td className="px-3 py-2.5 border-b border-[#f5f3ee] font-bold">
                      {b.name}
                      {b.agencyName && (
                        <span className="ml-1 text-[9px] text-purple-600 bg-purple-50 px-1 rounded">
                          {b.agencyName}
                        </span>
                      )}
                    </td>
                    <td className="px-3 py-2.5 border-b border-[#f5f3ee]">
                      {b.category || '미분류'}
                    </td>
                    <td className="px-3 py-2.5 border-b border-[#f5f3ee] whitespace-nowrap">
                      {b.arrival}~{b.departure}
                    </td>
                    <td className="px-3 py-2.5 border-b border-[#f5f3ee] text-center font-bold">
                      {b.students}+{b.teachers}
                    </td>
                    <td
                      className="px-3 py-2.5 border-b border-[#f5f3ee] text-center"
                      onClick={(e) => {
                        e.stopPropagation();
                        cycleStatus(b);
                      }}
                    >
                      <StatusBadge status={b.status} />
                    </td>
                    <td className="px-3 py-2.5 border-b border-[#f5f3ee] text-right whitespace-nowrap">
                      ₩{fmtWon(getEstimate(b, formConfig))}
                    </td>
                    <td className="px-3 py-2.5 border-b border-[#f5f3ee] text-center">
                      <button
                        onClick={(e) => {
                          e.stopPropagation();
                          if (confirm(`${b.name} 예약을 삭제하시겠습니까?`))
                            remove(b.id);
                        }}
                        className="text-red-400 hover:text-red-600 text-[11px] bg-transparent border-none cursor-pointer"
                      >
                        🗑️
                      </button>
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>
      </Card>
    </div>
  );
}
