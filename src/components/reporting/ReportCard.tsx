import React, { ReactNode } from 'react';
import ReportTooltip from './ReportTooltip';

interface ReportCardProps {
  title: string;
  value: string | number | ReactNode;
  icon: ReactNode;
  color: string;
  tooltip?: string;
  footer?: ReactNode;
  onClick?: () => void;
}

/**
 * Enhanced Report Card component with tooltips
 * Used throughout the reporting section to display metrics
 */
const ReportCard: React.FC<ReportCardProps> = ({
  title,
  value,
  icon,
  color,
  tooltip,
  footer,
  onClick
}) => {
  const bgColor = {
    blue: 'bg-blue-50 border-blue-200',
    green: 'bg-green-50 border-green-200',
    red: 'bg-red-50 border-red-200',
    yellow: 'bg-amber-50 border-amber-200',
    purple: 'bg-purple-50 border-purple-200',
    indigo: 'bg-indigo-50 border-indigo-200',
    gray: 'bg-gray-50 border-gray-200',
    teal: 'bg-teal-50 border-teal-200',
  }[color] || 'bg-gray-50 border-gray-200';
  
  const iconColor = {
    blue: 'text-blue-500',
    green: 'text-green-500',
    red: 'text-red-500',
    yellow: 'text-amber-500',
    purple: 'text-purple-500',
    indigo: 'text-indigo-500',
    gray: 'text-gray-500',
    teal: 'text-teal-500',
  }[color] || 'text-gray-500';

  return (
    <div 
      className={`p-4 rounded-lg border ${bgColor} ${onClick ? 'cursor-pointer hover:shadow-md transition-shadow' : ''}`}
      onClick={onClick}
    >
      <div className="flex items-center justify-between mb-2">
        <div className={`rounded-full p-2 ${iconColor} bg-white`}>
          {icon}
        </div>
        
        {tooltip && (
          <ReportTooltip content={tooltip} position="top" />
        )}
      </div>
      
      <div className="flex flex-col">
        <div className="text-xs font-medium text-gray-500">{title}</div>
        <div className="text-xl font-bold text-gray-800 mt-1">{value}</div>
      </div>
      
      {footer && (
        <div className="mt-3 pt-2 border-t border-gray-200">
          {footer}
        </div>
      )}
    </div>
  );
};

export default ReportCard;