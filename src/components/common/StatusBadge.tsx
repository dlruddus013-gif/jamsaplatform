interface StatusBadgeProps {
  status: string;
  label: string;
  size?: 'sm' | 'md';
}

const statusColors: Record<string, string> = {
  // 예약 상태
  pending: 'bg-yellow-100 text-yellow-800 border-yellow-200',
  confirmed: 'bg-green-100 text-green-800 border-green-200',
  cancelled: 'bg-red-100 text-red-800 border-red-200',
  completed: 'bg-blue-100 text-blue-800 border-blue-200',
  noshow: 'bg-gray-100 text-gray-800 border-gray-200',
  // 시설 상태
  active: 'bg-green-100 text-green-800 border-green-200',
  maintenance: 'bg-orange-100 text-orange-800 border-orange-200',
  closed: 'bg-red-100 text-red-800 border-red-200',
  reserved: 'bg-purple-100 text-purple-800 border-purple-200',
  // 결제 상태
  unpaid: 'bg-red-100 text-red-800 border-red-200',
  partial: 'bg-yellow-100 text-yellow-800 border-yellow-200',
  paid: 'bg-green-100 text-green-800 border-green-200',
  refunded: 'bg-gray-100 text-gray-800 border-gray-200',
  // 시스템 상태
  applied: 'bg-green-100 text-green-800 border-green-200',
  failed: 'bg-red-100 text-red-800 border-red-200',
  rolled_back: 'bg-orange-100 text-orange-800 border-orange-200',
  // 패치 타입
  bugfix: 'bg-red-100 text-red-800 border-red-200',
  hotfix: 'bg-orange-100 text-orange-800 border-orange-200',
  improvement: 'bg-blue-100 text-blue-800 border-blue-200',
  // 일반
  inactive: 'bg-gray-100 text-gray-800 border-gray-200',
  draft: 'bg-gray-100 text-gray-600 border-gray-200',
};

export default function StatusBadge({ status, label, size = 'sm' }: StatusBadgeProps) {
  const colorClass = statusColors[status] || 'bg-gray-100 text-gray-800 border-gray-200';

  return (
    <span
      className={`inline-flex items-center font-medium border rounded-full ${colorClass} ${
        size === 'sm' ? 'px-2 py-0.5 text-[11px]' : 'px-2.5 py-1 text-xs'
      }`}
    >
      {label}
    </span>
  );
}
