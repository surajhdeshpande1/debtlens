import React from 'react';

interface StatCardProps {
  title: string;
  value: string | number;
  subtitle?: string;
  icon?: React.ComponentType<{ className?: string }>;
  accentColor?: string;
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
    negative: 'bg-black text-white border-black',
    warning: 'bg-zinc-800 text-white border-zinc-700',
    positive: 'bg-zinc-100 text-zinc-900 border-zinc-300',
    neutral: 'bg-zinc-50 text-zinc-700 border-zinc-200'
  };

  return (
    <div className="bg-white rounded-md border border-zinc-200 border-t-2 border-t-black p-4 sm:p-5 shadow-2xs hover:shadow-xs transition-all duration-150 flex flex-col justify-between min-h-[148px]">
      <div>
        <div className="flex items-center justify-between">
          <span className="text-[10px] font-bold text-zinc-500 uppercase tracking-wider font-mono">
            {title}
          </span>
          {Icon && (
            <div className="w-6 h-6 rounded-sm bg-zinc-100 flex items-center justify-center text-black border border-zinc-200 shrink-0">
              <Icon className="w-3.5 h-3.5" />
            </div>
          )}
        </div>

        <div className="mt-3 flex items-baseline justify-between gap-2 flex-wrap">
          <span className="text-2xl sm:text-3xl font-extrabold text-black tracking-tight font-mono">
            {value}
          </span>
          {badge && (
            <span className={`text-[10px] font-mono font-bold px-2 py-0.5 rounded-sm border shadow-2xs whitespace-nowrap ${badgeColors[badge.variant]}`}>
              {badge.text}
            </span>
          )}
        </div>
      </div>

      {subtitle && (
        <p className="mt-3 text-xs text-zinc-600 font-medium leading-relaxed border-t border-zinc-100 pt-2">
          {subtitle}
        </p>
      )}
    </div>
  );
};
