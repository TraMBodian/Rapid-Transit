import React from 'react';
import { AlertTriangle, CheckCircle2, OctagonAlert } from 'lucide-react';
import { TrafficStatus } from '../types/transit';

interface StatusBadgeProps {
  status: TrafficStatus;
  label: string;
  compact?: boolean;
}

export const StatusBadge: React.FC<StatusBadgeProps> = ({
  status,
  label,
  compact = false,
}) => {
  const config = {
    green: {
      wrapper:
        'bg-emerald-50 text-emerald-800 border-emerald-200 dark:bg-emerald-950/60 dark:text-emerald-300 dark:border-emerald-800/70',
      Icon: CheckCircle2,
      iconClass: 'text-emerald-600 dark:text-emerald-400',
    },
    orange: {
      wrapper:
        'bg-amber-50 text-amber-800 border-amber-200 dark:bg-amber-950/60 dark:text-amber-300 dark:border-amber-800/70',
      Icon: AlertTriangle,
      iconClass: 'text-amber-600 dark:text-amber-400',
    },
    red: {
      wrapper:
        'bg-red-50 text-red-800 border-red-200 dark:bg-red-950/60 dark:text-red-300 dark:border-red-800/70',
      Icon: OctagonAlert,
      iconClass: 'text-red-600 dark:text-red-400',
    },
  }[status];

  const { Icon } = config;

  return (
    <span
      className={`inline-flex items-center gap-1.5 border font-medium whitespace-nowrap shrink-0 rounded-md ${
        compact ? 'px-2 py-0.5 text-xs' : 'px-2.5 py-1 text-xs'
      } ${config.wrapper}`}
    >
      <Icon
        className={`w-3.5 h-3.5 shrink-0 ${config.iconClass}`}
        aria-hidden="true"
      />
      <span>{label}</span>
    </span>
  );
};
