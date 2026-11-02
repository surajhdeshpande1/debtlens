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
    <div className="bg-white rounded-2xl border border-slate-200/90 p-6 sm:p-7 shadow-xs hover:border-slate-300 hover:shadow-lg transition-all duration-200 flex flex-col justify-between">
      <div>
        <div className="flex items-center justify-between">
          <span className="text-sm sm:text-base font-bold text-slate-600 uppercase tracking-wider">
            {title}
          </span>
          <div className="w-10 h-10 rounded-xl bg-slate-50 flex items-center justify-center text-slate-600 border border-slate-200/80 shadow-2xs">
            <Icon className="w-5 h-5 text-indigo-600" />
          </div>
        </div>

        <div className="mt-4 flex items-baseline justify-between gap-2 flex-wrap">
          <span className="text-4xl sm:text-5xl font-black text-slate-900 tracking-tight font-mono">
            {value}
          </span>
          {badge && (
            <span className={`text-xs sm:text-sm font-bold px-3 py-1 rounded-full border shadow-2xs ${badgeColors[badge.variant]}`}>
              {badge.text}
            </span>
          )}
        </div>
      </div>

      {subtitle && (
        <p className="mt-3 text-sm text-slate-600 font-medium leading-relaxed border-t border-slate-100 pt-2.5">
          {subtitle}
        </p>
      )}
    </div>
  );
};
