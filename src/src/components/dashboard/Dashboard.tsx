// ============================================================================
// 대시보드 메인 페이지 컴포넌트
// ============================================================================
'use client';

import StatCards from './StatCards';
import WeeklyOverview from './WeeklyOverview';
import AIInsight from './AIInsight';
import RevenueChart from './RevenueChart';
import CategoryStats from './CategoryStats';

export default function Dashboard() {
  return (
    <div className="max-w-[1600px] mx-auto">
      {/* 히어로 */}
      <div className="bg-gradient-to-br from-museum-primary to-museum-tertiary rounded-2xl p-8 text-white mb-5 relative overflow-hidden">
        <div className="absolute -top-[40%] -right-[8%] w-[260px] h-[260px] bg-white/5 rounded-full" />
        <h2 className="text-2xl font-black mb-1">📊 통계 대시보드</h2>
        <p className="text-[13px] opacity-80 font-light">
          예약 현황과 매출 분석을 한눈에 확인하세요
        </p>
      </div>

      {/* 통계 카드 */}
      <StatCards />

      {/* AI 인사이트 */}
      <AIInsight />

      {/* 주간 개요 */}
      <WeeklyOverview />

      {/* 2열 레이아웃: 매출 + 구분 */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-4 mt-4">
        <RevenueChart />
        <CategoryStats />
      </div>
    </div>
  );
}
