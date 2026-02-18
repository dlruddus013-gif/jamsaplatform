// ============================================================================
// 공통 카드 컴포넌트
// ============================================================================

interface CardProps {
  title?: string;
  icon?: string;
  action?: React.ReactNode;
  children: React.ReactNode;
  className?: string;
}

export default function Card({
  title,
  icon,
  action,
  children,
  className = '',
}: CardProps) {
  return (
    <div
      className={`bg-white rounded-[14px] shadow-sm border border-museum-border mb-4 overflow-hidden ${className}`}
    >
      {title && (
        <div className="px-5 py-4 border-b border-museum-border flex justify-between items-center">
          <h3 className="text-[15px] font-extrabold text-museum-primary flex items-center gap-1.5">
            {icon && <span>{icon}</span>}
            {title}
          </h3>
          {action && <div>{action}</div>}
        </div>
      )}
      <div className="p-5">{children}</div>
    </div>
  );
}
