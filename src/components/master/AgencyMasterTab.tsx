import {
  Plus,
  Search,
  Edit2,
  Trash2,
  Phone,
  Mail,
  Building2,
  BarChart3,
  DollarSign,
  Calendar,
  FileText,
  TrendingUp,
} from 'lucide-react';
import { useState } from 'react';
import Card from '../common/Card';
import StatusBadge from '../common/StatusBadge';
import Modal from '../common/Modal';
import { formatCurrency } from '../../utils/format';
import type { Agency } from '../../types';

const mockAgencies: Agency[] = [
  {
    id: '1', name: '행복투어', business_number: '123-45-67890',
    contact_person: '김행복', phone: '02-1234-5678', email: 'happy@tour.com',
    address: '서울시 종로구', commission_rate: 10, status: 'active',
    contract_start: '2025-01-01', contract_end: '2025-12-31',
    total_reservations: 156, total_revenue: 23400000,
    created_at: '2025-01-01T00:00:00Z', updated_at: '2026-02-10T00:00:00Z',
  },
  {
    id: '2', name: '교육나라', business_number: '234-56-78901',
    contact_person: '이교육', phone: '02-2345-6789', email: 'edu@nara.com',
    address: '경기도 수원시', commission_rate: 8, status: 'active',
    contract_start: '2025-03-01', contract_end: '2026-02-28',
    total_reservations: 89, total_revenue: 15680000,
    created_at: '2025-03-01T00:00:00Z', updated_at: '2026-02-08T00:00:00Z',
  },
  {
    id: '3', name: '신나는 여행', business_number: '345-67-89012',
    contact_person: '박여행', phone: '031-3456-7890', email: 'fun@travel.com',
    address: '인천시 남동구', commission_rate: 12, status: 'active',
    contract_start: '2025-06-01', contract_end: '2026-05-31',
    total_reservations: 45, total_revenue: 8100000,
    created_at: '2025-06-01T00:00:00Z', updated_at: '2026-01-30T00:00:00Z',
  },
  {
    id: '4', name: '문화체험센터', business_number: '456-78-90123',
    contact_person: '최문화', phone: '02-4567-8901', email: 'culture@center.com',
    address: '서울시 강남구', commission_rate: 10, status: 'inactive',
    contract_start: '2024-06-01', contract_end: '2025-05-31',
    total_reservations: 23, total_revenue: 4140000,
    notes: '계약 만료 - 갱신 협의 중',
    created_at: '2024-06-01T00:00:00Z', updated_at: '2025-05-31T00:00:00Z',
  },
];

