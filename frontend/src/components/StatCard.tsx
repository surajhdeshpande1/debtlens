import React from 'react';

interface StatCardProps {
  title: string;
  value: string | number;
  subtitle?: string;
  icon?: React.ComponentType<{ className?: string }>;
  accentColor?: 'navy' | 'oxblood' | 'forest' | 'amber';
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
  accentColor = 'navy',
  badge
}) => {
  const accentTopBorders = {
    navy: 'border-t-2 border-t-[#0C1A2E]',
    oxblood: 'border-t-2 border-t-[#8E2825]',
    forest: 'border-t-2 border-t-[#1E4E38]',
    amber: 'border-t-2 border-t-[#8A6112]'
  };

  const badgeColors = {
    positive: 'bg-[#EDF6F1] text-[#1E4E38] border-[#BCD8C7]',
    negative: 'bg-[#FDF2F2] text-[#8E2825] border-[#E8B4B2]',
    warning: 'bg-[#FEF9EE] text-[#8A6112] border-[#EBD8A3]',
    neutral: 'bg-[#F4EFE6] text-stone-700 border-[#DDD5C7]'
  };

  return (
    <div className={`bg-white rounded-md border border-[#E5DFD5] ${accentTopBorders[accentColor]} p-4 sm:p-5 shadow-2xs hover:shadow-xs transition-all duration-150 flex flex-col justify-between`}>
      <div>
        <div className="flex items-center justify-between">
          <span className="text-[10px] font-bold text-stone-500 uppercase tracking-wider font-mono">
            {title}
          </span>
          {Icon && (
            <div className="w-6 h-6 rounded-sm bg-[#F4EFE6] flex items-center justify-center text-[#0C1A2E] border border-[#E5DFD5]">
              <Icon className="w-3.5 h-3.5" />
            </div>
          )}
        </div>

        <div className="mt-2.5 flex items-baseline justify-between gap-2 flex-wrap">
          <span className="text-2xl sm:text-3xl font-extrabold text-[#0C1A2E] tracking-tight font-mono">
            {value}
          </span>
          {badge && (
            <span className={`text-[10px] font-mono font-bold px-2 py-0.5 rounded-sm border shadow-2xs ${badgeColors[badge.variant]}`}>
              {badge.text}
            </span>
          )}
        </div>
      </div>

      {subtitle && (
        <p className="mt-2.5 text-xs text-stone-600 font-medium leading-relaxed border-t border-[#F2ECE2] pt-2">
          {subtitle}
        </p>
      )}
    </div>
  );
};
