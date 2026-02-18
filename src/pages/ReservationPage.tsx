import {
  Search,
  Filter,
  Plus,
  Download,
  Eye,
  Edit2,
  Trash2,
  Phone,
  Mail,
  Users,
  CalendarCheck,
  ChevronLeft,
  ChevronRight,
  MoreVertical,
} from 'lucide-react';
import { useState } from 'react';
import Card from '../components/common/Card';
import StatusBadge from '../components/common/StatusBadge';
import Modal from '../components/common/Modal';
import { formatCurrency, formatDate, formatPhone, getReservationStatusLabel, getPaymentStatusLabel } from '../utils/format';
import type { Reservation, ReservationStatus, PaymentStatus, CourseType } from '../types';

const mockReservations: Reservation[] = [
  {
    id: '1', reservation_number: 'RSV-2026-0218-001', facility_id: '2',
    customer_name: '김교사', customer_phone: '01012345678', customer_email: 'kim@school.kr',
    organization: '한국초등학교', date: '2026-02-20', start_time: '10:00', end_time: '12:00',
    visitor_count: 30, adult_count: 3, child_count: 27, status: 'confirmed',
    payment_status: 'paid', payment_amount: 450000, course_type: 'A',
    notes: '알레르기 주의 학생 2명', created_at: '2026-02-15T09:00:00Z', updated_at: '2026-02-16T14:00:00Z',
  },
  {
    id: '2', reservation_number: 'RSV-2026-0218-002', facility_id: '1',
    customer_name: '이방문', customer_phone: '01023456789',
    date: '2026-02-20', start_time: '14:00', end_time: '16:00',
    visitor_count: 5, adult_count: 3, child_count: 2, status: 'pending',
    payment_status: 'unpaid', payment_amount: 90000, course_type: 'B',
    created_at: '2026-02-17T11:00:00Z', updated_at: '2026-02-17T11:00:00Z',
  },
  {
    id: '3', reservation_number: 'RSV-2026-0218-003', facility_id: '2',
    customer_name: '박체험', customer_phone: '01034567890', customer_email: 'park@gmail.com',
    organization: '서울중학교', date: '2026-02-22', start_time: '09:30', end_time: '12:30',
    visitor_count: 45, adult_count: 5, child_count: 40, status: 'confirmed',
    payment_status: 'partial', payment_amount: 675000, course_type: 'C',
    notes: '점심 포함 희망', created_at: '2026-02-10T08:00:00Z', updated_at: '2026-02-14T10:00:00Z',
  },
  {
    id: '4', reservation_number: 'RSV-2026-0218-004', facility_id: '4',
    customer_name: '최가족', customer_phone: '01045678901',
    date: '2026-02-21', start_time: '13:00', end_time: '15:00',
    visitor_count: 4, adult_count: 2, child_count: 2, status: 'confirmed',
    payment_status: 'paid', payment_amount: 60000, course_type: 'A',
    created_at: '2026-02-16T15:00:00Z', updated_at: '2026-02-16T15:30:00Z',
  },
  {
    id: '5', reservation_number: 'RSV-2026-0218-005', facility_id: '6',
    customer_name: '정교육', customer_phone: '01056789012', customer_email: 'jung@edu.kr',
    organization: '경기초등학교', date: '2026-02-25', start_time: '10:00', end_time: '15:00',
    visitor_count: 60, adult_count: 5, child_count: 55, status: 'pending',
    payment_status: 'unpaid', payment_amount: 900000, course_type: 'D',
    notes: '대형버스 2대 주차 필요', created_at: '2026-02-18T09:00:00Z', updated_at: '2026-02-18T09:00:00Z',
  },
  {
    id: '6', reservation_number: 'RSV-2026-0217-001', facility_id: '2',
    customer_name: '강취소', customer_phone: '01067890123',
    date: '2026-02-19', start_time: '14:00', end_time: '16:00',
    visitor_count: 8, adult_count: 4, child_count: 4, status: 'cancelled',
    payment_status: 'refunded', payment_amount: 120000, course_type: 'A',
    created_at: '2026-02-12T10:00:00Z', updated_at: '2026-02-17T16:00:00Z',
  },
  {
    id: '7', reservation_number: 'RSV-2026-0216-001', facility_id: '1',
    customer_name: '윤완료', customer_phone: '01078901234', customer_email: 'yoon@test.com',
    organization: '인천초등학교', date: '2026-02-16', start_time: '10:00', end_time: '12:00',
    visitor_count: 35, adult_count: 3, child_count: 32, status: 'completed',
    payment_status: 'paid', payment_amount: 525000, course_type: 'B',
    created_at: '2026-02-05T14:00:00Z', updated_at: '2026-02-16T12:00:00Z',
  },
];

