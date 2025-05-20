import React from 'react';
import { Outlet } from 'react-router-dom';
import ReportingMenu from './ReportingMenu';

/**
 * Layout component for reporting pages
 * Provides a consistent layout with a side menu for all reporting features
 */
const ReportingLayout: React.FC = () => {
  return (
    <div className="flex flex-col md:flex-row gap-4 sm:gap-6">
      <div className="md:w-1/4">
        <ReportingMenu />
      </div>
      <div className="md:w-3/4">
        <Outlet />
      </div>
    </div>
  );
};

export default ReportingLayout;