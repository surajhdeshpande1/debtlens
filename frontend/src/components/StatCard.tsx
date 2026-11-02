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
    positive: 'bg-emerald-50 text-emerald-800 border-emerald-200 ring-1 ring-emerald-500/20',
    negative: 'bg-rose-50 text-rose-800 border-rose-200 ring-1 ring-rose-500/20',
    warning: 'bg-amber-50 text-amber-800 border-amber-200 ring-1 ring-amber-500/20',
    neutral: 'bg-slate-100 text-slate-800 border-slate-200'
  };

  return (
    <div className="bg-white rounded-xl border border-slate-200/90 p-4 sm:p-5 shadow-xs hover:border-slate-300 hover:shadow-md transition-all duration-150 flex flex-col justify-between">
      <div>
        <div className="flex items-center justify-between">
          <span className="text-xs font-semibold text-slate-500 uppercase tracking-wider">
            {title}
          </span>
          <div className="w-8 h-8 rounded-lg bg-slate-50 flex items-center justify-center text-slate-600 border border-slate-200/80 shadow-2xs">
            <Icon className="w-4 h-4 text-indigo-600" />
          </div>
        </div>

        <div className="mt-3 flex items-baseline justify-between gap-2 flex-wrap">
          <span className="text-2xl sm:text-3xl font-bold text-slate-900 tracking-tight font-mono">
            {value}
          </span>
          {badge && (
            <span className={`text-xs font-semibold px-2 py-0.5 rounded-md border shadow-2xs ${badgeColors[badge.variant]}`}>
              {badge.text}
            </span>
          )}
        </div>
      </div>

      {subtitle && (
        <p className="mt-2 text-xs text-slate-600 font-medium leading-relaxed border-t border-slate-100 pt-2">
          {subtitle}
        </p>
      )}
    </div>
  );
};
