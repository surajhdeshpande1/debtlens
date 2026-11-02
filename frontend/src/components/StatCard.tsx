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
    positive: 'bg-blue-50 text-blue-900 border-blue-200 ring-1 ring-blue-500/20',
    negative: 'bg-rose-50 text-rose-900 border-rose-200 ring-1 ring-rose-500/20',
    warning: 'bg-amber-50 text-amber-900 border-amber-200 ring-1 ring-amber-500/20',
    neutral: 'bg-purple-50 text-purple-900 border-purple-200 ring-1 ring-purple-500/20'
  };

  return (
    <div className="bg-white/95 rounded-xl border border-[#EADBCE] p-4 sm:p-5 shadow-xs hover:border-[#D1BFA8] hover:shadow-md transition-all duration-150 flex flex-col justify-between">
      <div>
        <div className="flex items-center justify-between">
          <span className="text-xs font-semibold text-stone-500 uppercase tracking-wider">
            {title}
          </span>
          <div className="w-8 h-8 rounded-lg bg-[#F5EFEB] flex items-center justify-center text-purple-700 border border-[#EADBCE] shadow-2xs">
            <Icon className="w-4 h-4 text-purple-700" />
          </div>
        </div>

        <div className="mt-3 flex items-baseline justify-between gap-2 flex-wrap">
          <span className="text-2xl sm:text-3xl font-extrabold text-slate-950 tracking-tight font-mono">
            {value}
          </span>
          {badge && (
            <span className={`text-xs font-bold px-2 py-0.5 rounded-md border shadow-2xs ${badgeColors[badge.variant]}`}>
              {badge.text}
            </span>
          )}
        </div>
      </div>

      {subtitle && (
        <p className="mt-2 text-xs text-stone-600 font-medium leading-relaxed border-t border-[#F5EFEB] pt-2">
          {subtitle}
        </p>
      )}
    </div>
  );
};
