import React from 'react';

interface StatCardProps {
  title: string;
  value: string | number;
  subtitle?: string;
  icon: React.ComponentType<{ className?: string }>;
  badge?: {
    text: string;
    variant: 'positive' | 'negative' | 'neutral' | 'warning';
  };
}

export const StatCard: React.FC<StatCardProps> = ({
  title,
  value,
  subtitle,
  icon: Icon,
  badge
}) => {
  const badgeColors = {
    positive: 'bg-emerald-50 text-emerald-700 border-emerald-200/80',
    negative: 'bg-rose-50 text-rose-700 border-rose-200/80',
    warning: 'bg-amber-50 text-amber-700 border-amber-200/80',
    neutral: 'bg-slate-100 text-slate-700 border-slate-200/80'
  };

  return (
    <div className="bg-white rounded-xl border border-slate-200/90 p-5 shadow-[0_1px_2px_rgba(0,0,0,0.04)] hover:border-slate-300 hover:shadow-[0_2px_4px_rgba(0,0,0,0.05)] transition-all">
      <div className="flex items-center justify-between">
        <span className="text-[11px] font-semibold text-slate-500 uppercase tracking-wider">
          {title}
        </span>
        <div className="p-1.5 rounded-md bg-slate-50 text-slate-400 border border-slate-150">
          <Icon className="w-3.5 h-3.5" />
        </div>
      </div>

      <div className="mt-3 flex items-baseline justify-between">
        <span className="text-2xl font-bold text-slate-900 tracking-tight font-mono">
          {value}
        </span>
        {badge && (
          <span className={`text-[10px] font-semibold px-2 py-0.5 rounded-full border shadow-2xs ${badgeColors[badge.variant]}`}>
            {badge.text}
          </span>
        )}
      </div>

      {subtitle && (
        <p className="mt-1.5 text-xs text-slate-500 leading-snug">
          {subtitle}
        </p>
      )}
    </div>
  );
};
