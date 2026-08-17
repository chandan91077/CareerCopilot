import React from 'react';
import { BrowserRouter as Router, Routes, Route, Navigate, useNavigate } from 'react-router-dom';
import DashboardLayout from './components/layout/DashboardLayout';

import Landing from './pages/Landing';
import Login from './pages/Login';
import Register from './pages/Register';
import ForgotPassword from './pages/ForgotPassword';
import Dashboard from './pages/Dashboard';
import AssistantOverlay from './pages/AssistantOverlay';
import Subscription from './pages/Subscription';
import Settings from './pages/Settings';
import CandidateScreenShare from './pages/CandidateScreenShare';
import ScreenShareViewer from './pages/ScreenShareViewer';
import AdminDashboard from './pages/admin/AdminDashboard';
import AdminUserMgmt from './pages/admin/AdminUserMgmt';
import AdminPrompts from './pages/admin/AdminPrompts';

// Private Route Guard
interface PrivateRouteProps {
  children: React.ReactNode;
}

const PrivateRoute = ({ children }: PrivateRouteProps) => {
  const token = localStorage.getItem('token');
  return token ? <>{children}</> : <Navigate to="/login" replace />;
};

// Admin Route Guard
const AdminRoute = ({ children }: PrivateRouteProps) => {
  const token = localStorage.getItem('token');
  const userStr = localStorage.getItem('user');
  const user = userStr ? JSON.parse(userStr) : null;

  if (!token) return <Navigate to="/login" replace />;
  if (!user || user.role !== 'admin') return <Navigate to="/dashboard" replace />;
  return <>{children}</>;
};

const ElectronHandler = () => {
  const navigate = useNavigate();
  React.useEffect(() => {
    const isElectron = !!(window as any).electronAPI;
    if (isElectron) {
      document.body.classList.add('electron-body');
      const token = localStorage.getItem('token');
      if (token) {
        navigate('/assistant');
      } else {
        navigate('/login');
      }
    }
  }, [navigate]);

  return null;
};

export default function App() {
  return (
    <Router>
      <ElectronHandler />
      <Routes>
        {/* Public Landing Page */}
        <Route path="/" element={<Landing />} />

        {/* Public Auth Routes */}
        <Route path="/login" element={<Login />} />
        <Route path="/register" element={<Register />} />
        <Route path="/forgot-password" element={<ForgotPassword />} />

        {/* Private Dashboard Module Routes */}
        <Route
          path="/dashboard"
          element={
            <PrivateRoute>
              <DashboardLayout>
                <Dashboard />
              </DashboardLayout>
            </PrivateRoute>
          }
        />
        <Route
          path="/assistant"
          element={
            <PrivateRoute>
              <AssistantOverlay />
            </PrivateRoute>
          }
        />
        <Route
          path="/subscription"
          element={
            <PrivateRoute>
              <DashboardLayout>
                <Subscription />
              </DashboardLayout>
            </PrivateRoute>
          }
        />
        <Route
          path="/screen-share"
          element={
            <PrivateRoute>
              <DashboardLayout>
                <CandidateScreenShare />
              </DashboardLayout>
            </PrivateRoute>
          }
        />
        <Route
          path="/screen-share/view"
          element={
            <PrivateRoute>
              <DashboardLayout>
                <ScreenShareViewer />
              </DashboardLayout>
            </PrivateRoute>
          }
        />

        {/* Admin Module Routes */}
        <Route
          path="/admin"
          element={
            <AdminRoute>
              <DashboardLayout>
                <AdminDashboard />
              </DashboardLayout>
            </AdminRoute>
          }
        />
        <Route
          path="/admin/users"
          element={
            <AdminRoute>
              <DashboardLayout>
                <AdminUserMgmt />
              </DashboardLayout>
            </AdminRoute>
          }
        />
        <Route
          path="/admin/prompts"
          element={
            <AdminRoute>
              <DashboardLayout>
                <AdminPrompts />
              </DashboardLayout>
            </AdminRoute>
          }
        />

        {/* Catch-all Redirect */}
        <Route path="*" element={<Navigate to="/dashboard" replace />} />
      </Routes>
    </Router>
  );
}
