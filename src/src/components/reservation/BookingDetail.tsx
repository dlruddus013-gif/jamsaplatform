// ============================================================================
// 예약 상세 모달 컴포넌트
// ============================================================================
'use client';

import { useState } from 'react';
import Modal from '@/components/common/Modal';
import Button from '@/components/common/Button';
import { StatusBadge } from '@/components/common/Badge';
import { useBookings } from '@/hooks/useBookings';
import { useToast } from '@/components/common/Toast';
import { fmtWon } from '@/utils/format';
import { calcQuote } from '@/utils/pricing';
import { useAppStore } from '@/stores/useAppStore';
import type { Booking } from '@/types';

interface BookingDetailProps {
  booking: Booking;
  isOpen: boolean;
  onClose: () => void;
}

export default function BookingDetail({
  booking,
  isOpen,
  onClose,
}: BookingDetailProps) {
  const { update, setStatus } = useBookings();
  const { formConfig } = useAppStore();
  const { toast } = useToast();
  const [editing, setEditing] = useState(false);
  const [editData, setEditData] = useState<Partial<Booking>>({});

  const quote = calcQuote(booking, formConfig);

  const handleSave = () => {
    update(booking.id, editData);
    setEditing(false);
    toast('수정이 저장되었습니다', 'success');
  };

  const handleStatusChange = (status: string) => {
    setStatus(booking.id, status);
    toast(`상태가 ${status}(으)로 변경되었습니다`, 'success');
  };

  return (
    <Modal
      isOpen={isOpen}
      onClose={onClose}
      title={`${booking.name} 예약 상세`}
      maxWidth="640px"
      footer={
        <div className="flex gap-2">
          {editing ? (
            <>
              <Button variant="green" size="sm" onClick={handleSave}>
                💾 저장
              </Button>
              <Button
                variant="gray"
                size="sm"
                onClick={() => setEditing(false)}
              >
                취소
              </Button>
            </>
          ) : (
            <>
              <Button
                variant="blue"
                size="sm"
                onClick={() => {
                  setEditing(true);
                  setEditData({});
                }}
              >
                ✏️ 수정
              </Button>
              <Button variant="gray" size="sm" onClick={onClose}>
                닫기
              </Button>
            </>
          )}
        </div>
      }
    >
      {/* 상태 변경 버튼 */}
      <div className="flex gap-2 mb-4">
        {['대기', '확정', '취소'].map((st) => (
          <button
            key={st}
            onClick={() => handleStatusChange(st)}
            className={`flex-1 py-2 border-none rounded-lg text-xs font-bold cursor-pointer transition-all ${
              booking.status === st
                ? 'bg-museum-primary text-white shadow-md'
                : 'bg-gray-100 text-gray-500 hover:bg-gray-200'
            }`}
          >
            {st === '대기' ? '⏳' : st === '확정' ? '✅' : '❌'} {st}
          </button>
        ))}
      </div>

      {/* 기본 정보 */}
      <div className="grid grid-cols-2 gap-3 mb-4">
        <InfoRow label="📅 방문일" value={booking.date} />
        <InfoRow
          label="⏰ 시간"
          value={`${booking.arrival} ~ ${booking.departure}`}
        />
        <InfoRow label="👥 아동" value={`${booking.students}명`} />
        <InfoRow label="👨‍🏫 인솔" value={`${booking.teachers}명`} />
        <InfoRow label="📞 연락처" value={booking.phone || '-'} />
        <InfoRow label="📂 구분" value={booking.category || '미분류'} />
        <InfoRow label="🎫 코스" value={booking.courseType} />
        <InfoRow label="🍚 단체식" value={booking.meal} />
        <InfoRow
          label="✨ 부가체험"
          value={booking.addons.length > 0 ? booking.addons.join(', ') : '없음'}
        />
        <InfoRow
          label="📊 상태"
          value={<StatusBadge status={booking.status} />}
        />
      </div>

      {/* 요청사항 */}
      {booking.etc && (
        <div className="bg-yellow-50 border border-yellow-200 rounded-lg p-3 mb-4">
          <div className="text-[11px] font-bold text-yellow-700 mb-1">
            📝 요청사항
          </div>
          <div className="text-xs text-gray-600">{booking.etc}</div>
        </div>
      )}

      {/* 견적 요약 */}
      <div className="bg-green-50 border border-green-200 rounded-lg p-3">
        <div className="text-[11px] font-bold text-green-800 mb-2">
          💰 견적 요약
        </div>
        <table className="w-full text-[11px]">
          <tbody>
            {quote.items.map((item, i) => (
              <tr key={i} className="border-b border-green-100 last:border-none">
                <td className="py-1 text-gray-600">{item.name}</td>
                <td className="py-1 text-center text-gray-500">
                  {item.qty}
                </td>
                <td className="py-1 text-right text-gray-500">
                  ₩{fmtWon(item.unit)}
                </td>
                <td className="py-1 text-right font-bold">
                  ₩{fmtWon(item.total)}
                </td>
              </tr>
            ))}
          </tbody>
          <tfoot>
            <tr className="border-t-2 border-green-300">
              <td colSpan={3} className="py-2 font-extrabold text-green-800">
                합계
              </td>
              <td className="py-2 text-right font-extrabold text-green-800 text-sm">
                ₩{fmtWon(quote.grandTotal)}
              </td>
            </tr>
          </tfoot>
        </table>
      </div>
    </Modal>
  );
}

function InfoRow({
  label,
  value,
}: {
  label: string;
  value: React.ReactNode;
}) {
  return (
    <div className="bg-gray-50 rounded-lg px-3 py-2">
      <div className="text-[10px] text-gray-400 mb-0.5">{label}</div>
      <div className="text-xs font-bold text-gray-700">{value}</div>
    </div>
  );
}
