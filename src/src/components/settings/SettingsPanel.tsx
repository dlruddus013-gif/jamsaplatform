// ============================================================================
// 설정 패널 컴포넌트
// ============================================================================
'use client';

import { useState } from 'react';
import { useAppStore } from '@/stores/useAppStore';
import Card from '@/components/common/Card';
import Button from '@/components/common/Button';
import { useToast } from '@/components/common/Toast';
import { fmtWon } from '@/utils/format';
import type { MealOption, AddonOption } from '@/types';

export default function SettingsPanel() {
  const { formConfig, setFormConfig, activities, setActivities, adminAccounts, setAdminAccounts, currentFacility } =
    useAppStore();
  const { toast } = useToast();
  const [activeTab, setActiveTab] = useState<'pricing' | 'activities' | 'admin' | 'facility'>('pricing');

  const saveCfg = (updates: Partial<typeof formConfig>) => {
    const newCfg = { ...formConfig, ...updates };
    setFormConfig(newCfg);
    try {
      const fp = currentFacility?.code ? `${currentFacility.code}_` : 'jp_';
      localStorage.setItem(`${fp}formcfg`, JSON.stringify(newCfg));
    } catch { /* ignore */ }
    toast('설정이 저장되었습니다', 'success');
  };

  const tabs = [
    { key: 'pricing', label: '💰 요금 설정', icon: '💰' },
    { key: 'activities', label: '🏕️ 활동 관리', icon: '🏕️' },
    { key: 'admin', label: '👤 관리자', icon: '👤' },
    { key: 'facility', label: '🏗️ 시설', icon: '🏗️' },
  ];

  return (
    <div>
      {/* 히어로 */}
      <div className="bg-gradient-to-br from-museum-primary to-museum-tertiary rounded-2xl p-8 text-white mb-5 relative overflow-hidden">
        <div className="absolute -top-[40%] -right-[8%] w-[260px] h-[260px] bg-white/5 rounded-full" />
        <h2 className="text-2xl font-black mb-1">⚙️ 설정</h2>
        <p className="text-[13px] opacity-80 font-light">
          시스템 설정을 관리합니다
        </p>
      </div>

      {/* 탭 바 */}
      <div className="flex gap-1.5 p-3 bg-white rounded-xl shadow-sm border border-museum-border mb-4 flex-wrap">
        {tabs.map((t) => (
          <button
            key={t.key}
            onClick={() => setActiveTab(t.key as typeof activeTab)}
            className={`px-4 py-2 border-2 text-xs font-extrabold rounded-full cursor-pointer transition-all whitespace-nowrap ${
              activeTab === t.key
                ? 'bg-gradient-to-br from-museum-primary to-museum-secondary text-white border-museum-primary shadow-sm'
                : 'bg-[#fafafa] text-gray-600 border-gray-200 hover:border-museum-tertiary hover:bg-green-50'
            }`}
          >
            {t.label}
          </button>
        ))}
      </div>

      {/* 요금 설정 */}
      {activeTab === 'pricing' && (
        <Card title="💰 요금 설정">
          <div className="grid grid-cols-1 sm:grid-cols-3 gap-4 mb-6">
            <div className="flex flex-col gap-1">
              <label className="text-[11px] font-bold text-gray-500">
                유아 입장료
              </label>
              <input
                type="number"
                value={formConfig.entryP1}
                onChange={(e) =>
                  saveCfg({ entryP1: parseInt(e.target.value) || 0 })
                }
                className="border-2 border-museum-border rounded-lg px-3 py-2 text-sm outline-none focus:border-museum-tertiary"
              />
            </div>
            <div className="flex flex-col gap-1">
              <label className="text-[11px] font-bold text-gray-500">
                초등 입장료
              </label>
              <input
                type="number"
                value={formConfig.entryP2}
                onChange={(e) =>
                  saveCfg({ entryP2: parseInt(e.target.value) || 0 })
                }
                className="border-2 border-museum-border rounded-lg px-3 py-2 text-sm outline-none focus:border-museum-tertiary"
              />
            </div>
            <div className="flex flex-col gap-1">
              <label className="text-[11px] font-bold text-gray-500">
                인솔자 입장료
              </label>
              <input
                type="number"
                value={formConfig.entryTea}
                onChange={(e) =>
                  saveCfg({ entryTea: parseInt(e.target.value) || 0 })
                }
                className="border-2 border-museum-border rounded-lg px-3 py-2 text-sm outline-none focus:border-museum-tertiary"
              />
            </div>
          </div>

          {/* 단체식 메뉴 */}
          <h4 className="text-sm font-bold text-gray-700 mb-3">🍚 단체식 메뉴</h4>
          <div className="space-y-2 mb-4">
            {formConfig.meals.map((meal, i) => (
              <div
                key={i}
                className="flex gap-2 items-center bg-gray-50 rounded-lg p-3"
              >
                <input
                  type="text"
                  value={meal.name}
                  onChange={(e) => {
                    const meals = [...formConfig.meals];
                    meals[i] = { ...meals[i], name: e.target.value };
                    saveCfg({ meals });
                  }}
                  className="flex-1 border border-museum-border rounded-lg px-2 py-1.5 text-xs"
                  placeholder="메뉴명"
                />
                <input
                  type="number"
                  value={meal.p1}
                  onChange={(e) => {
                    const meals = [...formConfig.meals];
                    meals[i] = { ...meals[i], p1: parseInt(e.target.value) || 0 };
                    saveCfg({ meals });
                  }}
                  className="w-20 border border-museum-border rounded-lg px-2 py-1.5 text-xs"
                  placeholder="유아가"
                />
                <input
                  type="number"
                  value={meal.p2}
                  onChange={(e) => {
                    const meals = [...formConfig.meals];
                    meals[i] = { ...meals[i], p2: parseInt(e.target.value) || 0 };
                    saveCfg({ meals });
                  }}
                  className="w-20 border border-museum-border rounded-lg px-2 py-1.5 text-xs"
                  placeholder="초등가"
                />
                <button
                  onClick={() => {
                    const meals = formConfig.meals.filter((_, idx) => idx !== i);
                    saveCfg({ meals });
                  }}
                  className="text-red-400 hover:text-red-600 bg-transparent border-none cursor-pointer text-sm"
                >
                  🗑️
                </button>
              </div>
            ))}
          </div>
          <Button
            variant="green"
            size="sm"
            onClick={() => {
              saveCfg({
                meals: [...formConfig.meals, { name: '새 메뉴', p1: 0, p2: 0 }],
              });
            }}
          >
            + 메뉴 추가
          </Button>

          {/* 부가 체험 */}
          <h4 className="text-sm font-bold text-gray-700 mb-3 mt-6">
            ✨ 부가 체험
          </h4>
          <div className="space-y-2 mb-4">
            {formConfig.addons.map((addon, i) => (
              <div
                key={i}
                className="flex gap-2 items-center bg-gray-50 rounded-lg p-3"
              >
                <input
                  type="text"
                  value={addon.name}
                  onChange={(e) => {
                    const addons = [...formConfig.addons];
                    addons[i] = { ...addons[i], name: e.target.value };
                    saveCfg({ addons });
                  }}
                  className="flex-1 border border-museum-border rounded-lg px-2 py-1.5 text-xs"
                  placeholder="체험명"
                />
                <input
                  type="number"
                  value={addon.price}
                  onChange={(e) => {
                    const addons = [...formConfig.addons];
                    addons[i] = {
                      ...addons[i],
                      price: parseInt(e.target.value) || 0,
                    };
                    saveCfg({ addons });
                  }}
                  className="w-24 border border-museum-border rounded-lg px-2 py-1.5 text-xs"
                  placeholder="가격"
                />
                <button
                  onClick={() => {
                    const addons = formConfig.addons.filter(
                      (_, idx) => idx !== i
                    );
                    saveCfg({ addons });
                  }}
                  className="text-red-400 hover:text-red-600 bg-transparent border-none cursor-pointer text-sm"
                >
                  🗑️
                </button>
              </div>
            ))}
          </div>
          <Button
            variant="green"
            size="sm"
            onClick={() => {
              saveCfg({
                addons: [
                  ...formConfig.addons,
                  { name: '새 체험', price: 0 },
                ],
              });
            }}
          >
            + 체험 추가
          </Button>
        </Card>
      )}

      {/* 활동 관리 */}
      {activeTab === 'activities' && (
        <Card title="🏕️ 활동 관리">
          <div className="space-y-2 mb-4">
            {activities.map((act, i) => (
              <div
                key={i}
                className="flex gap-2 items-center bg-gray-50 rounded-lg p-3"
              >
                <span className="text-sm font-bold text-museum-primary w-6 text-center">
                  {i + 1}
                </span>
                <input
                  type="text"
                  value={act}
                  onChange={(e) => {
                    const updated = [...activities];
                    updated[i] = e.target.value;
                    setActivities(updated);
                  }}
                  className="flex-1 border border-museum-border rounded-lg px-3 py-1.5 text-xs"
                />
                <button
                  onClick={() => {
                    setActivities(activities.filter((_, idx) => idx !== i));
                  }}
                  className="text-red-400 hover:text-red-600 bg-transparent border-none cursor-pointer text-sm"
                >
                  🗑️
                </button>
              </div>
            ))}
          </div>
          <Button
            variant="green"
            size="sm"
            onClick={() => {
              const name = prompt('새 활동명을 입력하세요');
              if (name?.trim()) setActivities([...activities, name.trim()]);
            }}
          >
            + 활동 추가
          </Button>
        </Card>
      )}

      {/* 관리자 */}
      {activeTab === 'admin' && (
        <Card title="👤 관리자 계정">
          <div className="space-y-2">
            {adminAccounts.map((acc) => (
              <div
                key={acc.id}
                className="flex items-center gap-3 bg-gray-50 rounded-lg p-3"
              >
                <span className="text-lg">
                  {acc.role === 'master' ? '👑' : '🔧'}
                </span>
                <div className="flex-1">
                  <div className="text-xs font-bold text-gray-700">
                    {acc.name}
                  </div>
                  <div className="text-[10px] text-gray-400">
                    ID: {acc.id} / {acc.role}
                  </div>
                </div>
                <div className="text-[10px] text-gray-400">{acc.created}</div>
              </div>
            ))}
          </div>
        </Card>
      )}

      {/* 시설 */}
      {activeTab === 'facility' && (
        <Card title="🏗️ 시설 정보">
          <div className="bg-green-50 rounded-lg p-4">
            <div className="text-lg font-black text-museum-primary mb-2">
              🏕️ {currentFacility?.name || '잠사박물관'}
            </div>
            <div className="text-xs text-gray-500">
              시설코드: {currentFacility?.code || 'jp'}
            </div>
            <div className="text-xs text-gray-500 mt-1">
              패키지: {formConfig.pkgDesc}
            </div>
            <div className="text-xs text-gray-500 mt-1">
              유아 ₩{fmtWon(formConfig.entryP1)} / 초등 ₩
              {fmtWon(formConfig.entryP2)} / 인솔 ₩
              {fmtWon(formConfig.entryTea)}
            </div>
          </div>
        </Card>
      )}
    </div>
  );
}
