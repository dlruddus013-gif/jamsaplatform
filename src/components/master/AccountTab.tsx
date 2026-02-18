import {
  User,
  Mail,
  Phone,
  Building,
  Camera,
  Key,
  Bell,
  Globe,
  Save,
} from 'lucide-react';
import { useState } from 'react';
import Card from '../common/Card';
import { useAppStore } from '../../stores/appStore';

export default function AccountTab() {
  const { currentUser } = useAppStore();
  const [formData, setFormData] = useState({
    name: currentUser?.name || '',
    email: currentUser?.email || '',
    phone: '010-1234-5678',
    department: currentUser?.department || '',
    bio: '잠사박물관 운영 및 관리를 담당하고 있습니다.',
  });

  const [notificationSettings, setNotificationSettings] = useState({
    email_reservation: true,
    email_system: true,
    email_marketing: false,
    push_reservation: true,
    push_chat: true,
    push_system: false,
    kakao_reservation: true,
    kakao_daily_report: true,
  });

  return (
    <div className="space-y-4 max-w-3xl">
      {/* 프로필 정보 */}
      <Card title="프로필 정보" subtitle="계정 기본 정보를 관리합니다">
        <div className="space-y-4">
          {/* 아바타 */}
          <div className="flex items-center gap-4">
            <div className="relative">
              <div className="w-20 h-20 rounded-2xl bg-museum-green text-white flex items-center justify-center text-2xl font-bold">
                {formData.name.charAt(0)}
              </div>
              <button className="absolute -bottom-1 -right-1 w-7 h-7 bg-white border border-border rounded-full flex items-center justify-center shadow-sm hover:bg-gray-50 transition-colors">
                <Camera className="w-3.5 h-3.5 text-text-secondary" />
              </button>
            </div>
            <div>
              <p className="text-sm font-semibold">{formData.name}</p>
              <p className="text-xs text-text-muted">{currentUser?.role === 'superadmin' ? '최고관리자' : '관리자'}</p>
              <p className="text-xs text-text-muted mt-0.5">가입일: 2024.01.01</p>
            </div>
          </div>

          {/* 입력 필드 */}
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <div>
              <label className="flex items-center gap-1.5 text-xs font-medium text-text-secondary mb-1.5">
                <User className="w-3.5 h-3.5" /> 이름
              </label>
              <input
                type="text"
                value={formData.name}
                onChange={(e) => setFormData({ ...formData, name: e.target.value })}
                className="w-full px-3 py-2 text-sm border border-border rounded-lg focus:outline-none focus:ring-2 focus:ring-museum-green/20 focus:border-museum-green"
              />
            </div>
            <div>
              <label className="flex items-center gap-1.5 text-xs font-medium text-text-secondary mb-1.5">
                <Mail className="w-3.5 h-3.5" /> 이메일
              </label>
              <input
                type="email"
                value={formData.email}
                onChange={(e) => setFormData({ ...formData, email: e.target.value })}
                className="w-full px-3 py-2 text-sm border border-border rounded-lg focus:outline-none focus:ring-2 focus:ring-museum-green/20 focus:border-museum-green"
              />
            </div>
            <div>
              <label className="flex items-center gap-1.5 text-xs font-medium text-text-secondary mb-1.5">
                <Phone className="w-3.5 h-3.5" /> 전화번호
              </label>
              <input
                type="tel"
                value={formData.phone}
                onChange={(e) => setFormData({ ...formData, phone: e.target.value })}
                className="w-full px-3 py-2 text-sm border border-border rounded-lg focus:outline-none focus:ring-2 focus:ring-museum-green/20 focus:border-museum-green"
              />
            </div>
            <div>
              <label className="flex items-center gap-1.5 text-xs font-medium text-text-secondary mb-1.5">
                <Building className="w-3.5 h-3.5" /> 부서
              </label>
              <input
                type="text"
                value={formData.department}
                onChange={(e) => setFormData({ ...formData, department: e.target.value })}
                className="w-full px-3 py-2 text-sm border border-border rounded-lg focus:outline-none focus:ring-2 focus:ring-museum-green/20 focus:border-museum-green"
              />
            </div>
          </div>
          <div>
            <label className="block text-xs font-medium text-text-secondary mb-1.5">소개</label>
            <textarea
              rows={3}
              value={formData.bio}
              onChange={(e) => setFormData({ ...formData, bio: e.target.value })}
              className="w-full px-3 py-2 text-sm border border-border rounded-lg focus:outline-none focus:ring-2 focus:ring-museum-green/20 focus:border-museum-green resize-none"
            />
          </div>
          <div className="flex justify-end">
            <button className="flex items-center gap-1.5 px-4 py-2 text-sm font-medium text-white bg-museum-green rounded-lg hover:bg-museum-green-light transition-colors">
              <Save className="w-4 h-4" />
              저장
            </button>
          </div>
        </div>
      </Card>

      {/* 비밀번호 변경 */}
      <Card title="비밀번호 변경" subtitle="보안을 위해 정기적으로 변경해 주세요">
        <div className="space-y-4">
          <div>
            <label className="flex items-center gap-1.5 text-xs font-medium text-text-secondary mb-1.5">
              <Key className="w-3.5 h-3.5" /> 현재 비밀번호
            </label>
            <input
              type="password"
              placeholder="현재 비밀번호를 입력하세요"
              className="w-full max-w-sm px-3 py-2 text-sm border border-border rounded-lg focus:outline-none focus:ring-2 focus:ring-museum-green/20 focus:border-museum-green"
            />
          </div>
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <div>
              <label className="block text-xs font-medium text-text-secondary mb-1.5">새 비밀번호</label>
              <input
                type="password"
                placeholder="8자 이상 입력"
                className="w-full px-3 py-2 text-sm border border-border rounded-lg focus:outline-none focus:ring-2 focus:ring-museum-green/20 focus:border-museum-green"
              />
            </div>
            <div>
              <label className="block text-xs font-medium text-text-secondary mb-1.5">비밀번호 확인</label>
              <input
                type="password"
                placeholder="비밀번호를 다시 입력하세요"
                className="w-full px-3 py-2 text-sm border border-border rounded-lg focus:outline-none focus:ring-2 focus:ring-museum-green/20 focus:border-museum-green"
              />
            </div>
          </div>
          <div className="flex justify-end">
            <button className="px-4 py-2 text-sm font-medium text-white bg-museum-green rounded-lg hover:bg-museum-green-light transition-colors">
              비밀번호 변경
            </button>
          </div>
        </div>
      </Card>

      {/* 알림 설정 */}
      <Card title="알림 설정" subtitle="알림 수신 채널 및 유형을 설정합니다">
        <div className="space-y-4">
          <div>
            <h4 className="text-xs font-semibold text-text-secondary mb-3 flex items-center gap-1.5">
              <Mail className="w-3.5 h-3.5" /> 이메일 알림
            </h4>
            <div className="space-y-2">
              {[
                { key: 'email_reservation', label: '예약 알림', desc: '새 예약, 취소, 변경 시' },
                { key: 'email_system', label: '시스템 알림', desc: '업데이트, 오류 등' },
                { key: 'email_marketing', label: '마케팅 알림', desc: '프로모션, 이벤트 등' },
              ].map((item) => (
                <div key={item.key} className="flex items-center justify-between p-2 rounded-lg hover:bg-gray-50">
                  <div>
                    <p className="text-sm font-medium">{item.label}</p>
                    <p className="text-xs text-text-muted">{item.desc}</p>
                  </div>
                  <button
                    onClick={() =>
                      setNotificationSettings({
                        ...notificationSettings,
                        [item.key]: !notificationSettings[item.key as keyof typeof notificationSettings],
                      })
                    }
                    className={`relative w-11 h-6 rounded-full transition-colors ${
                      notificationSettings[item.key as keyof typeof notificationSettings]
                        ? 'bg-museum-green'
                        : 'bg-gray-300'
                    }`}
                  >
                    <div
                      className={`absolute top-1 w-4 h-4 bg-white rounded-full shadow transition-transform ${
                        notificationSettings[item.key as keyof typeof notificationSettings]
                          ? 'left-6'
                          : 'left-1'
                      }`}
                    />
                  </button>
                </div>
              ))}
            </div>
          </div>

          <div>
            <h4 className="text-xs font-semibold text-text-secondary mb-3 flex items-center gap-1.5">
              <Bell className="w-3.5 h-3.5" /> 푸시 알림
            </h4>
            <div className="space-y-2">
              {[
                { key: 'push_reservation', label: '예약 알림', desc: '실시간 예약 알림' },
                { key: 'push_chat', label: '채팅 알림', desc: '새 메시지 도착 시' },
                { key: 'push_system', label: '시스템 알림', desc: '시스템 상태 변경 시' },
              ].map((item) => (
                <div key={item.key} className="flex items-center justify-between p-2 rounded-lg hover:bg-gray-50">
                  <div>
                    <p className="text-sm font-medium">{item.label}</p>
                    <p className="text-xs text-text-muted">{item.desc}</p>
                  </div>
                  <button
                    onClick={() =>
                      setNotificationSettings({
                        ...notificationSettings,
                        [item.key]: !notificationSettings[item.key as keyof typeof notificationSettings],
                      })
                    }
                    className={`relative w-11 h-6 rounded-full transition-colors ${
                      notificationSettings[item.key as keyof typeof notificationSettings]
                        ? 'bg-museum-green'
                        : 'bg-gray-300'
                    }`}
                  >
                    <div
                      className={`absolute top-1 w-4 h-4 bg-white rounded-full shadow transition-transform ${
                        notificationSettings[item.key as keyof typeof notificationSettings]
                          ? 'left-6'
                          : 'left-1'
                      }`}
                    />
                  </button>
                </div>
              ))}
            </div>
          </div>
        </div>
      </Card>
    </div>
  );
}
