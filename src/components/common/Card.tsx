import type { ReactNode } from 'react';

interface CardProps {
  children: ReactNode;
  title?: string;
  subtitle?: string;
  action?: ReactNode;
  className?: string;
  padding?: 'none' | 'sm' | 'md' | 'lg';
  hover?: boolean;
}

export default function Card({
  children,
  title,
  subtitle,
  action,
  className = '',
  padding = 'md',
  hover = false,
}: CardProps) {
  const paddingClass = {
    none: '',
    sm: 'p-3',
    md: 'p-4',
    lg: 'p-6',
  }[padding];

  return (
    <div
      className={`bg-card-bg rounded-xl border border-border ${
        hover ? 'card-hover cursor-pointer' : ''
      } ${className}`}
    >
      {(title || action) && (
        <div className="flex items-center justify-between px-4 py-3 border-b border-border">
          <div>
            {title && <h3 className="text-sm font-semibold text-text-primary">{title}</h3>}
            {subtitle && <p className="text-xs text-text-muted mt-0.5">{subtitle}</p>}
          </div>
          {action && <div>{action}</div>}
        </div>
      )}
      <div className={paddingClass}>{children}</div>
    </div>
  );
}
