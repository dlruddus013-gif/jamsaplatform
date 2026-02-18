import {
  Shield,
  Users,
  Key,
  Lock,
  Eye,
  EyeOff,
  Plus,
  Edit2,
  Trash2,
  CheckCircle,
  XCircle,
  AlertTriangle,
} from 'lucide-react';
import { useState } from 'react';
import Card from '../common/Card';
import StatusBadge from '../common/StatusBadge';
import Modal from '../common/Modal';

interface Admin {
  id: string;
  name: string;
  email: string;
  role: string;
  department: string;
  status: 'active' | 'inactive';
  lastLogin: string;
  permissions: string[];
}

const admins: Admin[] = [
  {
    id: '1', name: '김관리', email: 'admin@jamsa.museum', role: '최고관리자',
    department: '운영팀', status: 'active', lastLogin: '방금 전',
    permissions: ['전체 관리', '시스템 설정', '데이터 관리'],
  },
  {
    id: '2', name: '이운영', email: 'operation@jamsa.museum', role: '운영관리자',
    department: '운영팀', status: 'active', lastLogin: '1시간 전',
    permissions: ['예약 관리', '일정 관리', '시설 관리'],
  },
  {
    id: '3', name: '박교육', email: 'edu@jamsa.museum', role: '교육담당',
    department: '교육팀', status: 'active', lastLogin: '3시간 전',
    permissions: ['프로그램 관리', '예약 조회'],
  },
  {
    id: '4', name: '최마케팅', email: 'marketing@jamsa.museum', role: '마케팅담당',
    department: '마케팅팀', status: 'active', lastLogin: '어제',
    permissions: ['대행사 관리', '채팅', '통계 조회'],
  },
  {
    id: '5', name: '정직원', email: 'staff@jamsa.museum', role: '일반직원',
    department: '운영팀', status: 'inactive', lastLogin: '1주 전',
    permissions: ['예약 조회', '일정 조회'],
  },
];

const rolePermissions = [
  { role: '최고관리자', description: '모든 기능 접근 가능', level: 5 },
  { role: '운영관리자', description: '예약/시설/일정 관리', level: 4 },
  { role: '교육담당', description: '프로그램/예약 관리', level: 3 },
  { role: '마케팅담당', description: '대행사/채팅/통계', level: 3 },
  { role: '일반직원', description: '조회 전용', level: 1 },
];

