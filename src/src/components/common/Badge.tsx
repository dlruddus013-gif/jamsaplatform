// ============================================================================
// 공통 뱃지 컴포넌트
// ============================================================================

type BadgeVariant = 'green' | 'yellow' | 'red' | 'blue' | 'gray';

interface BadgeProps {
  variant?: BadgeVariant;
  children: React.ReactNode;
  className?: string;
}

const variantStyles: Record<BadgeVariant, string> = {
  green: 'bg-green-100 text-green-800',
  yellow: 'bg-yellow-50 text-yellow-700',
  red: 'bg-red-100 text-red-800',
  blue: 'bg-blue-100 text-blue-800',
  gray: 'bg-gray-100 text-gray-600',
};

export default function Badge({
  variant = 'gray',
  children,
  className = '',
}: BadgeProps) {
  return (
    <span
      className={`inline-block px-2 py-0.5 rounded-full text-[10px] font-bold ${variantStyles[variant]} ${className}`}
    >
      {children}
    </span>
  );
}

/** 예약 상태에 따른 뱃지 */
export function StatusBadge({ status }: { status: string }) {
  const map: Record<string, BadgeVariant> = {
    접수: 'blue',
    대기: 'yellow',
    확정: 'green',
    취소: 'red',
  };
  const icons: Record<string, string> = {
    접수: '📋',
    대기: '⏳',
    확정: '✅',
    취소: '❌',
  };
  return (
    <Badge variant={map[status] || 'gray'}>
      {icons[status] || ''} {status}
    </Badge>
  );
}
