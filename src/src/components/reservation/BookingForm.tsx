// ============================================================================
// 예약 신청 폼 컴포넌트
// ============================================================================
'use client';

import { useState, useMemo } from 'react';
import { useAppStore } from '@/stores/useAppStore';
import { useToast } from '@/components/common/Toast';
import Card from '@/components/common/Card';
import Button from '@/components/common/Button';
import { generateTimeSlots } from '@/types';
import { fmtWon, today } from '@/utils/format';
import type { Booking } from '@/types';

interface BookingFormProps {
  onSubmit: (booking: Omit<Booking, 'id'>) => void;
  isAgency?: boolean;
}

export default function BookingForm({ onSubmit, isAgency }: BookingFormProps) {
  const { formConfig, activities, userPhone, currentAgency } = useAppStore();
  const { toast } = useToast();
  const timeSlots = useMemo(() => generateTimeSlots(), []);

  // 기본 날짜: 7일 후
  const defaultDate = useMemo(() => {
    const d = new Date();
    d.setDate(d.getDate() + 7);
    return d.toISOString().split('T')[0];
  }, []);

  const [formData, setFormData] = useState({
    date: defaultDate,
    name: '',
    phone: userPhone || '',
    arrival: '10:00',
    departure: '14:00',
    students: '',
    teachers: '',
    studentsChild: '',
    studentsElem: '',
    ageGroup: '유아',
    courseType: '기본코스',
    meal: '이용안함',
    addons: [] as string[],
    channel: '',
    category: '',
    etc: '',
    agreement: false,
  });

  const handleChange = (
    e: React.ChangeEvent<
      HTMLInputElement | HTMLSelectElement | HTMLTextAreaElement
    >
  ) => {
    const { name, value, type } = e.target;
    if (type === 'checkbox') {
      const checked = (e.target as HTMLInputElement).checked;
      setFormData((prev) => ({ ...prev, [name]: checked }));
    } else {
      setFormData((prev) => ({ ...prev, [name]: value }));
    }
  };

  const handleAddonChange = (addon: string, checked: boolean) => {
    if (addon === '없음') {
      setFormData((prev) => ({
        ...prev,
        addons: checked ? [] : prev.addons,
      }));
      return;
    }
    setFormData((prev) => ({
      ...prev,
      addons: checked
        ? [...prev.addons.filter((a) => a !== '없음'), addon]
        : prev.addons.filter((a) => a !== addon),
    }));
  };

  const handleSubmit = () => {
    if (!formData.name.trim()) {
      toast('단체명을 입력하세요', 'error');
      return;
    }
    if (!formData.date) {
      toast('방문일을 선택하세요', 'error');
      return;
    }
    if (!formData.students || parseInt(formData.students) <= 0) {
      toast('아동 수를 입력하세요', 'error');
      return;
    }
    if (!formData.agreement) {
      toast('개인정보 수집 동의가 필요합니다', 'error');
      return;
    }

    const stu = parseInt(formData.students) || 0;
    const tea = parseInt(formData.teachers) || 0;

    const booking: Omit<Booking, 'id'> = {
      date: formData.date,
      name: formData.name.trim(),
      phone: formData.phone,
      arrival: formData.arrival,
      departure: formData.departure,
      students: stu,
      teachers: tea,
      studentsChild:
        formData.ageGroup === '유아'
          ? stu
          : parseInt(formData.studentsChild) || 0,
      studentsElem:
        formData.ageGroup === '초등'
          ? stu
          : parseInt(formData.studentsElem) || 0,
      ageGroup: formData.ageGroup,
      courseType: formData.courseType,
      meal: formData.meal,
      addons: formData.addons.length > 0 ? formData.addons : [],
      status: '대기',
      etc: formData.etc || undefined,
      channel: formData.channel || undefined,
      category: formData.category || '미분류',
      agency: isAgency ? currentAgency?.code : undefined,
      agencyName: isAgency ? currentAgency?.name : undefined,
      created: today(),
      paidAmount: null,
      actualStudents: null,
      actualTeachers: null,
      actualStudentsChild: null,
      actualStudentsElem: null,
      actualAddons: null,
      actualMeal: null,
      actualAddonQty: null,
      actualEntryPrices: null,
      actualMealQty: null,
    };

    onSubmit(booking);
    toast('예약이 접수되었습니다!', 'success');
  };

  const fc = formConfig;
  const timeOptions = timeSlots.map((t) => t.s);
  timeOptions.push('17:00');

  return (
    <div className="max-w-[800px] mx-auto">
      {/* 히어로 */}
      <div className="bg-gradient-to-br from-museum-primary to-museum-tertiary rounded-2xl p-8 text-white mb-5 relative overflow-hidden">
        <div className="absolute -top-[40%] -right-[8%] w-[260px] h-[260px] bg-white/5 rounded-full" />
        <h2 className="text-2xl font-black mb-1">
          {isAgency ? '🏢 대행사 예약 신청' : '📝 단체예약 신청'}
        </h2>
        <p className="text-[13px] opacity-80 font-light">
          {fc.pkgDesc} (유아 {fmtWon(fc.entryP1)}/초등 {fmtWon(fc.entryP2)}원)
        </p>
      </div>

      {/* 기본 정보 */}
      <Card title="기본 정보" icon="📋">
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
          <div className="flex flex-col gap-1">
            <label className="text-[11px] font-bold text-gray-500">
              방문일 <span className="text-red-500">*</span>
            </label>
            <input
              type="date"
              name="date"
              value={formData.date}
              onChange={handleChange}
              className="border-2 border-museum-border rounded-lg px-3 py-2 text-[13px] outline-none focus:border-museum-tertiary bg-[#fafaf8]"
            />
          </div>
          <div className="flex flex-col gap-1">
            <label className="text-[11px] font-bold text-gray-500">
              단체명 <span className="text-red-500">*</span>
            </label>
            <input
              type="text"
              name="name"
              value={formData.name}
              onChange={handleChange}
              placeholder="예: 해피유치원"
              className="border-2 border-museum-border rounded-lg px-3 py-2 text-[13px] outline-none focus:border-museum-tertiary bg-[#fafaf8]"
            />
          </div>
          <div className="flex flex-col gap-1">
            <label className="text-[11px] font-bold text-gray-500">
              연락처
            </label>
            <input
              type="tel"
              name="phone"
              value={formData.phone}
              onChange={handleChange}
              placeholder="010-0000-0000"
              className="border-2 border-museum-border rounded-lg px-3 py-2 text-[13px] outline-none focus:border-museum-tertiary bg-[#fafaf8]"
            />
          </div>
          <div className="flex flex-col gap-1">
            <label className="text-[11px] font-bold text-gray-500">구분</label>
            <div className="flex gap-1.5 flex-wrap">
              {['유아', '초등', '혼합'].map((g) => (
                <label
                  key={g}
                  className={`flex items-center gap-1 text-xs font-medium px-3 py-1.5 border-2 rounded-lg cursor-pointer transition-all ${
                    formData.ageGroup === g
                      ? 'border-museum-tertiary bg-green-50 text-museum-primary font-bold'
                      : 'border-museum-border bg-[#fafaf8]'
                  }`}
                >
                  <input
                    type="radio"
                    name="ageGroup"
                    value={g}
                    checked={formData.ageGroup === g}
                    onChange={handleChange}
                    className="hidden"
                  />
                  {g}
                </label>
              ))}
            </div>
          </div>
          <div className="flex flex-col gap-1">
            <label className="text-[11px] font-bold text-gray-500">
              도착시간
            </label>
            <select
              name="arrival"
              value={formData.arrival}
              onChange={handleChange}
              className="border-2 border-museum-border rounded-lg px-3 py-2 text-[13px] outline-none focus:border-museum-tertiary bg-[#fafaf8]"
            >
              {timeOptions.slice(0, -1).map((t) => (
                <option key={t} value={t}>
                  {t}
                </option>
              ))}
            </select>
          </div>
          <div className="flex flex-col gap-1">
            <label className="text-[11px] font-bold text-gray-500">
              출발시간
            </label>
            <select
              name="departure"
              value={formData.departure}
              onChange={handleChange}
              className="border-2 border-museum-border rounded-lg px-3 py-2 text-[13px] outline-none focus:border-museum-tertiary bg-[#fafaf8]"
            >
              {timeOptions.slice(1).map((t) => (
                <option key={t} value={t}>
                  {t}
                </option>
              ))}
            </select>
          </div>
          <div className="flex flex-col gap-1">
            <label className="text-[11px] font-bold text-gray-500">
              아동 수 <span className="text-red-500">*</span>
            </label>
            <input
              type="number"
              name="students"
              value={formData.students}
              onChange={handleChange}
              placeholder="0"
              min="0"
              className="border-2 border-museum-border rounded-lg px-3 py-2 text-[13px] outline-none focus:border-museum-tertiary bg-[#fafaf8]"
            />
          </div>
          <div className="flex flex-col gap-1">
            <label className="text-[11px] font-bold text-gray-500">
              인솔자 수
            </label>
            <input
              type="number"
              name="teachers"
              value={formData.teachers}
              onChange={handleChange}
              placeholder="0"
              min="0"
              className="border-2 border-museum-border rounded-lg px-3 py-2 text-[13px] outline-none focus:border-museum-tertiary bg-[#fafaf8]"
            />
          </div>
        </div>
      </Card>

      {/* 체험 포함 내역 */}
      <Card title="체험 포함 내역" icon="🏕️">
        <div className="flex flex-wrap gap-1.5 mb-3">
          {activities.map((c) => (
            <div
              key={c}
              className="inline-flex items-center gap-1 px-2.5 py-1.5 bg-green-50 border border-green-200 rounded-lg text-[11px] font-semibold text-green-800"
            >
              🏕️ {c}
            </div>
          ))}
        </div>
      </Card>

      {/* 단체식 */}
      <Card title="단체식" icon="🍚">
        <div className="flex gap-1.5 flex-wrap">
          <label
            className={`flex items-center gap-1 text-xs font-medium px-3 py-1.5 border-2 rounded-lg cursor-pointer transition-all ${
              formData.meal === '이용안함'
                ? 'border-museum-tertiary bg-green-50 text-museum-primary font-bold'
                : 'border-museum-border bg-[#fafaf8]'
            }`}
          >
            <input
              type="radio"
              name="meal"
              value="이용안함"
              checked={formData.meal === '이용안함'}
              onChange={handleChange}
              className="hidden"
            />
            이용안함
          </label>
          {fc.meals.map((m) => (
            <label
              key={m.name}
              className={`flex items-center gap-1 text-xs font-medium px-3 py-1.5 border-2 rounded-lg cursor-pointer transition-all ${
                formData.meal === m.name
                  ? 'border-museum-tertiary bg-green-50 text-museum-primary font-bold'
                  : 'border-museum-border bg-[#fafaf8]'
              }`}
            >
              <input
                type="radio"
                name="meal"
                value={m.name}
                checked={formData.meal === m.name}
                onChange={handleChange}
                className="hidden"
              />
              {m.name} (유아 {fmtWon(m.p1)} / 초등 {fmtWon(m.p2)}원)
            </label>
          ))}
        </div>
      </Card>

      {/* 부가 체험 */}
      <Card title="부가 체험" icon="✨">
        <div className="flex gap-1.5 flex-wrap">
          <label
            className={`flex items-center gap-1 text-xs font-medium px-3 py-1.5 border-2 rounded-lg cursor-pointer transition-all ${
              formData.addons.length === 0
                ? 'border-orange-400 bg-yellow-50 text-yellow-800 font-bold'
                : 'border-museum-border bg-[#fafaf8]'
            }`}
          >
            <input
              type="checkbox"
              checked={formData.addons.length === 0}
              onChange={(e) => handleAddonChange('없음', e.target.checked)}
              className="hidden"
            />
            없음
          </label>
          {fc.addons.map((a) => (
            <label
              key={a.name}
              className={`flex items-center gap-1 text-xs font-medium px-3 py-1.5 border-2 rounded-lg cursor-pointer transition-all ${
                formData.addons.includes(a.name)
                  ? 'border-orange-400 bg-yellow-50 text-yellow-800 font-bold'
                  : 'border-museum-border bg-[#fafaf8]'
              }`}
            >
              <input
                type="checkbox"
                checked={formData.addons.includes(a.name)}
                onChange={(e) =>
                  handleAddonChange(a.name, e.target.checked)
                }
                className="hidden"
              />
              {a.name} ({fmtWon(a.price)}원)
            </label>
          ))}
        </div>
      </Card>

      {/* 추가 요청사항 */}
      <Card title="추가 요청사항" icon="📝">
        <textarea
          name="etc"
          value={formData.etc}
          onChange={handleChange}
          placeholder="알레르기, 특별 요청 등을 적어주세요"
          className="w-full border-2 border-museum-border rounded-lg px-3 py-2 text-[13px] outline-none focus:border-museum-tertiary bg-[#fafaf8] resize-y min-h-[60px]"
        />
      </Card>

      {/* 동의 및 제출 */}
      <div className="text-center mt-6">
        <label className="flex items-center justify-center gap-2 text-xs mb-4 cursor-pointer">
          <input
            type="checkbox"
            name="agreement"
            checked={formData.agreement}
            onChange={handleChange}
            className="w-4 h-4"
          />
          <span>
            개인정보 수집·이용에 동의합니다{' '}
            <span className="text-red-500">*</span>
          </span>
        </label>
        <Button variant="primary" size="lg" onClick={handleSubmit}>
          예약 접수하기
        </Button>
      </div>
    </div>
  );
}
