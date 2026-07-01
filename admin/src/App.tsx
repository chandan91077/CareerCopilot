import React, { useEffect } from 'react';
import { BrowserRouter as Router, Routes, Route, Navigate } from 'react-router-dom';
import AdminLayout from './components/layout/AdminLayout';

import AdminDashboard from './pages/AdminDashboard';
import AdminUserMgmt from './pages/AdminUserMgmt';
import AdminPrompts from './pages/AdminPrompts';

const AuthHandler = ({ children }: { children: React.ReactNode }) => {
  useEffect(() => {
    const params = new URLSearchParams(window.location.search);
    const token = params.get('token');
    const userStr = params.get('user');
    
    if (token && userStr) {
      localStorage.setItem('token', token);
      localStorage.setItem('user', userStr);
      // Remove query parameters from the URL so token isn't visible or shared
      window.history.replaceState({}, document.title, window.location.pathname);
    }
  }, []);

  return <>{children}</>;
};

export default function App() {
  return (
    <Router>
      <AuthHandler>
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
      </AuthHandler>
    </Router>
  );
}
