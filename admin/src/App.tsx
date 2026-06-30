import React from 'react';
import { BrowserRouter as Router, Routes, Route, Navigate } from 'react-router-dom';
import AdminLayout from './components/layout/AdminLayout';

import AdminDashboard from './pages/AdminDashboard';
import AdminUserMgmt from './pages/AdminUserMgmt';
import AdminPrompts from './pages/AdminPrompts';

export default function App() {
  return (
    <Router>
      <Routes>
        <Route
          path="/"
          element={
            <AdminLayout>
              <AdminDashboard />
            </AdminLayout>
          }
        />
        <Route
          path="/users"
          element={
            <AdminLayout>
              <AdminUserMgmt />
            </AdminLayout>
          }
        />
        <Route
          path="/prompts"
          element={
            <AdminLayout>
              <AdminPrompts />
            </AdminLayout>
          }
        />
        {/* Fallback */}
        <Route path="*" element={<Navigate to="/" replace />} />
      </Routes>
    </Router>
  );
}