export default function AdminTab() {
  const [showAddModal, setShowAddModal] = useState(false);

  return (
    <div className="space-y-4">
      {/* 관리자 목록 */}
      <Card
        title="관리자 계정"
        subtitle={`총 ${admins.length}명의 관리자`}
        action={
          <button
            onClick={() => setShowAddModal(true)}
            className="flex items-center gap-1.5 px-3 py-1.5 text-xs font-medium text-white bg-museum-green rounded-lg hover:bg-museum-green-light transition-colors"
          >
            <Plus className="w-3.5 h-3.5" />
            관리자 추가
          </button>
        }
        padding="none"
      >
        <table className="w-full">
          <thead>
            <tr className="border-b border-border bg-gray-50/50">
              <th className="text-left px-4 py-2.5 text-xs font-semibold text-text-muted">이름</th>
              <th className="text-left px-4 py-2.5 text-xs font-semibold text-text-muted">이메일</th>
              <th className="text-left px-4 py-2.5 text-xs font-semibold text-text-muted">역할</th>
              <th className="text-left px-4 py-2.5 text-xs font-semibold text-text-muted">부서</th>
              <th className="text-center px-4 py-2.5 text-xs font-semibold text-text-muted">상태</th>
              <th className="text-right px-4 py-2.5 text-xs font-semibold text-text-muted">마지막 로그인</th>
              <th className="text-center px-4 py-2.5 text-xs font-semibold text-text-muted">관리</th>
            </tr>
          </thead>
          <tbody>
            {admins.map((admin) => (
              <tr key={admin.id} className="border-b border-border hover:bg-gray-50 transition-colors">
                <td className="px-4 py-3">
                  <div className="flex items-center gap-2">
                    <div className="w-8 h-8 rounded-full bg-museum-green/10 text-museum-green flex items-center justify-center text-xs font-bold">
                      {admin.name.charAt(0)}
                    </div>
                    <span className="text-sm font-medium">{admin.name}</span>
                  </div>
                </td>
                <td className="px-4 py-3 text-sm text-text-secondary">{admin.email}</td>
                <td className="px-4 py-3">
                  <div className="flex items-center gap-1.5">
                    <Shield className="w-3.5 h-3.5 text-silk-gold" />
                    <span className="text-sm">{admin.role}</span>
                  </div>
                </td>
                <td className="px-4 py-3 text-sm text-text-secondary">{admin.department}</td>
                <td className="px-4 py-3 text-center">
                  <StatusBadge
                    status={admin.status}
                    label={admin.status === 'active' ? '활성' : '비활성'}
                  />
                </td>
                <td className="px-4 py-3 text-sm text-right text-text-muted">{admin.lastLogin}</td>
                <td className="px-4 py-3">
                  <div className="flex items-center justify-center gap-1">
                    <button className="p-1.5 hover:bg-gray-100 rounded-lg transition-colors">
                      <Edit2 className="w-3.5 h-3.5 text-text-secondary" />
                    </button>
                    <button className="p-1.5 hover:bg-gray-100 rounded-lg transition-colors">
                      <Key className="w-3.5 h-3.5 text-text-secondary" />
                    </button>
                    <button className="p-1.5 hover:bg-red-50 rounded-lg transition-colors">
                      <Trash2 className="w-3.5 h-3.5 text-danger" />
                    </button>
                  </div>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </Card>

      {/* 역할/권한 관리 */}
      <Card title="역할 및 권한" subtitle="역할별 접근 권한 설정">
        <div className="space-y-3">
          {rolePermissions.map((rp) => (
            <div key={rp.role} className="flex items-center justify-between p-3 border border-border rounded-xl hover:bg-gray-50 transition-colors">
              <div className="flex items-center gap-3">
                <div className="w-9 h-9 rounded-lg bg-silk-gold/10 text-silk-gold flex items-center justify-center">
                  <Shield className="w-4.5 h-4.5" />
                </div>
                <div>
                  <p className="text-sm font-medium">{rp.role}</p>
                  <p className="text-xs text-text-muted">{rp.description}</p>
                </div>
              </div>
              <div className="flex items-center gap-3">
                <div className="flex">
                  {Array.from({ length: 5 }).map((_, i) => (
                    <div
                      key={i}
                      className={`w-2.5 h-2.5 rounded-full mx-0.5 ${
                        i < rp.level ? 'bg-silk-gold' : 'bg-gray-200'
                      }`}
                    />
                  ))}
                </div>
                <button className="text-xs text-museum-green hover:underline">수정</button>
              </div>
            </div>
          ))}
        </div>
      </Card>

      {/* 보안 설정 */}
      <Card title="보안 설정" subtitle="시스템 보안 정책 관리">
        <div className="space-y-3">
          {[
            { label: '2단계 인증 (2FA)', description: '모든 관리자에게 2FA를 강제합니다.', enabled: true },
            { label: '세션 타임아웃', description: '비활성 30분 후 자동 로그아웃합니다.', enabled: true },
            { label: 'IP 화이트리스트', description: '허용된 IP에서만 접근 가능합니다.', enabled: false },
            { label: '비밀번호 정책', description: '8자 이상, 특수문자 포함 필수입니다.', enabled: true },
            { label: '로그인 시도 제한', description: '5회 실패 시 계정을 일시 잠금합니다.', enabled: true },
          ].map((setting) => (
            <div key={setting.label} className="flex items-center justify-between p-3 border border-border rounded-xl">
              <div className="flex items-center gap-3">
                <Lock className="w-4 h-4 text-text-muted" />
                <div>
                  <p className="text-sm font-medium">{setting.label}</p>
                  <p className="text-xs text-text-muted">{setting.description}</p>
                </div>
              </div>
              <button
                className={`relative w-11 h-6 rounded-full transition-colors ${
                  setting.enabled ? 'bg-museum-green' : 'bg-gray-300'
                }`}
              >
                <div
                  className={`absolute top-1 w-4 h-4 bg-white rounded-full shadow transition-transform ${
                    setting.enabled ? 'left-6' : 'left-1'
                  }`}
                />
              </button>
            </div>
          ))}
        </div>
      </Card>

      {/* 관리자 추가 모달 */}
      <Modal
        isOpen={showAddModal}
        onClose={() => setShowAddModal(false)}
        title="관리자 추가"
        subtitle="새 관리자 계정을 생성합니다"
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
              <label className="block text-xs font-medium text-text-secondary mb-1">이름 *</label>
              <input type="text" className="w-full px-3 py-2 text-sm border border-border rounded-lg focus:outline-none focus:ring-2 focus:ring-museum-green/20" />
            </div>
            <div>
              <label className="block text-xs font-medium text-text-secondary mb-1">이메일 *</label>
              <input type="email" className="w-full px-3 py-2 text-sm border border-border rounded-lg focus:outline-none focus:ring-2 focus:ring-museum-green/20" />
            </div>
            <div>
              <label className="block text-xs font-medium text-text-secondary mb-1">역할 *</label>
              <select className="w-full px-3 py-2 text-sm border border-border rounded-lg focus:outline-none focus:ring-2 focus:ring-museum-green/20">
                {rolePermissions.map((rp) => (
                  <option key={rp.role} value={rp.role}>{rp.role}</option>
                ))}
              </select>
            </div>
            <div>
              <label className="block text-xs font-medium text-text-secondary mb-1">부서 *</label>
              <select className="w-full px-3 py-2 text-sm border border-border rounded-lg focus:outline-none focus:ring-2 focus:ring-museum-green/20">
                <option>운영팀</option>
                <option>교육팀</option>
                <option>마케팅팀</option>
                <option>관리팀</option>
              </select>
            </div>
          </div>
        </div>
      </Modal>
    </div>
  );
}
