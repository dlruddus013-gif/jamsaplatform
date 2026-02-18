import {
  Plus,
  Edit2,
  Trash2,
  Copy,
  Eye,
  GripVertical,
  ToggleLeft,
  ToggleRight,
  Settings,
  FileText,
  ExternalLink,
} from 'lucide-react';
import { useState } from 'react';
import Card from '../common/Card';
import StatusBadge from '../common/StatusBadge';
import Modal from '../common/Modal';
import type { ReservationFormConfig, FormField } from '../../types';

const mockForms: ReservationFormConfig[] = [
  {
    id: '1',
    name: '일반 체험 예약 폼',
    fields: [
      { id: 'f1', label: '예약자명', type: 'text', required: true, order: 1 },
      { id: 'f2', label: '연락처', type: 'phone', required: true, order: 2 },
      { id: 'f3', label: '이메일', type: 'email', required: false, order: 3 },
      { id: 'f4', label: '방문일', type: 'date', required: true, order: 4 },
      { id: 'f5', label: '방문시간', type: 'time', required: true, order: 5 },
      { id: 'f6', label: '인원수', type: 'number', required: true, order: 6 },
      { id: 'f7', label: '프로그램', type: 'select', required: true, options: ['누에고치 공예체험', '실크 스카프 염색', '전통 직조 체험'], order: 7 },
      { id: 'f8', label: '요청사항', type: 'textarea', required: false, order: 8 },
    ],
    programs: ['누에고치 공예체험', '실크 스카프 염색', '전통 직조 체험'],
    is_active: true,
    require_payment: true,
    confirmation_message: '예약이 접수되었습니다. 확정 문자를 발송해 드리겠습니다.',
    cancellation_policy: '방문일 3일 전까지 무료 취소 가능합니다.',
    created_at: '2025-06-01T00:00:00Z',
    updated_at: '2026-02-10T00:00:00Z',
  },
  {
    id: '2',
    name: '단체 예약 폼',
    fields: [
      { id: 'g1', label: '기관/학교명', type: 'text', required: true, order: 1 },
      { id: 'g2', label: '담당자명', type: 'text', required: true, order: 2 },
      { id: 'g3', label: '연락처', type: 'phone', required: true, order: 3 },
      { id: 'g4', label: '이메일', type: 'email', required: true, order: 4 },
      { id: 'g5', label: '방문일', type: 'date', required: true, order: 5 },
      { id: 'g6', label: '총 인원', type: 'number', required: true, order: 6 },
      { id: 'g7', label: '코스 유형', type: 'select', required: true, options: ['A코스 (2시간)', 'B코스 (3시간)', 'C코스 (반일)', 'D코스 (종일)'], order: 7 },
      { id: 'g8', label: '차량 정보', type: 'text', required: false, order: 8 },
      { id: 'g9', label: '알레르기/주의사항', type: 'textarea', required: false, order: 9 },
    ],
    programs: ['A코스', 'B코스', 'C코스', 'D코스'],
    is_active: true,
    require_payment: false,
    confirmation_message: '단체 예약이 접수되었습니다. 담당자가 연락드리겠습니다.',
    cancellation_policy: '방문일 7일 전까지 무료 취소 가능합니다.',
    created_at: '2025-06-15T00:00:00Z',
    updated_at: '2026-02-08T00:00:00Z',
  },
  {
    id: '3',
    name: '특별 행사 예약 폼',
    fields: [
      { id: 'h1', label: '참가자명', type: 'text', required: true, order: 1 },
      { id: 'h2', label: '연락처', type: 'phone', required: true, order: 2 },
      { id: 'h3', label: '인원수', type: 'number', required: true, order: 3 },
    ],
    programs: [],
    is_active: false,
    require_payment: true,
    confirmation_message: '특별 행사 예약이 완료되었습니다.',
    cancellation_policy: '취소 불가',
    created_at: '2025-12-01T00:00:00Z',
    updated_at: '2026-01-20T00:00:00Z',
  },
];

