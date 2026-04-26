import React from 'react';
import { Outlet } from 'react-router-dom';
import VolunteerSidebar from './VolunteerSidebar';
import DashboardHeader from './DashboardHeader';

export default function VolunteerDashboardLayout() {
  return (
    <div className="min-h-screen bg-gray-50 flex">
      <VolunteerSidebar />
      <div className="flex-1 ml-64 flex flex-col">
        <DashboardHeader />
        <main className="p-8">
          <div className="max-w-5xl mx-auto">
            <Outlet />
          </div>
        </main>
      </div>
    </div>
  );
}
