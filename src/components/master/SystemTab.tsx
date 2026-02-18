import {
  Download,
  RefreshCw,
  RotateCcw,
  Play,
  FileText,
  CheckCircle,
  Clock,
  Package,
  HardDrive,
  AlertTriangle,
  ChevronRight,
  Shield,
  Database,
  Zap,
  Bug,
  Wrench,
  TrendingUp,
  Terminal,
  Eye,
} from 'lucide-react';
import { useState } from 'react';
import Card from '../common/Card';
import StatusBadge from '../common/StatusBadge';
import Modal from '../common/Modal';
import { useSystemStore } from '../../stores/appStore';
import { formatDateTime } from '../../utils/format';

export default function SystemTab() {
  const {
    currentVersion,
    buildNumber,
    patches,
    moduleCount,
    storageUsed,
  } = useSystemStore();

  const [showLogModal, setShowLogModal] = useState(false);
  const [selectedPatchId, setSelectedPatchId] = useState<string | null>(null);
  const [showUpdateHistory, setShowUpdateHistory] = useState(false);

  const pendingUpdates = 0;
  const appliedUpdates = 6;

  const patchTypeIcons: Record<string, typeof Bug> = {
    bugfix: Bug,
    hotfix: AlertTriangle,
    improvement: TrendingUp,
  };

  const patchTypeLabels: Record<string, string> = {
    bugfix: '버그 수정',
    hotfix: '긴급 패치',
    improvement: '개선',
  };

  // 업데이트 히스토리 데이터
  const updateHistory = [
    {
      version: 'v2.10.0',
      date: '2026-02-13',
      type: 'update' as const,
      status: 'applied' as const,
      changes: [
        '예약 시스템 성능 개선',
        '대행사 관리 모듈 추가',
        '캘린더 뷰 개선',
        'UI/UX 전반적 개선',
      ],
    },
    {
      version: 'v2.9.2',
      date: '2026-02-01',
      type: 'patch' as const,
      status: 'applied' as const,
      changes: ['예약 취소 정책 버그 수정', '알림 발송 안정화'],
    },
    {
      version: 'v2.9.1',
      date: '2026-01-25',
      type: 'patch' as const,
      status: 'applied' as const,
      changes: ['결제 모듈 오류 수정', 'CSV 내보내기 인코딩 수정'],
    },
    {
      version: 'v2.9.0',
      date: '2026-01-15',
      type: 'update' as const,
      status: 'applied' as const,
      changes: [
        '채팅 시스템 도입',
        '일정표 모듈 추가',
        'KakaoTalk 알림톡 연동',
        '다국어 지원 기반 마련',
      ],
    },
    {
      version: 'v2.8.0',
      date: '2025-12-20',
      type: 'update' as const,
      status: 'applied' as const,
      changes: ['대시보드 통계 차트 추가', '프로그램 관리 기능 개선', '검색 기능 강화'],
    },
    {
      version: 'v2.7.0',
      date: '2025-11-30',
      type: 'update' as const,
      status: 'applied' as const,
      changes: ['시설 관리 모듈 추가', '예약 폼 빌더 도입', 'RLS 보안 정책 강화'],
    },
  ];

  // 시스템 정보 데이터
  const systemModules = [
    { name: '예약 관리', version: '2.10.0', status: 'active' },
    { name: '시설 관리', version: '2.7.0', status: 'active' },
    { name: '대시보드', version: '2.8.0', status: 'active' },
    { name: '채팅', version: '2.9.0', status: 'active' },
    { name: '일정표', version: '2.9.0', status: 'active' },
    { name: '대행사', version: '2.10.0', status: 'active' },
    { name: 'KakaoTalk 연동', version: '2.9.0', status: 'active' },
  ];

  return (
    <div className="space-y-6">
      {/* 시스템 업데이트 & 마이그레이션 */}
      <Card
        title="시스템 업데이트 & 마이그레이션"
        subtitle="시스템 버전 관리 및 데이터 마이그레이션"
        action={
          <div className="flex items-center gap-2">
            <button className="flex items-center gap-1.5 px-3 py-1.5 text-xs font-medium text-museum-green bg-museum-green/10 rounded-lg hover:bg-museum-green/20 transition-colors">
              <RefreshCw className="w-3.5 h-3.5" />
              업데이트 확인
            </button>
            <button
              onClick={() => setShowUpdateHistory(true)}
              className="flex items-center gap-1.5 px-3 py-1.5 text-xs font-medium text-text-secondary bg-gray-100 rounded-lg hover:bg-gray-200 transition-colors"
            >
              <Clock className="w-3.5 h-3.5" />
              히스토리
            </button>
          </div>
        }
      >
        {/* 버전 정보 카드 */}
        <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-5 gap-3 mb-6">
          <div className="bg-gradient-to-br from-museum-green to-museum-green-light rounded-xl p-4 text-white">
            <div className="flex items-center gap-2 mb-2">
              <Shield className="w-4 h-4 opacity-80" />
              <span className="text-xs font-medium opacity-80">현재 버전</span>
            </div>
            <p className="text-xl font-bold">{currentVersion}</p>
            <p className="text-[11px] opacity-70 mt-0.5">{buildNumber}</p>
          </div>

          <div className="bg-white border border-border rounded-xl p-4">
            <div className="flex items-center gap-2 mb-2">
              <Download className="w-4 h-4 text-text-muted" />
              <span className="text-xs font-medium text-text-muted">대기중 업데이트</span>
            </div>
            <p className="text-xl font-bold text-text-primary">{pendingUpdates}</p>
            <p className="text-[11px] text-success mt-0.5">최신 상태</p>
          </div>

          <div className="bg-white border border-border rounded-xl p-4">
            <div className="flex items-center gap-2 mb-2">
              <CheckCircle className="w-4 h-4 text-text-muted" />
              <span className="text-xs font-medium text-text-muted">적용됨</span>
            </div>
            <p className="text-xl font-bold text-text-primary">{appliedUpdates}</p>
            <p className="text-[11px] text-text-muted mt-0.5">누적 업데이트</p>
          </div>

          <div className="bg-white border border-border rounded-xl p-4">
            <div className="flex items-center gap-2 mb-2">
              <Package className="w-4 h-4 text-text-muted" />
              <span className="text-xs font-medium text-text-muted">모듈</span>
            </div>
            <p className="text-xl font-bold text-text-primary">{moduleCount}</p>
            <p className="text-[11px] text-text-muted mt-0.5">활성 모듈</p>
          </div>

          <div className="bg-white border border-border rounded-xl p-4">
            <div className="flex items-center gap-2 mb-2">
              <HardDrive className="w-4 h-4 text-text-muted" />
              <span className="text-xs font-medium text-text-muted">스토리지</span>
            </div>
            <p className="text-xl font-bold text-text-primary">{storageUsed}</p>
            <p className="text-[11px] text-text-muted mt-0.5">사용 중</p>
          </div>
        </div>

        {/* 로컬 패치 목록 */}
        <div>
          <div className="flex items-center justify-between mb-3">
            <div className="flex items-center gap-2">
              <Wrench className="w-4 h-4 text-text-secondary" />
              <h4 className="text-sm font-semibold">로컬 패치</h4>
              <span className="text-xs text-text-muted bg-gray-100 px-2 py-0.5 rounded-full">
                {patches.length}개
              </span>
            </div>
          </div>

          <div className="border border-border rounded-xl overflow-hidden">
            {patches.map((patch, index) => {
              const PatchIcon = patchTypeIcons[patch.type] || Wrench;

              return (
                <div
                  key={patch.id}
                  className={`flex items-center gap-4 px-4 py-3 hover:bg-gray-50 transition-colors ${
                    index < patches.length - 1 ? 'border-b border-border' : ''
                  }`}
                >
                  {/* 패치 아이콘 */}
                  <div
                    className={`w-9 h-9 rounded-lg flex items-center justify-center shrink-0 ${
                      patch.type === 'bugfix'
                        ? 'bg-red-100 text-red-600'
                        : patch.type === 'hotfix'
                        ? 'bg-orange-100 text-orange-600'
                        : 'bg-blue-100 text-blue-600'
                    }`}
                  >
                    <PatchIcon className="w-4.5 h-4.5" />
                  </div>

                  {/* 패치 정보 */}
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2">
                      <p className="text-sm font-medium truncate">{patch.name}</p>
                      <StatusBadge
                        status={patch.type}
                        label={patchTypeLabels[patch.type] || patch.type}
                      />
                    </div>
                    <p className="text-xs text-text-muted mt-0.5 truncate">
                      {patch.description}
                    </p>
                    <div className="flex items-center gap-3 mt-1">
                      <span className="text-[11px] text-text-muted">
                        적용: {formatDateTime(patch.applied_at)}
                      </span>
                      <span className="text-[11px] text-text-muted">
                        변경 파일: {patch.file_changes.length}개
                      </span>
                    </div>
                  </div>

                  {/* 패치 상태 */}
                  <StatusBadge
                    status={patch.status}
                    label={
                      patch.status === 'applied'
                        ? '적용됨'
                        : patch.status === 'pending'
                        ? '대기중'
                        : patch.status === 'failed'
                        ? '실패'
                        : '롤백됨'
                    }
                    size="md"
                  />

                  {/* 액션 버튼들 */}
                  <div className="flex items-center gap-1.5 shrink-0">
                    {patch.can_rollback && (
                      <button
                        className="flex items-center gap-1 px-2.5 py-1.5 text-xs font-medium text-orange-600 bg-orange-50 rounded-lg hover:bg-orange-100 transition-colors"
                        title="되돌리기"
                      >
                        <RotateCcw className="w-3.5 h-3.5" />
                        되돌리기
                      </button>
                    )}
                    {patch.can_rerun && (
                      <button
                        className="flex items-center gap-1 px-2.5 py-1.5 text-xs font-medium text-museum-green bg-museum-green/10 rounded-lg hover:bg-museum-green/20 transition-colors"
                        title="다시실행"
                      >
                        <Play className="w-3.5 h-3.5" />
                        다시실행
                      </button>
                    )}
                    <button
                      onClick={() => {
                        setSelectedPatchId(patch.id);
                        setShowLogModal(true);
                      }}
                      className="flex items-center gap-1 px-2.5 py-1.5 text-xs font-medium text-text-secondary bg-gray-100 rounded-lg hover:bg-gray-200 transition-colors"
                      title="로그"
                    >
                      <FileText className="w-3.5 h-3.5" />
                      로그
                    </button>
                  </div>
                </div>
              );
            })}
          </div>
        </div>
      </Card>

      {/* 모듈 상태 */}
      <Card
        title="모듈 상태"
        subtitle="설치된 시스템 모듈 현황"
        action={
          <button className="flex items-center gap-1.5 px-3 py-1.5 text-xs font-medium text-text-secondary bg-gray-100 rounded-lg hover:bg-gray-200 transition-colors">
            <Package className="w-3.5 h-3.5" />
            모듈 관리
          </button>
        }
      >
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-3">
          {systemModules.map((module) => (
            <div
              key={module.name}
              className="flex items-center gap-3 p-3 border border-border rounded-xl hover:bg-gray-50 transition-colors cursor-pointer"
            >
              <div className="w-9 h-9 rounded-lg bg-museum-green/10 text-museum-green flex items-center justify-center">
                <Zap className="w-4.5 h-4.5" />
              </div>
              <div className="flex-1 min-w-0">
                <p className="text-sm font-medium truncate">{module.name}</p>
                <p className="text-[11px] text-text-muted">v{module.version}</p>
              </div>
              <div className="flex items-center gap-1">
                <div className="w-2 h-2 rounded-full bg-success" />
                <span className="text-[11px] text-success font-medium">활성</span>
              </div>
            </div>
          ))}
        </div>
      </Card>

      {/* 시스템 헬스 체크 */}
      <Card
        title="시스템 상태"
        subtitle="인프라 및 서비스 헬스 체크"
        action={
          <button className="flex items-center gap-1.5 px-3 py-1.5 text-xs font-medium text-museum-green bg-museum-green/10 rounded-lg hover:bg-museum-green/20 transition-colors">
            <RefreshCw className="w-3.5 h-3.5" />
            새로고침
          </button>
        }
      >
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-3">
          {[
            {
              name: 'Supabase 데이터베이스',
              status: 'online',
              latency: '12ms',
              icon: Database,
            },
            {
              name: 'Edge Functions',
              status: 'online',
              latency: '45ms',
              icon: Zap,
            },
            {
              name: '스토리지',
              status: 'online',
              latency: '8ms',
              icon: HardDrive,
            },
            {
              name: '인증 서비스',
              status: 'online',
              latency: '23ms',
              icon: Shield,
            },
          ].map((service) => {
            const Icon = service.icon;
            return (
              <div
                key={service.name}
                className="flex items-center gap-3 p-3 border border-border rounded-xl"
              >
                <div className="w-9 h-9 rounded-lg bg-green-50 text-success flex items-center justify-center">
                  <Icon className="w-4.5 h-4.5" />
                </div>
                <div className="flex-1 min-w-0">
                  <p className="text-sm font-medium truncate">{service.name}</p>
                  <div className="flex items-center gap-2 mt-0.5">
                    <div className="flex items-center gap-1">
                      <div className="w-1.5 h-1.5 rounded-full bg-success" />
                      <span className="text-[11px] text-success font-medium">정상</span>
                    </div>
                    <span className="text-[11px] text-text-muted">{service.latency}</span>
                  </div>
                </div>
              </div>
            );
          })}
        </div>
      </Card>

      {/* 최근 활동 로그 */}
      <Card
        title="최근 활동 로그"
        subtitle="시스템 변경 및 관리 활동 기록"
        action={
          <button className="flex items-center gap-1.5 px-3 py-1.5 text-xs font-medium text-text-secondary bg-gray-100 rounded-lg hover:bg-gray-200 transition-colors">
            <Eye className="w-3.5 h-3.5" />
            전체 보기
          </button>
        }
      >
        <div className="space-y-0">
          {[
            {
              action: '시스템 업데이트',
              detail: 'v2.10.0 업데이트 적용 완료',
              user: '관리자',
              time: '2시간 전',
              type: 'system',
            },
            {
              action: '패치 적용',
              detail: 'FAQ 미디어 빈 배열 수정 패치 적용',
              user: '관리자',
              time: '3시간 전',
              type: 'patch',
            },
            {
              action: '예약 확정',
              detail: '한국초등학교 단체 예약 확정 (30명)',
              user: '김직원',
              time: '4시간 전',
              type: 'reservation',
            },
            {
              action: '시설 점검 등록',
              detail: '체험교실B 정기 점검 일정 등록',
              user: '박관리',
              time: '5시간 전',
              type: 'facility',
            },
            {
              action: '프로그램 수정',
              detail: '누에고치 공예체험 가격 변경 (15,000원 → 18,000원)',
              user: '관리자',
              time: '6시간 전',
              type: 'program',
            },
          ].map((log, index) => (
            <div
              key={index}
              className={`flex items-center gap-3 px-3 py-3 hover:bg-gray-50 transition-colors rounded-lg ${
                index < 4 ? '' : ''
              }`}
            >
              <div
                className={`w-8 h-8 rounded-lg flex items-center justify-center shrink-0 ${
                  log.type === 'system'
                    ? 'bg-purple-100 text-purple-600'
                    : log.type === 'patch'
                    ? 'bg-blue-100 text-blue-600'
                    : log.type === 'reservation'
                    ? 'bg-green-100 text-green-600'
                    : log.type === 'facility'
                    ? 'bg-orange-100 text-orange-600'
                    : 'bg-gray-100 text-gray-600'
                }`}
              >
                <Terminal className="w-3.5 h-3.5" />
              </div>
              <div className="flex-1 min-w-0">
                <div className="flex items-center gap-2">
                  <p className="text-sm font-medium">{log.action}</p>
                  <span className="text-[11px] text-text-muted">{log.user}</span>
                </div>
                <p className="text-xs text-text-muted truncate">{log.detail}</p>
              </div>
              <span className="text-[11px] text-text-muted whitespace-nowrap">{log.time}</span>
              <ChevronRight className="w-4 h-4 text-text-muted shrink-0" />
            </div>
          ))}
        </div>
      </Card>

      {/* 패치 로그 모달 */}
      <Modal
        isOpen={showLogModal}
        onClose={() => {
          setShowLogModal(false);
          setSelectedPatchId(null);
        }}
        title="패치 로그"
        subtitle={patches.find((p) => p.id === selectedPatchId)?.name}
        size="lg"
      >
        <div className="space-y-3">
          <div className="bg-gray-900 rounded-xl p-4 font-mono text-xs text-green-400 max-h-80 overflow-y-auto">
            <p>[2026-02-13 10:30:00] 패치 실행 시작...</p>
            <p>[2026-02-13 10:30:01] 영향 파일 분석 중...</p>
            <p>[2026-02-13 10:30:02] 변경사항 적용 중...</p>
            <p className="text-yellow-400">
              [2026-02-13 10:30:03] 경고: 기존 데이터 백업 생성
            </p>
            <p>[2026-02-13 10:30:04] 마이그레이션 실행 완료</p>
            <p>[2026-02-13 10:30:05] 캐시 초기화...</p>
            <p className="text-green-300 font-bold">
              [2026-02-13 10:30:06] ✓ 패치 적용 완료 (6.2초)
            </p>
          </div>
          <div>
            <h4 className="text-xs font-semibold mb-2">변경된 파일:</h4>
            <div className="space-y-1">
              {patches
                .find((p) => p.id === selectedPatchId)
                ?.file_changes.map((file, i) => (
                  <div
                    key={i}
                    className="flex items-center gap-2 px-3 py-1.5 bg-gray-50 rounded-lg text-xs font-mono"
                  >
                    <FileText className="w-3.5 h-3.5 text-text-muted" />
                    {file}
                  </div>
                ))}
            </div>
          </div>
        </div>
      </Modal>

      {/* 업데이트 히스토리 모달 */}
      <Modal
        isOpen={showUpdateHistory}
        onClose={() => setShowUpdateHistory(false)}
        title="업데이트 히스토리"
        subtitle="시스템 업데이트 및 패치 이력"
        size="lg"
      >
        <div className="space-y-4">
          {updateHistory.map((update, index) => (
            <div
              key={index}
              className={`border border-border rounded-xl p-4 ${
                index === 0 ? 'bg-museum-green/5 border-museum-green/20' : ''
              }`}
            >
              <div className="flex items-center justify-between mb-2">
                <div className="flex items-center gap-2">
                  <span className="text-sm font-bold">{update.version}</span>
                  <StatusBadge
                    status={update.type === 'update' ? 'active' : 'applied'}
                    label={update.type === 'update' ? '업데이트' : '패치'}
                  />
                  {index === 0 && (
                    <span className="text-[10px] font-medium text-museum-green bg-museum-green/10 px-2 py-0.5 rounded-full">
                      현재 버전
                    </span>
                  )}
                </div>
                <span className="text-xs text-text-muted">{update.date}</span>
              </div>
              <ul className="space-y-1">
                {update.changes.map((change, i) => (
                  <li key={i} className="flex items-start gap-2 text-xs text-text-secondary">
                    <span className="text-museum-green mt-0.5">•</span>
                    {change}
                  </li>
                ))}
              </ul>
            </div>
          ))}
        </div>
      </Modal>
    </div>
  );
}
