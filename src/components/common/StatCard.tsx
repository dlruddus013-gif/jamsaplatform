import type { ReactNode } from 'react';

interface StatCardProps {
  title: string;
  value: string | number;
  change?: { value: number; label: string };
  icon: ReactNode;
  iconColor?: string;
  trend?: 'up' | 'down' | 'neutral';
}

export default function StatCard({
  title,
  value,
  change,
  icon,
  iconColor = 'bg-museum-green/10 text-museum-green',
  trend,
}: StatCardProps) {
  return (
    <div className="bg-card-bg rounded-xl border border-border p-4 card-hover">
      <div className="flex items-start justify-between">
        <div className="flex-1">
          <p className="text-xs font-medium text-text-muted">{title}</p>
          <p className="text-2xl font-bold mt-1">{value}</p>
          {change && (
            <div className="flex items-center gap-1 mt-2">
              <span
                className={`text-xs font-medium ${
                  trend === 'up'
                    ? 'text-success'
                    : trend === 'down'
                    ? 'text-danger'
                    : 'text-text-muted'
                }`}
              >
                {trend === 'up' ? '↑' : trend === 'down' ? '↓' : '→'} {Math.abs(change.value)}%
              </span>
              <span className="text-xs text-text-muted">{change.label}</span>
            </div>
          )}
        </div>
        <div className={`w-10 h-10 rounded-xl flex items-center justify-center ${iconColor}`}>
          {icon}
        </div>
      </div>
    </div>
  );
}