const fieldTypeLabels: Record<string, string> = {
  text: '텍스트',
  number: '숫자',
  email: '이메일',
  phone: '전화번호',
  date: '날짜',
  time: '시간',
  select: '선택',
  checkbox: '체크박스',
  textarea: '장문',
};

export default function ReservationFormTab() {
  const [selectedForm, setSelectedForm] = useState<ReservationFormConfig | null>(null);
  const [showPreview, setShowPreview] = useState(false);
  const [previewForm, setPreviewForm] = useState<ReservationFormConfig | null>(null);

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <div>
          <p className="text-xs text-text-muted">
            고객이 사용할 예약 폼을 관리합니다. 활성화된 폼만 외부에 노출됩니다.
          </p>
        </div>
        <button className="flex items-center gap-1.5 px-3 py-2 text-sm font-medium text-white bg-museum-green rounded-lg hover:bg-museum-green-light transition-colors">
          <Plus className="w-4 h-4" />
          새 폼 만들기
        </button>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
        {mockForms.map((form) => (
          <div
            key={form.id}
            className="bg-card-bg border border-border rounded-xl overflow-hidden card-hover"
          >
            <div className="p-4">
              <div className="flex items-start justify-between mb-3">
                <div>
                  <div className="flex items-center gap-2">
                    <h3 className="text-sm font-bold">{form.name}</h3>
                    <StatusBadge
                      status={form.is_active ? 'active' : 'inactive'}
                      label={form.is_active ? '활성' : '비활성'}
                    />
                  </div>
                  <p className="text-xs text-text-muted mt-0.5">
                    필드 {form.fields.length}개 · 프로그램 {form.programs.length}개
                  </p>
                </div>
                <div className="flex items-center gap-1">
                  <button
                    onClick={() => {
                      setPreviewForm(form);
                      setShowPreview(true);
                    }}
                    className="p-1.5 hover:bg-gray-100 rounded-lg transition-colors"
                    title="미리보기"
                  >
                    <Eye className="w-4 h-4 text-text-secondary" />
                  </button>
                  <button className="p-1.5 hover:bg-gray-100 rounded-lg transition-colors" title="복제">
                    <Copy className="w-4 h-4 text-text-secondary" />
                  </button>
                  <button
                    onClick={() => setSelectedForm(form)}
                    className="p-1.5 hover:bg-gray-100 rounded-lg transition-colors"
                    title="설정"
                  >
                    <Settings className="w-4 h-4 text-text-secondary" />
                  </button>
                </div>
              </div>

              {/* 필드 목록 */}
              <div className="space-y-1.5">
                {form.fields.slice(0, 5).map((field) => (
                  <div
                    key={field.id}
                    className="flex items-center gap-2 px-2.5 py-1.5 bg-gray-50 rounded-lg text-xs"
                  >
                    <GripVertical className="w-3 h-3 text-text-muted" />
                    <span className="font-medium flex-1">{field.label}</span>
                    <span className="text-text-muted">{fieldTypeLabels[field.type]}</span>
                    {field.required && (
                      <span className="text-danger text-[10px]">필수</span>
                    )}
                  </div>
                ))}
                {form.fields.length > 5 && (
                  <p className="text-xs text-text-muted text-center py-1">
                    +{form.fields.length - 5}개 더
                  </p>
                )}
              </div>

              {/* 하단 정보 */}
              <div className="flex items-center justify-between mt-3 pt-3 border-t border-border">
                <div className="flex items-center gap-3 text-xs text-text-muted">
                  <span>결제: {form.require_payment ? '필수' : '선택'}</span>
                </div>
                <div className="flex items-center gap-2">
                  <button className="flex items-center gap-1 px-2.5 py-1.5 text-xs font-medium text-museum-green hover:bg-museum-green/10 rounded-lg transition-colors">
                    <Edit2 className="w-3 h-3" />
                    편집
                  </button>
                  <button className="flex items-center gap-1 px-2.5 py-1.5 text-xs font-medium text-text-secondary hover:bg-gray-100 rounded-lg transition-colors">
                    <ExternalLink className="w-3 h-3" />
                    링크
                  </button>
                </div>
              </div>
            </div>
          </div>
        ))}
      </div>

      {/* 폼 미리보기 모달 */}
      <Modal
        isOpen={showPreview}
        onClose={() => setShowPreview(false)}
        title="폼 미리보기"
        subtitle={previewForm?.name}
        size="md"
      >
        {previewForm && (
          <div className="space-y-4">
            <div className="bg-museum-green/5 border border-museum-green/20 rounded-xl p-4 text-center">
              <h3 className="text-lg font-bold text-museum-green">잠사박물관 플레이팝</h3>
              <p className="text-sm text-text-secondary mt-1">{previewForm.name}</p>
            </div>
            {previewForm.fields.map((field) => (
              <div key={field.id}>
                <label className="block text-sm font-medium mb-1.5">
                  {field.label}
                  {field.required && <span className="text-danger ml-0.5">*</span>}
                </label>
                {field.type === 'textarea' ? (
                  <textarea
                    rows={3}
                    placeholder={field.placeholder || `${field.label}을(를) 입력하세요`}
                    className="w-full px-3 py-2 text-sm border border-border rounded-lg resize-none"
                    disabled
                  />
                ) : field.type === 'select' ? (
                  <select className="w-full px-3 py-2 text-sm border border-border rounded-lg" disabled>
                    <option>선택하세요</option>
                    {field.options?.map((opt) => (
                      <option key={opt}>{opt}</option>
                    ))}
                  </select>
                ) : (
                  <input
                    type={field.type}
                    placeholder={field.placeholder || `${field.label}을(를) 입력하세요`}
                    className="w-full px-3 py-2 text-sm border border-border rounded-lg"
                    disabled
                  />
                )}
              </div>
            ))}
            <button className="w-full py-3 text-sm font-bold text-white bg-museum-green rounded-xl" disabled>
              예약하기
            </button>
          </div>
        )}
      </Modal>

      {/* 폼 설정 모달 */}
      <Modal
        isOpen={!!selectedForm}
        onClose={() => setSelectedForm(null)}
        title="폼 설정"
        subtitle={selectedForm?.name}
        size="lg"
        footer={
          <>
            <button
              onClick={() => setSelectedForm(null)}
              className="px-4 py-2 text-sm text-text-secondary bg-gray-100 rounded-lg hover:bg-gray-200 transition-colors"
            >
              취소
            </button>
            <button className="px-4 py-2 text-sm text-white bg-museum-green rounded-lg hover:bg-museum-green-light transition-colors">
              저장
            </button>
          </>
        }
      >
        {selectedForm && (
          <div className="space-y-4">
            <div>
              <label className="block text-xs font-medium text-text-secondary mb-1">확인 메시지</label>
              <textarea
                rows={2}
                defaultValue={selectedForm.confirmation_message}
                className="w-full px-3 py-2 text-sm border border-border rounded-lg focus:outline-none focus:ring-2 focus:ring-museum-green/20 resize-none"
              />
            </div>
            <div>
              <label className="block text-xs font-medium text-text-secondary mb-1">취소 정책</label>
              <textarea
                rows={2}
                defaultValue={selectedForm.cancellation_policy}
                className="w-full px-3 py-2 text-sm border border-border rounded-lg focus:outline-none focus:ring-2 focus:ring-museum-green/20 resize-none"
              />
            </div>
            <div className="flex items-center justify-between p-3 border border-border rounded-lg">
              <div>
                <p className="text-sm font-medium">결제 필수</p>
                <p className="text-xs text-text-muted">예약 시 결제를 요구합니다</p>
              </div>
              <button
                className={`relative w-11 h-6 rounded-full transition-colors ${
                  selectedForm.require_payment ? 'bg-museum-green' : 'bg-gray-300'
                }`}
              >
                <div
                  className={`absolute top-1 w-4 h-4 bg-white rounded-full shadow transition-transform ${
                    selectedForm.require_payment ? 'left-6' : 'left-1'
                  }`}
                />
              </button>
            </div>
          </div>
        )}
      </Modal>
    </div>
  );
}
