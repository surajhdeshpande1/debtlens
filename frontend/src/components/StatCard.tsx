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
    positive: 'bg-emerald-50 text-emerald-900 border-emerald-300 font-bold',
    negative: 'bg-rose-50 text-rose-900 border-rose-300 font-bold',
    warning: 'bg-amber-50 text-amber-900 border-amber-300 font-bold',
    neutral: 'bg-[#F2ECE1] text-stone-800 border-[#DDD5C7] font-semibold'
  };

  return (
    <div className="bg-white rounded-md border border-[#E2DDD5] p-4 flex flex-col justify-between shadow-[0_1px_2px_rgba(0,0,0,0.02)] hover:border-[#064E3B]/40 transition-colors">
      <div>
        <div className="flex items-center justify-between">
          <span className="text-[11px] font-mono font-bold uppercase tracking-wider text-[#64748B]">
            {title}
          </span>
          <div className="w-7 h-7 rounded-sm bg-[#F4EFE6] flex items-center justify-center text-[#064E3B] border border-[#E2DDD5]">
            <Icon className="w-3.5 h-3.5" />
          </div>
        </div>

        <div className="mt-2.5 flex items-baseline justify-between gap-2 flex-wrap">
          <span className="text-2xl sm:text-3xl font-black text-[#0F172A] tracking-tight font-mono tabular-nums">
            {value}
          </span>
          {badge && (
            <span className={`text-[11px] font-mono px-2 py-0.5 rounded-xs border ${badgeColors[badge.variant]}`}>
              {badge.text}
            </span>
          )}
        </div>
      </div>

      {subtitle && (
        <p className="mt-3 text-[11px] text-[#64748B] font-mono leading-relaxed border-t border-[#F0ECE1] pt-2">
          {subtitle}
        </p>
      )}
    </div>
  );
};
