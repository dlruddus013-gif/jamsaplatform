import {
  Building2,
  Search,
  BarChart3,
  TrendingUp,
  DollarSign,
  Calendar,
  Phone,
  Mail,
  ArrowRight,
  Star,
  Filter,
} from 'lucide-react';
import { useState } from 'react';
import { BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer } from 'recharts';
import Card from '../components/common/Card';
import StatCard from '../components/common/StatCard';
import StatusBadge from '../components/common/StatusBadge';
import { formatCurrency, formatNumber } from '../utils/format';

interface AgencyPerformance {
  name: string;
  reservations: number;
  revenue: number;
  commission: number;
  rating: number;
  status: 'active' | 'inactive';
  recentBookings: { month: string; count: number }[];
}

const agencies: AgencyPerformance[] = [
  {
    name: '행복투어',
    reservations: 156,
    revenue: 23400000,
    commission: 2340000,
    rating: 4.8,
    status: 'active',
    recentBookings: [
      { month: '9월', count: 12 },
      { month: '10월', count: 18 },
      { month: '11월', count: 15 },
      { month: '12월', count: 22 },
      { month: '1월', count: 20 },
      { month: '2월', count: 14 },
    ],
  },
  {
    name: '교육나라',
    reservations: 89,
    revenue: 15680000,
    commission: 1254400,
    rating: 4.5,
    status: 'active',
    recentBookings: [
      { month: '9월', count: 8 },
      { month: '10월', count: 15 },
      { month: '11월', count: 12 },
      { month: '12월', count: 18 },
      { month: '1월', count: 16 },
      { month: '2월', count: 10 },
    ],
  },
  {
    name: '신나는 여행',
    reservations: 45,
    revenue: 8100000,
    commission: 972000,
    rating: 4.2,
    status: 'active',
    recentBookings: [
      { month: '9월', count: 5 },
      { month: '10월', count: 8 },
      { month: '11월', count: 7 },
      { month: '12월', count: 10 },
      { month: '1월', count: 9 },
      { month: '2월', count: 6 },
    ],
  },
];

const chartData = [
  { name: '9월', 행복투어: 12, 교육나라: 8, 신나는여행: 5 },
  { name: '10월', 행복투어: 18, 교육나라: 15, 신나는여행: 8 },
  { name: '11월', 행복투어: 15, 교육나라: 12, 신나는여행: 7 },
  { name: '12월', 행복투어: 22, 교육나라: 18, 신나는여행: 10 },
  { name: '1월', 행복투어: 20, 교육나라: 16, 신나는여행: 9 },
  { name: '2월', 행복투어: 14, 교육나라: 10, 신나는여행: 6 },
];

