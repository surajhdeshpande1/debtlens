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
    negative: 'bg-red-50 text-red-700 border-red-200',
    warning: 'bg-amber-50 text-amber-700 border-amber-200',
    positive: 'bg-emerald-50 text-emerald-700 border-emerald-200',
    neutral: 'bg-slate-100 text-slate-700 border-slate-200'
  };

  const topBorderStyles = {
    crimson: 'border-t-2 border-t-red-600',
    ochre: 'border-t-2 border-t-amber-600',
    emerald: 'border-t-2 border-t-emerald-600',
    navy: 'border-t-2 border-t-slate-800'
  };

  const iconStyles = {
    crimson: 'bg-red-50 text-red-700 border-red-100',
    ochre: 'bg-amber-50 text-amber-700 border-amber-100',
    emerald: 'bg-emerald-50 text-emerald-700 border-emerald-100',
    navy: 'bg-slate-100 text-slate-800 border-slate-200'
  };

  const resolvedAccent = accentColor || (badge?.variant === 'negative' ? 'crimson' : badge?.variant === 'warning' ? 'ochre' : badge?.variant === 'positive' ? 'emerald' : 'navy');

  return (
    <div className={`bg-white rounded-md border border-slate-200/90 ${topBorderStyles[resolvedAccent]} p-4 sm:p-5 shadow-[0_1px_3px_rgba(0,0,0,0.03)] hover:shadow-md transition-all duration-150 flex flex-col justify-between min-h-[148px]`}>
      <div>
        <div className="flex items-center justify-between">
          <span className="text-[10px] font-bold text-slate-500 uppercase tracking-wider font-mono">
            {title}
          </span>
          {Icon && (
            <div className={`w-6 h-6 rounded-sm ${iconStyles[resolvedAccent]} flex items-center justify-center border shrink-0`}>
              <Icon className="w-3.5 h-3.5" />
            </div>
          )}
        </div>

        <div className="mt-3 flex items-baseline justify-between gap-2 flex-wrap">
          <span className="text-2xl sm:text-3xl font-extrabold text-slate-900 tracking-tight font-mono">
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
        <p className="mt-3 text-xs text-slate-600 font-medium leading-relaxed border-t border-slate-100 pt-2">
          {subtitle}
        </p>
      )}
    </div>
  );
};
