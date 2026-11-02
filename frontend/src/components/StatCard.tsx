import React from 'react';

export type StatCardTheme = 'indigo' | 'amber' | 'rose' | 'purple' | 'emerald' | 'sky' | 'teal' | 'red' | 'slate';

interface StatCardProps {
  title: string;
  value: string | number;
  subtitle?: string;
  icon: React.ComponentType<{ className?: string }>;
  badge?: {
    text: string;
    variant: 'positive' | 'negative' | 'neutral' | 'warning';
  };
  accentColor?: string;
  theme?: StatCardTheme;
}

const themeStyles: Record<StatCardTheme, {
  topBorder: string;
  iconBg: string;
  iconText: string;
  cardGlow: string;
}> = {
  indigo: {
    topBorder: 'border-t-indigo-500',
    iconBg: 'bg-indigo-50 border-indigo-200/80',
    iconText: 'text-indigo-600',
    cardGlow: 'hover:border-indigo-200 hover:shadow-indigo-50/60'
  },
  amber: {
    topBorder: 'border-t-amber-500',
    iconBg: 'bg-amber-50 border-amber-200/80',
    iconText: 'text-amber-600',
    cardGlow: 'hover:border-amber-200 hover:shadow-amber-50/60'
  },
  rose: {
    topBorder: 'border-t-rose-500',
    iconBg: 'bg-rose-50 border-rose-200/80',
    iconText: 'text-rose-600',
    cardGlow: 'hover:border-rose-200 hover:shadow-rose-50/60'
  },
  red: {
    topBorder: 'border-t-red-500',
    iconBg: 'bg-red-50 border-red-200/80',
    iconText: 'text-red-600',
    cardGlow: 'hover:border-red-200 hover:shadow-red-50/60'
  },
  purple: {
    topBorder: 'border-t-purple-500',
    iconBg: 'bg-purple-50 border-purple-200/80',
    iconText: 'text-purple-600',
    cardGlow: 'hover:border-purple-200 hover:shadow-purple-50/60'
  },
  emerald: {
    topBorder: 'border-t-emerald-500',
    iconBg: 'bg-emerald-50 border-emerald-200/80',
    iconText: 'text-emerald-600',
    cardGlow: 'hover:border-emerald-200 hover:shadow-emerald-50/60'
  },
  sky: {
    topBorder: 'border-t-sky-500',
    iconBg: 'bg-sky-50 border-sky-200/80',
    iconText: 'text-sky-600',
    cardGlow: 'hover:border-sky-200 hover:shadow-sky-50/60'
  },
  teal: {
    topBorder: 'border-t-teal-500',
    iconBg: 'bg-teal-50 border-teal-200/80',
    iconText: 'text-teal-600',
    cardGlow: 'hover:border-teal-200 hover:shadow-teal-50/60'
  },
  slate: {
    topBorder: 'border-t-slate-400',
    iconBg: 'bg-slate-100 border-slate-200',
    iconText: 'text-slate-600',
    cardGlow: 'hover:border-slate-300'
  }
};

export const StatCard: React.FC<StatCardProps> = ({
  title,
  value,
  subtitle,
  icon: Icon,
  badge,
  accentColor,
  theme = 'indigo'
}) => {
  const currentTheme = themeStyles[theme] || themeStyles.indigo;

  const badgeColors = {
    positive: 'bg-emerald-50 text-emerald-700 border-emerald-200',
    negative: 'bg-rose-50 text-rose-700 border-rose-200',
    warning: 'bg-amber-50 text-amber-700 border-amber-200',
    neutral: 'bg-slate-100 text-slate-700 border-slate-200'
  };

  const iconClasses = accentColor 
    ? accentColor 
    : `${currentTheme.iconBg} ${currentTheme.iconText}`;

  return (
    <div className={`bg-white rounded-xl border border-slate-200 border-t-3 ${currentTheme.topBorder} p-5 shadow-xs transition-all duration-200 ${currentTheme.cardGlow} hover:shadow-md`}>
      <div className="flex items-center justify-between">
        <span className="text-xs font-semibold text-slate-500 uppercase tracking-wider">{title}</span>
        <div className={`p-2 rounded-lg border ${iconClasses}`}>
          <Icon className="w-4 h-4" />
        </div>
      </div>

      <div className="mt-3 flex items-baseline justify-between">
        <span className="text-2xl font-bold text-slate-900 tracking-tight">{value}</span>
        {badge && (
          <span className={`text-[11px] font-semibold px-2 py-0.5 rounded-full border shadow-2xs ${badgeColors[badge.variant]}`}>
            {badge.text}
          </span>
        )}
      </div>

      {subtitle && (
        <p className="mt-1 text-xs text-slate-500">{subtitle}</p>
      )}
    </div>
  );
};