export default function AgencyPage() {
  const [selectedAgency, setSelectedAgency] = useState<AgencyPerformance | null>(null);

  const totalReservations = agencies.reduce((s, a) => s + a.reservations, 0);
  const totalRevenue = agencies.reduce((s, a) => s + a.revenue, 0);
  const totalCommission = agencies.reduce((s, a) => s + a.commission, 0);

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-lg font-bold">대행사</h1>
          <p className="text-xs text-text-muted mt-0.5">대행사 실적 및 협업 현황</p>
        </div>
      </div>

      {/* 통계 카드 */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-3">
        <StatCard
          title="전체 대행사"
          value={`${agencies.length}곳`}
          icon={<Building2 className="w-5 h-5" />}
        />
        <StatCard
          title="총 예약 건수"
          value={formatNumber(totalReservations)}
          icon={<BarChart3 className="w-5 h-5" />}
          iconColor="bg-blue-50 text-blue-600"
          change={{ value: 8, label: '전월 대비' }}
          trend="up"
        />
        <StatCard
          title="총 매출"
          value={formatCurrency(totalRevenue)}
          icon={<DollarSign className="w-5 h-5" />}
          iconColor="bg-emerald-50 text-emerald-600"
          change={{ value: 12, label: '전월 대비' }}
          trend="up"
        />
        <StatCard
          title="총 수수료"
          value={formatCurrency(totalCommission)}
          icon={<TrendingUp className="w-5 h-5" />}
          iconColor="bg-silk-gold/10 text-silk-gold"
        />
      </div>

      {/* 대행사별 실적 차트 */}
      <Card
        title="대행사별 예약 추이"
        subtitle="최근 6개월"
        action={
          <div className="flex items-center gap-3 text-xs">
            <span className="flex items-center gap-1"><span className="w-2.5 h-2.5 rounded-full bg-museum-green" />행복투어</span>
            <span className="flex items-center gap-1"><span className="w-2.5 h-2.5 rounded-full bg-blue-500" />교육나라</span>
            <span className="flex items-center gap-1"><span className="w-2.5 h-2.5 rounded-full bg-silk-gold" />신나는 여행</span>
          </div>
        }
      >
        <div className="h-64">
          <ResponsiveContainer width="100%" height="100%">
            <BarChart data={chartData}>
              <CartesianGrid strokeDasharray="3 3" stroke="#E2E8F0" />
              <XAxis dataKey="name" tick={{ fontSize: 11, fill: '#94A3B8' }} />
              <YAxis tick={{ fontSize: 11, fill: '#94A3B8' }} />
              <Tooltip contentStyle={{ borderRadius: '8px', border: '1px solid #E2E8F0', fontSize: '12px' }} />
              <Bar dataKey="행복투어" fill="#2D5016" radius={[4, 4, 0, 0]} />
              <Bar dataKey="교육나라" fill="#3B82F6" radius={[4, 4, 0, 0]} />
              <Bar dataKey="신나는여행" fill="#8B6914" radius={[4, 4, 0, 0]} />
            </BarChart>
          </ResponsiveContainer>
        </div>
      </Card>

      {/* 대행사 카드 */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
        {agencies.map((agency) => (
          <div
            key={agency.name}
            className="bg-card-bg border border-border rounded-xl overflow-hidden card-hover cursor-pointer"
            onClick={() => setSelectedAgency(agency)}
          >
            <div className="p-4">
              <div className="flex items-start justify-between mb-3">
                <div className="flex items-center gap-3">
                  <div className="w-11 h-11 rounded-xl bg-museum-green/10 text-museum-green flex items-center justify-center">
                    <Building2 className="w-5 h-5" />
                  </div>
                  <div>
                    <h3 className="text-sm font-bold">{agency.name}</h3>
                    <div className="flex items-center gap-1 mt-0.5">
                      <Star className="w-3 h-3 text-silk-gold fill-silk-gold" />
                      <span className="text-xs font-medium text-silk-gold">{agency.rating}</span>
                    </div>
                  </div>
                </div>
                <StatusBadge
                  status={agency.status}
                  label={agency.status === 'active' ? '활성' : '비활성'}
                />
              </div>

              <div className="grid grid-cols-3 gap-3 mt-4">
                <div className="text-center p-2 bg-gray-50 rounded-lg">
                  <p className="text-xs text-text-muted">예약</p>
                  <p className="text-sm font-bold mt-0.5">{agency.reservations}건</p>
                </div>
                <div className="text-center p-2 bg-gray-50 rounded-lg">
                  <p className="text-xs text-text-muted">매출</p>
                  <p className="text-sm font-bold mt-0.5">{(agency.revenue / 10000).toFixed(0)}만</p>
                </div>
                <div className="text-center p-2 bg-gray-50 rounded-lg">
                  <p className="text-xs text-text-muted">수수료</p>
                  <p className="text-sm font-bold mt-0.5">{(agency.commission / 10000).toFixed(0)}만</p>
                </div>
              </div>

              {/* 최근 실적 미니 바 */}
              <div className="flex items-end gap-1 mt-3 h-8">
                {agency.recentBookings.map((b) => (
                  <div key={b.month} className="flex-1 flex flex-col items-center">
                    <div
                      className="w-full bg-museum-green/20 rounded-t"
                      style={{ height: `${(b.count / 25) * 32}px` }}
                    />
                  </div>
                ))}
              </div>
              <div className="flex justify-between mt-1">
                {agency.recentBookings.map((b) => (
                  <span key={b.month} className="text-[9px] text-text-muted flex-1 text-center">
                    {b.month.replace('월', '')}
                  </span>
                ))}
              </div>
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}
