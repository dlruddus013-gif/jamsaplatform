// ============================================================================
// AI 분석 인사이트 컴포넌트
// ============================================================================
'use client';

import { useMemo } from 'react';
import { useAppStore } from '@/stores/useAppStore';
import { today, fmtWon } from '@/utils/format';
import { getEstimate } from '@/utils/pricing';

export default function AIInsight() {
  const { bookings, formConfig } = useAppStore();
  const todayStr = today();
  const currentMonth = todayStr.substring(0, 7);

  const insight = useMemo(() => {
    const todayBks = bookings.filter(
      (b) => b.date === todayStr && b.status !== '취소'
    );
    const todayPpl = todayBks.reduce(
      (s, b) => s + b.students + b.teachers,
      0
    );
    const pending = bookings.filter((b) => b.status === '대기');
    const confirmed = bookings.filter((b) => b.status === '확정');
    const monthBks = bookings.filter(
      (b) => b.date.startsWith(currentMonth) && b.status !== '취소'
    );
    const monthEst = monthBks.reduce(
      (s, b) => s + getEstimate(b, formConfig),
      0
    );
    const monthPaid = monthBks
      .filter((b) => b.paidAmount != null)
      .reduce((s, b) => s + (b.paidAmount ?? 0), 0);

    // 전월 비교
    const pm = new Date();
    pm.setMonth(pm.getMonth() - 1);
    const pmKey = pm.toISOString().substring(0, 7);
    const pmBks = bookings.filter(
      (b) => b.date.startsWith(pmKey) && b.status !== '취소'
    );
    const pmEst = pmBks.reduce(
      (s, b) => s + getEstimate(b, formConfig),
      0
    );

    const confRate =
      monthBks.length > 0
        ? Math.round(
            (confirmed.filter((b) => b.date.startsWith(currentMonth))
              .length /
              monthBks.length) *
              100
          )
        : 0;

    const collectRate =
      monthEst > 0 ? Math.round((monthPaid / monthEst) * 100) : 0;

    // 리드타임 분석
    const dp = /^\d{4}-\d{2}-\d{2}$/;
    const activeBks = bookings.filter(
      (b) =>
        b.status !== '취소' &&
        b.created &&
        dp.test(b.created) &&
        b.date &&
        dp.test(b.date)
    );
    const leads = activeBks.map((b) => {
      const d = Math.max(
        0,
        Math.floor(
          (new Date(b.date).getTime() - new Date(b.created).getTime()) /
            (1000 * 60 * 60 * 24)
        )
      );
      return isNaN(d) ? 0 : d;
    });
    const avgLead =
      leads.length > 0
        ? Math.round(leads.reduce((s, v) => s + v, 0) / leads.length)
        : 0;

    // 구분 분석
    const catMap: Record<string, { n: number; p: number; e: number }> = {};
    bookings
      .filter((b) => b.status !== '취소')
      .forEach((b) => {
        const c = b.category || '미분류';
        if (!catMap[c]) catMap[c] = { n: 0, p: 0, e: 0 };
        catMap[c].n++;
        catMap[c].p += b.students + b.teachers;
        catMap[c].e += getEstimate(b, formConfig);
      });
    const topCat = Object.entries(catMap).sort(
      (a, b) => b[1].n - a[1].n
    )[0];

    const lines: string[] = [];

    // 오늘 현황
    if (todayBks.length > 0) {
      const pendToday = todayBks.filter((b) => b.status === '대기').length;
      lines.push(
        `오늘 <strong>${todayBks.length}건</strong> (${todayPpl}명) 방문 예정이며, ${
          pendToday > 0
            ? '아직 확정되지 않은 건이 있어 확인이 필요합니다.'
            : '모두 확정 상태입니다.'
        }`
      );
    } else {
      lines.push('오늘 예정된 예약이 없습니다.');
    }

    // 대기 분석
    if (pending.length > 0) {
      const oldPend = pending.filter((b) => {
        const d = new Date(b.created);
        return Math.floor((Date.now() - d.getTime()) / 86400000) >= 7;
      });
      lines.push(
        `대기 중 <strong>${pending.length}건</strong> 중${
          oldPend.length > 0
            ? ` <span class="text-red-600">${oldPend.length}건이 7일 이상 경과</span>하여 조속한 처리가 권장됩니다.`
            : ' 모두 최근 접수건입니다.'
        }`
      );
    }

    // 확정률
    lines.push(
      `이번달 확정률 <strong>${confRate}%</strong> (${monthBks.length}건 중 ${confirmed.filter((b) => b.date.startsWith(currentMonth)).length}건 확정)`
    );

    // 매출
    if (pmEst > 0) {
      const growth = Math.round(((monthEst - pmEst) / pmEst) * 100);
      lines.push(
        `이달 견적(₩${fmtWon(monthEst)})은 전월 대비 <strong>${growth >= 0 ? '+' : ''}${growth}%</strong>${growth > 0 ? ' 증가' : growth < 0 ? ' 감소' : ' 동일'}`
      );
    }

    if (collectRate < 50 && monthEst > 0) {
      lines.push(
        `수금률 <strong>${collectRate}%</strong> — <span class="text-orange-600">미수금 관리에 주의가 필요합니다.</span>`
      );
    }

    // 리드타임
    if (avgLead > 0) {
      lines.push(
        `평균 리드타임(신청→방문) <strong>${avgLead}일</strong>이며, ${
          avgLead <= 7
            ? '빠른 회전율을 보이고 있습니다.'
            : avgLead <= 14
              ? '일반적인 수준입니다.'
              : '장기 사전예약 비중이 높습니다.'
        }`
      );
    }

    // 최다 유형
    if (topCat) {
      const totalActive = bookings.filter((b) => b.status !== '취소').length;
      lines.push(
        `가장 많은 유형은 <strong>${topCat[0]}</strong> (${topCat[1].n}건, ${Math.round((topCat[1].n / totalActive) * 100)}%)`
      );
    }

    return lines;
  }, [bookings, formConfig, todayStr, currentMonth]);

  if (insight.length === 0) return null;

  return (
    <div className="bg-gradient-to-br from-green-50 to-green-100 border-2 border-green-300 rounded-[14px] p-4 mb-5 shadow-sm">
      <div className="flex items-center gap-2 mb-3 pb-2 border-b-2 border-green-200/50">
        <span className="text-xl">🤖</span>
        <span className="text-[15px] font-black text-green-900">
          AI 분석
        </span>
      </div>
      <div className="text-sm leading-8 text-gray-800">
        {insight.map((line, i) => (
          <div key={i} dangerouslySetInnerHTML={{ __html: line }} />
        ))}
      </div>
    </div>
  );
}