export default function AgencyMasterTab() {
  const [searchQuery, setSearchQuery] = useState('');
  const [showAddModal, setShowAddModal] = useState(false);
  const [selectedAgency, setSelectedAgency] = useState<Agency | null>(null);

  const filteredAgencies = mockAgencies.filter(
    (a) => a.name.includes(searchQuery) || a.contact_person.includes(searchQuery)
  );

  return (
    <div className="space-y-4">
      {/* 통계 요약 */}
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
        <div className="bg-card-bg border border-border rounded-xl p-4">
          <div className="flex items-center gap-2 mb-2">
            <Building2 className="w-4 h-4 text-text-muted" />
            <span className="text-xs text-text-muted">전체 대행사</span>
          </div>
          <p className="text-xl font-bold">{mockAgencies.length}곳</p>
        </div>
        <div className="bg-card-bg border border-border rounded-xl p-4">
          <div className="flex items-center gap-2 mb-2">
            <BarChart3 className="w-4 h-4 text-text-muted" />
            <span className="text-xs text-text-muted">총 예약</span>
          </div>
          <p className="text-xl font-bold">{mockAgencies.reduce((s, a) => s + a.total_reservations, 0)}건</p>
        </div>
        <div className="bg-card-bg border border-border rounded-xl p-4">
          <div className="flex items-center gap-2 mb-2">
            <DollarSign className="w-4 h-4 text-text-muted" />
            <span className="text-xs text-text-muted">총 매출</span>
          </div>
          <p className="text-xl font-bold text-sm mt-1">
            {formatCurrency(mockAgencies.reduce((s, a) => s + a.total_revenue, 0))}
          </p>
        </div>
        <div className="bg-card-bg border border-border rounded-xl p-4">
          <div className="flex items-center gap-2 mb-2">
            <TrendingUp className="w-4 h-4 text-text-muted" />
            <span className="text-xs text-text-muted">활성 대행사</span>
          </div>
          <p className="text-xl font-bold">{mockAgencies.filter((a) => a.status === 'active').length}곳</p>
        </div>
      </div>

      {/* 대행사 목록 */}
      <Card
        title="대행사 목록"
        action={
          <div className="flex items-center gap-2">
            <div className="relative">
              <Search className="w-4 h-4 absolute left-3 top-1/2 -translate-y-1/2 text-text-muted" />
              <input
                type="text"
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                placeholder="대행사/담당자 검색"
                className="pl-9 pr-4 py-1.5 text-xs border border-border rounded-lg w-48 focus:outline-none focus:ring-2 focus:ring-museum-green/20"
              />
            </div>
            <button
              onClick={() => setShowAddModal(true)}
              className="flex items-center gap-1.5 px-3 py-1.5 text-xs font-medium text-white bg-museum-green rounded-lg hover:bg-museum-green-light transition-colors"
            >
              <Plus className="w-3.5 h-3.5" />
              대행사 추가
            </button>
          </div>
        }
        padding="none"
      >
        <table className="w-full">
          <thead>
            <tr className="border-b border-border bg-gray-50/50">
              <th className="text-left px-4 py-2.5 text-xs font-semibold text-text-muted">대행사</th>
              <th className="text-left px-4 py-2.5 text-xs font-semibold text-text-muted">담당자</th>
              <th className="text-center px-4 py-2.5 text-xs font-semibold text-text-muted">수수료</th>
              <th className="text-right px-4 py-2.5 text-xs font-semibold text-text-muted">총 예약</th>
              <th className="text-right px-4 py-2.5 text-xs font-semibold text-text-muted">총 매출</th>
              <th className="text-center px-4 py-2.5 text-xs font-semibold text-text-muted">계약기간</th>
              <th className="text-center px-4 py-2.5 text-xs font-semibold text-text-muted">상태</th>
              <th className="text-center px-4 py-2.5 text-xs font-semibold text-text-muted">관리</th>
            </tr>
          </thead>
          <tbody>
            {filteredAgencies.map((agency) => (
              <tr
                key={agency.id}
                className="border-b border-border hover:bg-gray-50 transition-colors cursor-pointer"
                onClick={() => setSelectedAgency(agency)}
              >
                <td className="px-4 py-3">
                  <p className="text-sm font-medium">{agency.name}</p>
                  <p className="text-[11px] text-text-muted">{agency.business_number}</p>
                </td>
                <td className="px-4 py-3">
                  <p className="text-sm">{agency.contact_person}</p>
                  <p className="text-[11px] text-text-muted">{agency.phone}</p>
                </td>
                <td className="px-4 py-3 text-sm text-center">{agency.commission_rate}%</td>
                <td className="px-4 py-3 text-sm text-right font-medium">{agency.total_reservations}건</td>
                <td className="px-4 py-3 text-sm text-right">{formatCurrency(agency.total_revenue)}</td>
                <td className="px-4 py-3 text-xs text-center text-text-muted">
                  {agency.contract_start} ~ {agency.contract_end}
                </td>
                <td className="px-4 py-3 text-center">
                  <StatusBadge
                    status={agency.status}
                    label={agency.status === 'active' ? '활성' : agency.status === 'inactive' ? '비활성' : '대기'}
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
      </Card>

      {/* 상세 모달 */}
      <Modal
        isOpen={!!selectedAgency}
        onClose={() => setSelectedAgency(null)}
        title={selectedAgency?.name || ''}
        subtitle="대행사 상세 정보"
        size="lg"
        footer={
          <>
            <button onClick={() => setSelectedAgency(null)} className="px-4 py-2 text-sm text-text-secondary bg-gray-100 rounded-lg hover:bg-gray-200 transition-colors">닫기</button>
            <button className="px-4 py-2 text-sm text-white bg-museum-green rounded-lg hover:bg-museum-green-light transition-colors">수정</button>
          </>
        }
      >
        {selectedAgency && (
          <div className="space-y-4">
            <div className="grid grid-cols-2 gap-4">
              <div>
                <p className="text-xs text-text-muted mb-1">사업자번호</p>
                <p className="text-sm font-medium">{selectedAgency.business_number}</p>
              </div>
              <div>
                <p className="text-xs text-text-muted mb-1">담당자</p>
                <p className="text-sm font-medium">{selectedAgency.contact_person}</p>
              </div>
              <div>
                <p className="text-xs text-text-muted mb-1">연락처</p>
                <p className="text-sm font-medium">{selectedAgency.phone}</p>
              </div>
              <div>
                <p className="text-xs text-text-muted mb-1">이메일</p>
                <p className="text-sm font-medium">{selectedAgency.email}</p>
              </div>
              <div>
                <p className="text-xs text-text-muted mb-1">주소</p>
                <p className="text-sm font-medium">{selectedAgency.address}</p>
              </div>
              <div>
                <p className="text-xs text-text-muted mb-1">수수료율</p>
                <p className="text-sm font-medium">{selectedAgency.commission_rate}%</p>
              </div>
            </div>
            {selectedAgency.notes && (
              <div className="p-3 bg-yellow-50 border border-yellow-200 rounded-lg">
                <p className="text-xs text-yellow-800">{selectedAgency.notes}</p>
              </div>
            )}
          </div>
        )}
      </Modal>

      {/* 추가 모달 */}
      <Modal
        isOpen={showAddModal}
        onClose={() => setShowAddModal(false)}
        title="대행사 추가"
        footer={
          <>
            <button onClick={() => setShowAddModal(false)} className="px-4 py-2 text-sm text-text-secondary bg-gray-100 rounded-lg hover:bg-gray-200 transition-colors">취소</button>
            <button className="px-4 py-2 text-sm text-white bg-museum-green rounded-lg hover:bg-museum-green-light transition-colors">추가</button>
          </>
        }
      >
        <div className="space-y-4">
          <div className="grid grid-cols-2 gap-4">
            <div>
              <label className="block text-xs font-medium text-text-secondary mb-1">대행사명 *</label>
              <input type="text" className="w-full px-3 py-2 text-sm border border-border rounded-lg focus:outline-none focus:ring-2 focus:ring-museum-green/20" />
            </div>
            <div>
              <label className="block text-xs font-medium text-text-secondary mb-1">사업자번호 *</label>
              <input type="text" className="w-full px-3 py-2 text-sm border border-border rounded-lg focus:outline-none focus:ring-2 focus:ring-museum-green/20" />
            </div>
            <div>
              <label className="block text-xs font-medium text-text-secondary mb-1">담당자명 *</label>
              <input type="text" className="w-full px-3 py-2 text-sm border border-border rounded-lg focus:outline-none focus:ring-2 focus:ring-museum-green/20" />
            </div>
            <div>
              <label className="block text-xs font-medium text-text-secondary mb-1">수수료율 (%)</label>
              <input type="number" defaultValue={10} className="w-full px-3 py-2 text-sm border border-border rounded-lg focus:outline-none focus:ring-2 focus:ring-museum-green/20" />
            </div>
          </div>
        </div>
      </Modal>
    </div>
  );
}
