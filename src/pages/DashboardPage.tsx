import {
  CalendarCheck,
  Users,
  DollarSign,
  Clock,
  TrendingUp,
  TrendingDown,
  ArrowRight,
  BarChart3,
  PieChart,
  Activity,
  Eye,
} from 'lucide-react';
import { AreaChart, Area, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, BarChart, Bar } from 'recharts';
import Card from '../components/common/Card';
import StatCard from '../components/common/StatCard';
import { useDashboardStore } from '../stores/appStore';
import { formatCurrency, formatNumber } from '../utils/format';

export default function DashboardPage() {
  const { stats } = useDashboardStore();

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-lg font-bold">대시보드</h1>
          <p className="text-xs text-text-muted mt-0.5">잠사박물관 운영 현황 요약</p>
        </div>
        <div className="flex items-center gap-2">
          <select className="px-3 py-1.5 text-xs border border-border rounded-lg bg-white focus:outline-none focus:ring-2 focus:ring-museum-green/20">
            <option>오늘</option>
            <option>이번 주</option>
            <option>이번 달</option>
            <option>지난 30일</option>
          </select>
        </div>
      </div>

      {/* 통계 카드 */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-3">
        <StatCard
          title="오늘 예약"
          value={formatNumber(stats.today_reservations)}
          icon={<CalendarCheck className="w-5 h-5" />}
          change={{ value: 12, label: '전일 대비' }}
          trend="up"
        />
        <StatCard
          title="오늘 방문객"
          value={formatNumber(stats.today_visitors)}
          icon={<Users className="w-5 h-5" />}
          change={{ value: 8, label: '전일 대비' }}
          trend="up"
          iconColor="bg-blue-50 text-blue-600"
        />
        <StatCard
          title="오늘 매출"
          value={formatCurrency(stats.today_revenue)}
          icon={<DollarSign className="w-5 h-5" />}
          change={{ value: 5, label: '전일 대비' }}
          trend="up"
          iconColor="bg-emerald-50 text-emerald-600"
        />
        <StatCard
          title="대기중 예약"
          value={formatNumber(stats.pending_reservations)}
          icon={<Clock className="w-5 h-5" />}
          iconColor="bg-orange-50 text-orange-600"
        />
      </div>

      {/* 차트 영역 */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-4">
        {/* 예약 추이 */}
        <Card
          title="예약 추이"
          subtitle="최근 30일"
          className="lg:col-span-2"
          action={
            <div className="flex items-center gap-3 text-xs">
              <span className="flex items-center gap-1">
                <span className="w-2.5 h-2.5 rounded-full bg-museum-green" />
                예약
              </span>
              <span className="flex items-center gap-1">
                <span className="w-2.5 h-2.5 rounded-full bg-silk-gold" />
                매출
              </span>
            </div>
          }
        >
          <div className="h-64">
            <ResponsiveContainer width="100%" height="100%">
              <AreaChart data={stats.reservation_trend}>
                <CartesianGrid strokeDasharray="3 3" stroke="#E2E8F0" />
                <XAxis
                  dataKey="date"
                  tick={{ fontSize: 10, fill: '#94A3B8' }}
                  tickFormatter={(d: string) => d.split('-').slice(1).join('/')}
                />
                <YAxis tick={{ fontSize: 10, fill: '#94A3B8' }} />
                <Tooltip
                  contentStyle={{
                    borderRadius: '8px',
                    border: '1px solid #E2E8F0',
                    fontSize: '12px',
                  }}
                />
                <Area
                  type="monotone"
                  dataKey="count"
                  stroke="#2D5016"
                  fill="#2D5016"
                  fillOpacity={0.1}
                  strokeWidth={2}
                  name="예약"
                />
              </AreaChart>
            </ResponsiveContainer>
          </div>
        </Card>

        {/* 인기 프로그램 */}
        <Card title="인기 프로그램" subtitle="이번 달 TOP 5">
          <div className="space-y-3">
            {stats.popular_programs.map((program, index) => (
              <div key={program.program} className="flex items-center gap-3">
                <span
                  className={`w-6 h-6 rounded-full flex items-center justify-center text-xs font-bold ${
                    index === 0
                      ? 'bg-silk-gold text-white'
                      : index === 1
                      ? 'bg-gray-400 text-white'
                      : index === 2
                      ? 'bg-orange-400 text-white'
                      : 'bg-gray-100 text-text-muted'
                  }`}
                >
                  {index + 1}
                </span>
                <div className="flex-1 min-w-0">
                  <p className="text-sm font-medium truncate">{program.program}</p>
                  <div className="w-full bg-gray-100 rounded-full h-1.5 mt-1">
                    <div
                      className="h-1.5 rounded-full bg-museum-green"
                      style={{ width: `${(program.count / stats.popular_programs[0].count) * 100}%` }}
                    />
                  </div>
                </div>
                <span className="text-sm font-bold text-text-secondary">{program.count}건</span>
              </div>
            ))}
          </div>
        </Card>
      </div>

      {/* 시설 이용률 */}
      <Card
        title="시설 이용률"
        subtitle="이번 달 시설별 가동률"
        action={
          <button className="flex items-center gap-1 text-xs text-museum-green hover:underline">
            상세보기 <ArrowRight className="w-3 h-3" />
          </button>
        }
      >
        <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-6 gap-3">
          {stats.facility_usage.map((facility) => (
            <div key={facility.facility} className="text-center p-3 border border-border rounded-xl">
              <div className="relative w-16 h-16 mx-auto mb-2">
                <svg className="w-16 h-16 -rotate-90" viewBox="0 0 36 36">
                  <circle
                    cx="18"
                    cy="18"
                    r="15.9"
                    fill="none"
                    stroke="#E2E8F0"
                    strokeWidth="3"
                  />
                  <circle
                    cx="18"
                    cy="18"
                    r="15.9"
                    fill="none"
                    stroke={facility.usage_rate >= 80 ? '#2D5016' : facility.usage_rate >= 60 ? '#8B6914' : '#DC2626'}
                    strokeWidth="3"
                    strokeDasharray={`${facility.usage_rate} ${100 - facility.usage_rate}`}
                    strokeLinecap="round"
                  />
                </svg>
                <span className="absolute inset-0 flex items-center justify-center text-xs font-bold">
                  {facility.usage_rate}%
                </span>
              </div>
              <p className="text-xs font-medium truncate">{facility.facility}</p>
            </div>
          ))}
        </div>
      </Card>

      {/* 이번달 요약 */}
      <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
        <div className="bg-gradient-to-br from-museum-green to-museum-green-light rounded-xl p-5 text-white">
          <div className="flex items-center gap-2 mb-3">
            <CalendarCheck className="w-5 h-5 opacity-80" />
            <span className="text-sm font-medium opacity-80">이번달 예약</span>
          </div>
          <p className="text-3xl font-bold">{formatNumber(stats.monthly_reservations)}</p>
          <p className="text-xs opacity-70 mt-1">건</p>
        </div>
        <div className="bg-gradient-to-br from-silk-gold to-silk-gold-light rounded-xl p-5 text-white">
          <div className="flex items-center gap-2 mb-3">
            <DollarSign className="w-5 h-5 opacity-80" />
            <span className="text-sm font-medium opacity-80">이번달 매출</span>
          </div>
          <p className="text-3xl font-bold">{formatCurrency(stats.monthly_revenue)}</p>
        </div>
        <div className="bg-gradient-to-br from-blue-600 to-blue-500 rounded-xl p-5 text-white">
          <div className="flex items-center gap-2 mb-3">
            <Users className="w-5 h-5 opacity-80" />
            <span className="text-sm font-medium opacity-80">이번달 방문객</span>
          </div>
          <p className="text-3xl font-bold">{formatNumber(stats.monthly_visitors)}</p>
          <p className="text-xs opacity-70 mt-1">명</p>
        </div>
      </div>
    </div>
  );
}