export default function ReservationPage() {
  const [searchQuery, setSearchQuery] = useState('');
  const [statusFilter, setStatusFilter] = useState<string>('all');
  const [paymentFilter, setPaymentFilter] = useState<string>('all');
  const [selectedReservation, setSelectedReservation] = useState<Reservation | null>(null);
  const [currentPage, setCurrentPage] = useState(1);
  const itemsPerPage = 10;

  const filtered = mockReservations.filter((r) => {
    if (statusFilter !== 'all' && r.status !== statusFilter) return false;
    if (paymentFilter !== 'all' && r.payment_status !== paymentFilter) return false;
    if (searchQuery) {
      const q = searchQuery.toLowerCase();
      return (
        r.customer_name.includes(q) ||
        r.reservation_number.toLowerCase().includes(q) ||
        r.organization?.toLowerCase().includes(q) ||
        r.customer_phone.includes(q)
      );
    }
    return true;
  });

  const statusCounts = {
    all: mockReservations.length,
    pending: mockReservations.filter((r) => r.status === 'pending').length,
    confirmed: mockReservations.filter((r) => r.status === 'confirmed').length,
    completed: mockReservations.filter((r) => r.status === 'completed').length,
    cancelled: mockReservations.filter((r) => r.status === 'cancelled').length,
  };

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-lg font-bold">예약관리</h1>
          <p className="text-xs text-text-muted mt-0.5">예약 목록 조회 및 관리</p>
        </div>
        <div className="flex items-center gap-2">
          <button className="flex items-center gap-1.5 px-3 py-2 text-sm font-medium text-text-secondary bg-white border border-border rounded-lg hover:bg-gray-50 transition-colors">
            <Download className="w-4 h-4" />
            CSV 내보내기
          </button>
          <button className="flex items-center gap-1.5 px-3 py-2 text-sm font-medium text-white bg-museum-green rounded-lg hover:bg-museum-green-light transition-colors">
            <Plus className="w-4 h-4" />
            예약 등록
          </button>
        </div>
      </div>

      {/* 상태 필터 탭 */}
      <div className="flex gap-2 flex-wrap">
        {[
          { key: 'all', label: '전체' },
          { key: 'pending', label: '대기중' },
          { key: 'confirmed', label: '확정' },
          { key: 'completed', label: '완료' },
          { key: 'cancelled', label: '취소' },
        ].map((item) => (
          <button
            key={item.key}
            onClick={() => setStatusFilter(item.key)}
            className={`px-3 py-1.5 text-xs font-medium rounded-full transition-colors ${
              statusFilter === item.key
                ? 'bg-museum-green text-white'
                : 'bg-gray-100 text-text-secondary hover:bg-gray-200'
            }`}
          >
            {item.label}
            <span className="ml-1.5 opacity-70">
              {statusCounts[item.key as keyof typeof statusCounts]}
            </span>
          </button>
        ))}
      </div>

      {/* 검색 및 필터 */}
      <div className="flex items-center gap-3">
        <div className="relative flex-1 max-w-md">
          <Search className="w-4 h-4 absolute left-3 top-1/2 -translate-y-1/2 text-text-muted" />
          <input
            type="text"
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            placeholder="예약번호, 고객명, 단체명, 연락처 검색..."
            className="pl-9 pr-4 py-2 w-full text-sm border border-border rounded-lg bg-white focus:outline-none focus:ring-2 focus:ring-museum-green/20"
          />
        </div>
        <select
          value={paymentFilter}
          onChange={(e) => setPaymentFilter(e.target.value)}
          className="px-3 py-2 text-sm border border-border rounded-lg bg-white focus:outline-none"
        >
          <option value="all">결제 상태</option>
          <option value="unpaid">미결제</option>
          <option value="partial">부분결제</option>
          <option value="paid">결제완료</option>
          <option value="refunded">환불</option>
        </select>
      </div>

      {/* 예약 테이블 */}
      <Card padding="none">
        <div className="overflow-x-auto">
          <table className="w-full">
            <thead>
              <tr className="border-b border-border bg-gray-50/50">
                <th className="text-left px-4 py-2.5 text-xs font-semibold text-text-muted">예약번호</th>
                <th className="text-left px-4 py-2.5 text-xs font-semibold text-text-muted">고객정보</th>
                <th className="text-left px-4 py-2.5 text-xs font-semibold text-text-muted">방문일시</th>
                <th className="text-center px-4 py-2.5 text-xs font-semibold text-text-muted">인원</th>
                <th className="text-center px-4 py-2.5 text-xs font-semibold text-text-muted">코스</th>
                <th className="text-right px-4 py-2.5 text-xs font-semibold text-text-muted">금액</th>
                <th className="text-center px-4 py-2.5 text-xs font-semibold text-text-muted">결제</th>
                <th className="text-center px-4 py-2.5 text-xs font-semibold text-text-muted">상태</th>
                <th className="text-center px-4 py-2.5 text-xs font-semibold text-text-muted">관리</th>
              </tr>
            </thead>
            <tbody>
              {filtered.map((reservation) => (
                <tr
                  key={reservation.id}
                  className="border-b border-border hover:bg-gray-50 transition-colors cursor-pointer"
                  onClick={() => setSelectedReservation(reservation)}
                >
                  <td className="px-4 py-3">
                    <p className="text-xs font-mono text-museum-green font-medium">
                      {reservation.reservation_number}
                    </p>
                  </td>
                  <td className="px-4 py-3">
                    <p className="text-sm font-medium">{reservation.customer_name}</p>
                    {reservation.organization && (
                      <p className="text-[11px] text-text-muted">{reservation.organization}</p>
                    )}
                  </td>
                  <td className="px-4 py-3">
                    <p className="text-sm">{reservation.date}</p>
                    <p className="text-[11px] text-text-muted">
                      {reservation.start_time} - {reservation.end_time}
                    </p>
                  </td>
                  <td className="px-4 py-3 text-center">
                    <p className="text-sm font-medium">{reservation.visitor_count}명</p>
                    <p className="text-[11px] text-text-muted">
                      성인{reservation.adult_count} / 아동{reservation.child_count}
                    </p>
                  </td>
                  <td className="px-4 py-3 text-center">
                    <span className="inline-flex items-center justify-center w-7 h-7 rounded-full bg-silk-gold/10 text-silk-gold text-xs font-bold">
                      {reservation.course_type}
                    </span>
                  </td>
                  <td className="px-4 py-3 text-right">
                    <p className="text-sm font-medium">{formatCurrency(reservation.payment_amount)}</p>
                  </td>
                  <td className="px-4 py-3 text-center">
                    <StatusBadge
                      status={reservation.payment_status}
                      label={getPaymentStatusLabel(reservation.payment_status)}
                    />
                  </td>
                  <td className="px-4 py-3 text-center">
                    <StatusBadge
                      status={reservation.status}
                      label={getReservationStatusLabel(reservation.status)}
                    />
                  </td>
                  <td className="px-4 py-3">
                    <div className="flex items-center justify-center gap-1">
                      <button className="p-1.5 hover:bg-gray-100 rounded-lg transition-colors" onClick={(e) => e.stopPropagation()}>
                        <Edit2 className="w-3.5 h-3.5 text-text-secondary" />
                      </button>
                      <button className="p-1.5 hover:bg-red-50 rounded-lg transition-colors" onClick={(e) => e.stopPropagation()}>
                        <Trash2 className="w-3.5 h-3.5 text-danger" />
                      </button>
                    </div>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>

        {/* 페이지네이션 */}
        <div className="flex items-center justify-between px-4 py-3 border-t border-border">
          <p className="text-xs text-text-muted">총 {filtered.length}건</p>
          <div className="flex items-center gap-1">
            <button className="p-1.5 hover:bg-gray-100 rounded-lg transition-colors">
              <ChevronLeft className="w-4 h-4" />
            </button>
            <span className="px-3 py-1 text-xs font-medium bg-museum-green text-white rounded-lg">1</span>
            <button className="p-1.5 hover:bg-gray-100 rounded-lg transition-colors">
              <ChevronRight className="w-4 h-4" />
            </button>
          </div>
        </div>
      </Card>

      {/* 예약 상세 모달 */}
      <Modal
        isOpen={!!selectedReservation}
        onClose={() => setSelectedReservation(null)}
        title={`예약 상세 - ${selectedReservation?.reservation_number || ''}`}
        size="lg"
        footer={
          <>
            <button onClick={() => setSelectedReservation(null)} className="px-4 py-2 text-sm text-text-secondary bg-gray-100 rounded-lg hover:bg-gray-200 transition-colors">닫기</button>
            {selectedReservation?.status === 'pending' && (
              <button className="px-4 py-2 text-sm text-white bg-museum-green rounded-lg hover:bg-museum-green-light transition-colors">예약 확정</button>
            )}
          </>
        }
      >
        {selectedReservation && (
          <div className="space-y-4">
            <div className="grid grid-cols-2 gap-4">
              <div>
                <p className="text-xs text-text-muted mb-1">고객명</p>
                <p className="text-sm font-medium">{selectedReservation.customer_name}</p>
              </div>
              <div>
                <p className="text-xs text-text-muted mb-1">연락처</p>
                <p className="text-sm font-medium">{formatPhone(selectedReservation.customer_phone)}</p>
              </div>
              {selectedReservation.organization && (
                <div>
                  <p className="text-xs text-text-muted mb-1">기관/단체</p>
                  <p className="text-sm font-medium">{selectedReservation.organization}</p>
                </div>
              )}
              {selectedReservation.customer_email && (
                <div>
                  <p className="text-xs text-text-muted mb-1">이메일</p>
                  <p className="text-sm font-medium">{selectedReservation.customer_email}</p>
                </div>
              )}
              <div>
                <p className="text-xs text-text-muted mb-1">방문일</p>
                <p className="text-sm font-medium">{selectedReservation.date}</p>
              </div>
              <div>
                <p className="text-xs text-text-muted mb-1">시간</p>
                <p className="text-sm font-medium">{selectedReservation.start_time} - {selectedReservation.end_time}</p>
              </div>
              <div>
                <p className="text-xs text-text-muted mb-1">인원</p>
                <p className="text-sm font-medium">{selectedReservation.visitor_count}명 (성인 {selectedReservation.adult_count} / 아동 {selectedReservation.child_count})</p>
              </div>
              <div>
                <p className="text-xs text-text-muted mb-1">금액</p>
                <p className="text-sm font-bold text-museum-green">{formatCurrency(selectedReservation.payment_amount)}</p>
              </div>
            </div>
            {selectedReservation.notes && (
              <div className="p-3 bg-yellow-50 border border-yellow-200 rounded-lg">
                <p className="text-xs font-medium text-yellow-800 mb-0.5">메모</p>
                <p className="text-sm text-yellow-700">{selectedReservation.notes}</p>
              </div>
            )}
          </div>
        )}
      </Modal>
    </div>
  );
}
