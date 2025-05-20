import React from 'react';
import { X } from 'lucide-react';

interface FilterTagProps {
  label: string;
  value?: string | number | boolean;
  onRemove: () => void;
  color?: 'blue' | 'green' | 'red' | 'purple' | 'amber' | 'indigo' | 'gray';
}

/**
 * FilterTag component displays an active filter with remove option
 * Used in report pages to show active filters
 */
const FilterTag: React.FC<FilterTagProps> = ({
  label,
  value,
  onRemove,
  color = 'indigo'
}) => {
  const colorClasses = {
    blue: 'bg-blue-100 text-blue-800',
    green: 'bg-green-100 text-green-800',
    red: 'bg-red-100 text-red-800',
    purple: 'bg-purple-100 text-purple-800',
    amber: 'bg-amber-100 text-amber-800',
    indigo: 'bg-indigo-100 text-indigo-800',
    gray: 'bg-gray-100 text-gray-800'
  }[color];

  return (
    <span className={`inline-flex items-center px-2.5 py-0.5 rounded-full text-xs ${colorClasses}`}>
      {label}
      {value !== undefined && `: ${value}`}
      <button
        type="button"
        onClick={onRemove}
        className="flex-shrink-0 ml-1 h-4 w-4 rounded-full inline-flex items-center justify-center focus:outline-none focus:text-white hover:bg-gray-200 hover:bg-opacity-10"
      >
        <X className="h-3 w-3" />
      </button>
    </span>
  );
};

export default FilterTag;