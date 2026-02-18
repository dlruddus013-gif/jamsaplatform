import {
  Plus,
  Search,
  MapPin,
  Users,
  Clock,
  Edit2,
  Trash2,
  MoreVertical,
  Building,
  Filter,
  Grid,
  List,
} from 'lucide-react';
import { useState } from 'react';
import Card from '../common/Card';
import StatusBadge from '../common/StatusBadge';
import Modal from '../common/Modal';
import type { Facility, FacilityType, FacilityStatus } from '../../types';

const mockFacilities: Facility[] = [
  {
    id: '1',
    name: '제1전시관',
    type: 'exhibition',
    capacity: 100,
    location: '본관 1층',
    floor: '1층',
    status: 'active',
    description: '잠사 역사와 실크 문화를 전시하는 상설 전시관입니다.',
    equipment: ['프로젝터', '음향시스템', '조명', 'CCTV'],
    operating_hours: {
      weekday: { open: '09:00', close: '18:00' },
      weekend: { open: '10:00', close: '17:00' },
      holiday: null,
    },
    created_at: '2024-01-01T00:00:00Z',
    updated_at: '2026-02-10T00:00:00Z',
  },
  {
    id: '2',
    name: '체험교실 A',
    type: 'experience',
    capacity: 30,
    location: '별관 1층',
    floor: '1층',
    status: 'active',
    description: '누에고치 공예 및 실크 염색 체험을 위한 교실입니다.',
    equipment: ['작업대', '염색도구', '건조기', '세면대'],
    operating_hours: {
      weekday: { open: '09:30', close: '17:30' },
      weekend: { open: '10:00', close: '16:00' },
      holiday: null,
    },
    created_at: '2024-01-01T00:00:00Z',
    updated_at: '2026-02-08T00:00:00Z',
  },
  {
    id: '3',
    name: '체험교실 B',
    type: 'experience',
    capacity: 25,
    location: '별관 2층',
    floor: '2층',
    status: 'maintenance',
    description: '전통 직조 및 견직물 만들기 체험 교실입니다.',
    equipment: ['직조기', '작업대', '재봉틀', '재료 보관함'],
    operating_hours: {
      weekday: { open: '09:30', close: '17:30' },
      weekend: { open: '10:00', close: '16:00' },
      holiday: null,
    },
    created_at: '2024-03-01T00:00:00Z',
    updated_at: '2026-02-12T00:00:00Z',
  },
  {
    id: '4',
    name: '야외체험장',
    type: 'outdoor',
    capacity: 80,
    location: '야외',
    floor: '야외',
    status: 'active',
    description: '뽕나무 밭과 누에 사육장을 관찰할 수 있는 야외 체험 공간입니다.',
    equipment: ['텐트', '벤치', '음향시스템', '화장실'],
    operating_hours: {
      weekday: { open: '09:00', close: '18:00' },
      weekend: { open: '09:00', close: '18:00' },
      holiday: null,
    },
    created_at: '2024-04-01T00:00:00Z',
    updated_at: '2026-01-20T00:00:00Z',
  },
  {
    id: '5',
    name: '세미나실',
    type: 'meeting',
    capacity: 40,
    location: '본관 2층',
    floor: '2층',
    status: 'active',
    description: '회의 및 교육 세미나를 위한 다목적 공간입니다.',
    equipment: ['빔프로젝터', '화이트보드', '마이크', '노트북 연결기'],
    operating_hours: {
      weekday: { open: '09:00', close: '18:00' },
      weekend: { open: '10:00', close: '17:00' },
      holiday: null,
    },
    created_at: '2024-02-01T00:00:00Z',
    updated_at: '2026-02-05T00:00:00Z',
  },
  {
    id: '6',
    name: '교육관',
    type: 'education',
    capacity: 60,
    location: '본관 3층',
    floor: '3층',
    status: 'active',
    description: '단체 교육 프로그램 진행을 위한 대형 교육 시설입니다.',
    equipment: ['대형스크린', '음향시스템', '조명', '녹화장비'],
    operating_hours: {
      weekday: { open: '09:00', close: '18:00' },
      weekend: { open: '10:00', close: '17:00' },
      holiday: null,
    },
    created_at: '2024-01-15T00:00:00Z',
    updated_at: '2026-02-11T00:00:00Z',
  },
];

const facilityTypeLabels: Record<FacilityType, string> = {
  exhibition: '전시',
  experience: '체험',
  education: '교육',
  event: '행사',
  meeting: '회의',
  outdoor: '야외',
};

