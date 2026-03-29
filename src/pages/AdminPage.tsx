import React from 'react';
import SeedDoctorsButton from '../components/SeedDoctorsButton';
import { useAuth } from '../contexts/AuthContext';
import { useNavigate } from 'react-router-dom';

const AdminPage: React.FC = () => {
  const { user } = useAuth();
  const navigate = useNavigate();

  // Simple protection - in production, add proper role-based access
  if (!user) {
    return (
      <div className="min-h-screen bg-gradient-to-br from-gray-900 via-gray-800 to-gray-900 flex items-center justify-center">
        <div className="text-center">
          <h2 className="text-2xl font-bold text-white mb-4">Access Denied</h2>
          <p className="text-gray-400">Please log in to access this page.</p>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gradient-to-br from-gray-900 via-gray-800 to-gray-900 text-white p-8">
      <div className="max-w-4xl mx-auto">
        <div className="mb-8">
          <h1 className="text-4xl font-bold mb-4 bg-gradient-to-r from-cyan-400 to-blue-500 bg-clip-text text-transparent">
            Admin Utilities
          </h1>
          <p className="text-gray-400">
            Use these utilities to manage the database. This page should be removed or protected in production.
          </p>
        </div>

        <div className="space-y-6">
          <SeedDoctorsButton />
          
          <div className="p-4 bg-gray-800 rounded-lg">
            <h3 className="text-lg font-semibold text-white mb-2">Instructions</h3>
            <ol className="list-decimal list-inside space-y-2 text-gray-300 text-sm">
              <li>Click the "Seed Doctors" button above to create doctor profiles in the database</li>
              <li>This will create 8 Pakistani brain specialist doctors</li>
              <li>After seeding, doctors will appear in the Chat and Appointment Booking modules</li>
              <li>You only need to run this once</li>
            </ol>
          </div>

          <div className="p-4 bg-yellow-900/30 border border-yellow-500/30 rounded-lg">
            <h3 className="text-lg font-semibold text-yellow-400 mb-2">⚠️ Important</h3>
            <p className="text-yellow-200 text-sm">
              This admin page should be removed or properly secured before deploying to production.
              Consider adding role-based access control (e.g., only allow admin users).
            </p>
          </div>
        </div>
      </div>
    </div>
  );
};

export default AdminPage;


















