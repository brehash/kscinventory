import React from 'react';
import { Info } from 'lucide-react';

interface ReportTooltipProps {
  content: string;
  position?: 'top' | 'right' | 'bottom' | 'left';
  width?: 'narrow' | 'medium' | 'wide';
}

/**
 * Enhanced tooltip component for report cards and fields
 * Provides hover-based tooltips with positioning options
 */
const ReportTooltip: React.FC<ReportTooltipProps> = ({
  content,
  position = 'top',
  width = 'medium'
}) => {
  const [showTooltip, setShowTooltip] = React.useState(false);
  
  // Define position-specific styles
  const getPositionStyles = () => {
    switch (position) {
      case 'top':
        return 'bottom-full left-0 mb-2';
      case 'right':
        return 'left-full top-0 ml-2';
      case 'bottom':
        return 'top-full left-0 mt-2';
      case 'left':
        return 'right-full top-0 mr-2';
      default:
        return 'bottom-full left-0 mb-2';
    }
  };
  
  // Define width styles
  const getWidthStyles = () => {
    switch (width) {
      case 'narrow':
        return 'w-40';
      case 'medium':
        return 'w-60';
      case 'wide':
        return 'w-80';
      default:
        return 'w-60';
    }
  };
  
  // Get caret (arrow) styles
  const getCaretStyles = () => {
    switch (position) {
      case 'top':
        return 'top-full left-3 -mt-1 border-t-gray-800 border-t-8 border-x-transparent border-x-4 border-b-0';
      case 'right':
        return 'right-full top-3 -mr-1 border-r-gray-800 border-r-8 border-y-transparent border-y-4 border-l-0';
      case 'bottom':
        return 'bottom-full left-3 -mb-1 border-b-gray-800 border-b-8 border-x-transparent border-x-4 border-t-0';
      case 'left':
        return 'left-full top-3 -ml-1 border-l-gray-800 border-l-8 border-y-transparent border-y-4 border-r-0';
      default:
        return 'top-full left-3 -mt-1 border-t-gray-800 border-t-8 border-x-transparent border-x-4 border-b-0';
    }
  };

  return (
    <div className="inline-block relative">
      <button 
        type="button"
        className="text-gray-500 hover:text-gray-700 transition-colors focus:outline-none"
        onMouseEnter={() => setShowTooltip(true)}
        onMouseLeave={() => setShowTooltip(false)}
        onClick={(e) => {
          e.stopPropagation();
          setShowTooltip(!showTooltip);
        }}
      >
        <Info className="h-4 w-4" />
      </button>
      
      {showTooltip && (
        <div className={`absolute z-10 ${getPositionStyles()} ${getWidthStyles()}`}>
          <div className="bg-gray-800 text-white text-xs p-2 rounded shadow-lg">
            {content}
          </div>
          {/* Tooltip caret/arrow */}
          <div className={`absolute w-0 h-0 border ${getCaretStyles()}`}></div>
        </div>
      )}
    </div>
  );
};

export default ReportTooltip;