const facilityStatusLabels: Record<FacilityStatus, string> = {
  active: '운영중',
  maintenance: '점검중',
  closed: '폐쇄',
  reserved: '예약됨',
};

export default function FacilityTab() {
  const [viewMode, setViewMode] = useState<'grid' | 'list'>('grid');
  const [searchQuery, setSearchQuery] = useState('');
  const [statusFilter, setStatusFilter] = useState<string>('all');
  const [typeFilter, setTypeFilter] = useState<string>('all');
  const [showAddModal, setShowAddModal] = useState(false);
  const [selectedFacility, setSelectedFacility] = useState<Facility | null>(null);

  const filteredFacilities = mockFacilities.filter((facility) => {
    if (statusFilter !== 'all' && facility.status !== statusFilter) return false;
    if (typeFilter !== 'all' && facility.type !== typeFilter) return false;
    if (searchQuery && !facility.name.includes(searchQuery) && !facility.location.includes(searchQuery))
      return false;
    return true;
  });

  return (
    <div className="space-y-4">
      {/* 필터 및 검색 */}
      <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-3">
        <div className="flex items-center gap-2 flex-wrap">
          <div className="relative">
            <Search className="w-4 h-4 absolute left-3 top-1/2 -translate-y-1/2 text-text-muted" />
            <input
              type="text"
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              placeholder="시설명 또는 위치 검색"
              className="pl-9 pr-4 py-2 text-sm border border-border rounded-lg bg-white focus:outline-none focus:ring-2 focus:ring-museum-green/20 focus:border-museum-green w-60"
            />
          </div>
          <select
            value={statusFilter}
            onChange={(e) => setStatusFilter(e.target.value)}
            className="px-3 py-2 text-sm border border-border rounded-lg bg-white focus:outline-none focus:ring-2 focus:ring-museum-green/20"
          >
            <option value="all">전체 상태</option>
            <option value="active">운영중</option>
            <option value="maintenance">점검중</option>
            <option value="closed">폐쇄</option>
          </select>
          <select
            value={typeFilter}
            onChange={(e) => setTypeFilter(e.target.value)}
            className="px-3 py-2 text-sm border border-border rounded-lg bg-white focus:outline-none focus:ring-2 focus:ring-museum-green/20"
          >
            <option value="all">전체 유형</option>
            <option value="exhibition">전시</option>
            <option value="experience">체험</option>
            <option value="education">교육</option>
            <option value="meeting">회의</option>
            <option value="outdoor">야외</option>
          </select>
        </div>
        <div className="flex items-center gap-2">
          <div className="flex bg-gray-100 rounded-lg p-0.5">
            <button
              onClick={() => setViewMode('grid')}
              className={`p-1.5 rounded-md transition-colors ${
                viewMode === 'grid' ? 'bg-white shadow-sm' : 'hover:bg-gray-200'
              }`}
            >
              <Grid className="w-4 h-4 text-text-secondary" />
            </button>
            <button
              onClick={() => setViewMode('list')}
              className={`p-1.5 rounded-md transition-colors ${
                viewMode === 'list' ? 'bg-white shadow-sm' : 'hover:bg-gray-200'
              }`}
            >
              <List className="w-4 h-4 text-text-secondary" />
            </button>
          </div>
          <button
            onClick={() => setShowAddModal(true)}
            className="flex items-center gap-1.5 px-3 py-2 text-sm font-medium text-white bg-museum-green rounded-lg hover:bg-museum-green-light transition-colors shadow-sm"
          >
            <Plus className="w-4 h-4" />
            시설 추가
          </button>
        </div>
      </div>

      {/* 시설 그리드 */}
      {viewMode === 'grid' ? (
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
          {filteredFacilities.map((facility) => (
            <div
              key={facility.id}
              onClick={() => setSelectedFacility(facility)}
              className="bg-card-bg border border-border rounded-xl overflow-hidden card-hover cursor-pointer"
            >
              <div
                className={`h-32 flex items-center justify-center ${
                  facility.type === 'exhibition'
                    ? 'bg-gradient-to-br from-purple-100 to-purple-50'
                    : facility.type === 'experience'
                    ? 'bg-gradient-to-br from-blue-100 to-blue-50'
                    : facility.type === 'education'
                    ? 'bg-gradient-to-br from-green-100 to-green-50'
                    : facility.type === 'outdoor'
                    ? 'bg-gradient-to-br from-emerald-100 to-emerald-50'
                    : 'bg-gradient-to-br from-gray-100 to-gray-50'
                }`}
              >
                <Building className="w-12 h-12 text-gray-300" />
              </div>
              <div className="p-4">
                <div className="flex items-start justify-between">
                  <div>
                    <h3 className="text-sm font-bold">{facility.name}</h3>
                    <p className="text-xs text-text-muted mt-0.5">
                      {facilityTypeLabels[facility.type]}
                    </p>
                  </div>
                  <StatusBadge
                    status={facility.status}
                    label={facilityStatusLabels[facility.status]}
                  />
                </div>
                <div className="mt-3 space-y-1.5">
                  <div className="flex items-center gap-1.5 text-xs text-text-secondary">
                    <MapPin className="w-3.5 h-3.5" />
                    {facility.location}
                  </div>
                  <div className="flex items-center gap-1.5 text-xs text-text-secondary">
                    <Users className="w-3.5 h-3.5" />
                    최대 {facility.capacity}명
                  </div>
                  <div className="flex items-center gap-1.5 text-xs text-text-secondary">
                    <Clock className="w-3.5 h-3.5" />
                    {facility.operating_hours.weekday.open} - {facility.operating_hours.weekday.close}
                  </div>
                </div>
              </div>
            </div>
          ))}
        </div>
      ) : (
        <Card padding="none">
          <table className="w-full">
            <thead>
              <tr className="border-b border-border bg-gray-50/50">
                <th className="text-left px-4 py-3 text-xs font-semibold text-text-muted">시설명</th>
                <th className="text-left px-4 py-3 text-xs font-semibold text-text-muted">유형</th>
                <th className="text-left px-4 py-3 text-xs font-semibold text-text-muted">위치</th>
                <th className="text-center px-4 py-3 text-xs font-semibold text-text-muted">수용인원</th>
                <th className="text-center px-4 py-3 text-xs font-semibold text-text-muted">운영시간</th>
                <th className="text-center px-4 py-3 text-xs font-semibold text-text-muted">상태</th>
                <th className="text-center px-4 py-3 text-xs font-semibold text-text-muted">관리</th>
              </tr>
            </thead>
            <tbody>
              {filteredFacilities.map((facility) => (
                <tr
                  key={facility.id}
                  className="border-b border-border hover:bg-gray-50 transition-colors cursor-pointer"
                  onClick={() => setSelectedFacility(facility)}
                >
                  <td className="px-4 py-3">
                    <p className="text-sm font-medium">{facility.name}</p>
                  </td>
                  <td className="px-4 py-3 text-sm text-text-secondary">
                    {facilityTypeLabels[facility.type]}
                  </td>
                  <td className="px-4 py-3 text-sm text-text-secondary">{facility.location}</td>
                  <td className="px-4 py-3 text-sm text-center">{facility.capacity}명</td>
                  <td className="px-4 py-3 text-sm text-center text-text-secondary">
                    {facility.operating_hours.weekday.open}-{facility.operating_hours.weekday.close}
                  </td>
                  <td className="px-4 py-3 text-center">
                    <StatusBadge
                      status={facility.status}
                      label={facilityStatusLabels[facility.status]}
                    />
                  </td>
                  <td className="px-4 py-3 text-center">
                    <div className="flex items-center justify-center gap-1">
                      <button
                        className="p-1.5 hover:bg-gray-100 rounded-lg transition-colors"
                        onClick={(e) => e.stopPropagation()}
                      >
                        <Edit2 className="w-3.5 h-3.5 text-text-secondary" />
                      </button>
                      <button
                        className="p-1.5 hover:bg-red-50 rounded-lg transition-colors"
                        onClick={(e) => e.stopPropagation()}
                      >
                        <Trash2 className="w-3.5 h-3.5 text-danger" />
                      </button>
                    </div>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </Card>
      )}

      {/* 시설 상세 모달 */}
      <Modal
        isOpen={!!selectedFacility}
        onClose={() => setSelectedFacility(null)}
        title={selectedFacility?.name || ''}
        subtitle={selectedFacility ? facilityTypeLabels[selectedFacility.type] : ''}
        size="lg"
        footer={
          <>
            <button
              onClick={() => setSelectedFacility(null)}
              className="px-4 py-2 text-sm text-text-secondary bg-gray-100 rounded-lg hover:bg-gray-200 transition-colors"
            >
              닫기
            </button>
            <button className="px-4 py-2 text-sm text-white bg-museum-green rounded-lg hover:bg-museum-green-light transition-colors">
              수정
            </button>
          </>
        }
      >
        {selectedFacility && (
          <div className="space-y-4">
            <div className="grid grid-cols-2 gap-4">
              <div>
                <p className="text-xs text-text-muted mb-1">위치</p>
                <p className="text-sm font-medium">{selectedFacility.location}</p>
              </div>
              <div>
                <p className="text-xs text-text-muted mb-1">수용인원</p>
                <p className="text-sm font-medium">{selectedFacility.capacity}명</p>
              </div>
              <div>
                <p className="text-xs text-text-muted mb-1">평일 운영시간</p>
                <p className="text-sm font-medium">
                  {selectedFacility.operating_hours.weekday.open} - {selectedFacility.operating_hours.weekday.close}
                </p>
              </div>
              <div>
                <p className="text-xs text-text-muted mb-1">주말 운영시간</p>
                <p className="text-sm font-medium">
                  {selectedFacility.operating_hours.weekend.open} - {selectedFacility.operating_hours.weekend.close}
                </p>
              </div>
            </div>
            <div>
              <p className="text-xs text-text-muted mb-1">설명</p>
              <p className="text-sm text-text-secondary">{selectedFacility.description}</p>
            </div>
            <div>
              <p className="text-xs text-text-muted mb-2">장비/설비</p>
              <div className="flex flex-wrap gap-1.5">
                {selectedFacility.equipment.map((item) => (
                  <span
                    key={item}
                    className="px-2.5 py-1 bg-gray-100 text-xs text-text-secondary rounded-full"
                  >
                    {item}
                  </span>
                ))}
              </div>
            </div>
          </div>
        )}
      </Modal>

      {/* 시설 추가 모달 */}
      <Modal
        isOpen={showAddModal}
        onClose={() => setShowAddModal(false)}
        title="새 시설 추가"
        subtitle="시설 정보를 입력하세요"
        size="lg"
        footer={
          <>
            <button
              onClick={() => setShowAddModal(false)}
              className="px-4 py-2 text-sm text-text-secondary bg-gray-100 rounded-lg hover:bg-gray-200 transition-colors"
            >
              취소
            </button>
            <button className="px-4 py-2 text-sm text-white bg-museum-green rounded-lg hover:bg-museum-green-light transition-colors">
              추가
            </button>
          </>
        }
      >
        <div className="space-y-4">
          <div className="grid grid-cols-2 gap-4">
            <div>
              <label className="block text-xs font-medium text-text-secondary mb-1">시설명 *</label>
              <input
                type="text"
                placeholder="예: 제2전시관"
                className="w-full px-3 py-2 text-sm border border-border rounded-lg focus:outline-none focus:ring-2 focus:ring-museum-green/20 focus:border-museum-green"
              />
            </div>
            <div>
              <label className="block text-xs font-medium text-text-secondary mb-1">유형 *</label>
              <select className="w-full px-3 py-2 text-sm border border-border rounded-lg focus:outline-none focus:ring-2 focus:ring-museum-green/20">
                <option value="exhibition">전시</option>
                <option value="experience">체험</option>
                <option value="education">교육</option>
                <option value="event">행사</option>
                <option value="meeting">회의</option>
                <option value="outdoor">야외</option>
              </select>
            </div>
            <div>
              <label className="block text-xs font-medium text-text-secondary mb-1">위치 *</label>
              <input
                type="text"
                placeholder="예: 본관 2층"
                className="w-full px-3 py-2 text-sm border border-border rounded-lg focus:outline-none focus:ring-2 focus:ring-museum-green/20 focus:border-museum-green"
              />
            </div>
            <div>
              <label className="block text-xs font-medium text-text-secondary mb-1">수용인원 *</label>
              <input
                type="number"
                placeholder="30"
                className="w-full px-3 py-2 text-sm border border-border rounded-lg focus:outline-none focus:ring-2 focus:ring-museum-green/20 focus:border-museum-green"
              />
            </div>
          </div>
          <div>
            <label className="block text-xs font-medium text-text-secondary mb-1">설명</label>
            <textarea
              rows={3}
              placeholder="시설에 대한 설명을 입력하세요"
              className="w-full px-3 py-2 text-sm border border-border rounded-lg focus:outline-none focus:ring-2 focus:ring-museum-green/20 focus:border-museum-green resize-none"
            />
          </div>
        </div>
      </Modal>
    </div>
  );
}
