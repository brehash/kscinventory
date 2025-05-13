import React, { useState } from 'react';
import { Info } from 'lucide-react';

interface StatCardProps {
  title: string;
  value: string | number;
  icon: React.ReactNode;
  iconBg: string;
  iconColor: string;
  tooltipText: string; // Added tooltipText prop
}

const StatCard: React.FC<StatCardProps> = ({ title, value, icon, iconBg, iconColor, tooltipText }) => {
  const [showTooltip, setShowTooltip] = useState(false);
  
  return (
    <div className="relative bg-white p-4 sm:p-6 rounded-lg shadow-sm border border-gray-100 transition-all duration-300 hover:shadow-md">
      <div 
        className="absolute top-2 right-2 text-gray-400 cursor-pointer hover:text-gray-600"
        onMouseEnter={() => setShowTooltip(true)}
        onMouseLeave={() => setShowTooltip(false)}
      >
        <Info className="h-4 w-4" />
        
        {showTooltip && (
          <div className="absolute right-0 top-0 mt-6 w-48 sm:w-64 bg-gray-800 text-white text-xs rounded py-2 px-3 z-10 shadow-lg">
            {tooltipText}
            <div className="absolute -top-1 right-0 mr-1 w-2 h-2 bg-gray-800 transform rotate-45"></div>
          </div>
        )}
      </div>
      
      <div className="flex items-center">
        <div className={`rounded-full p-2 sm:p-3 mr-3 sm:mr-4 ${iconBg}`}>
          <div className={iconColor}>{icon}</div>
        </div>
        <div>
          <h3 className="text-xs sm:text-sm text-gray-500 font-medium">{title}</h3>
          <p className="text-lg sm:text-2xl font-bold text-gray-800 mt-1">{value}</p>
        </div>
      </div>
    </div>
  );
};

export default StatCard;