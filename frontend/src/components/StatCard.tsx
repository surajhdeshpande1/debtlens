import React from 'react';

interface StatCardProps {
  title: string;
  value: string | number;
  subtitle?: string;
  icon?: React.ComponentType<{ className?: string }>;
  accentColor?: 'crimson' | 'ochre' | 'emerald' | 'navy';
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
  accentColor,
  badge
}) => {
  const badgeStyles = {
    negative: 'bg-[#FDF2F4] text-[#881337] border-[#F8D2DB]',
    warning: 'bg-[#FEF9EE] text-[#B45309] border-[#FDE68A]',
    positive: 'bg-[#ECFDF5] text-[#065F46] border-[#A7F3D0]',
    neutral: 'bg-[#F4F2EB] text-[#0A2E23] border-[#E2DFD6]'
  };

  const topBorderStyles = {
    crimson: 'border-t-2 border-t-[#881337]',
    ochre: 'border-t-2 border-t-[#D97706]',
    emerald: 'border-t-2 border-t-[#059669]',
    navy: 'border-t-2 border-t-[#064E3B]'
  };

  const iconStyles = {
    crimson: 'bg-[#FDF2F4] text-[#881337] border-[#F8D2DB]',
    ochre: 'bg-[#FEF9EE] text-[#B45309] border-[#FDE68A]',
    emerald: 'bg-[#ECFDF5] text-[#065F46] border-[#A7F3D0]',
    navy: 'bg-[#F4F2EB] text-[#064E3B] border-[#E2DFD6]'
  };

  const resolvedAccent = accentColor || (badge?.variant === 'negative' ? 'crimson' : badge?.variant === 'warning' ? 'ochre' : badge?.variant === 'positive' ? 'emerald' : 'navy');

  return (
    <div className={`bg-white rounded-md border border-[#E5E2DA] ${topBorderStyles[resolvedAccent]} p-4 sm:p-5 shadow-[0_1px_3px_rgba(0,0,0,0.03)] hover:shadow-md transition-all duration-150 flex flex-col justify-between min-h-[148px]`}>
      <div>
        <div className="flex items-center justify-between">
          <span className="text-[10px] font-bold text-stone-500 uppercase tracking-wider font-mono">
            {title}
          </span>
          {Icon && (
            <div className={`w-6 h-6 rounded-sm ${iconStyles[resolvedAccent]} flex items-center justify-center border shrink-0`}>
              <Icon className="w-3.5 h-3.5" />
            </div>
          )}
        </div>

        <div className="mt-3 flex items-baseline justify-between gap-2 flex-wrap">
          <span className="text-2xl sm:text-3xl font-extrabold text-[#0A2E23] tracking-tight font-mono">
            {value}
          </span>
          {badge && (
            <span className={`text-[10px] font-mono font-bold px-2 py-0.5 rounded-sm border whitespace-nowrap ${badgeStyles[badge.variant]}`}>
              {badge.text}
            </span>
          )}
        </div>
      </div>

      {subtitle && (
        <p className="mt-3 text-xs text-stone-600 font-medium leading-relaxed border-t border-[#F0EDE5] pt-2">
          {subtitle}
        </p>
      )}
    </div>
  );
};
