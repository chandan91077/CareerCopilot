import React from 'react';
import { BrowserRouter as Router, Routes, Route, Navigate } from 'react-router-dom';
import DashboardLayout from './components/layout/DashboardLayout';

import Login from './pages/Login';
import Register from './pages/Register';
import ForgotPassword from './pages/ForgotPassword';
import Dashboard from './pages/Dashboard';
import ResumeModule from './pages/ResumeModule';
import MockInterview from './pages/MockInterview';
import CodingPractice from './pages/CodingPractice';
import BehavioralPractice from './pages/BehavioralPractice';
import InterviewHistory from './pages/InterviewHistory';
import Subscription from './pages/Subscription';
import Settings from './pages/Settings';

// Private Route Guard
interface PrivateRouteProps {
  children: React.ReactNode;
}

const PrivateRoute = ({ children }: PrivateRouteProps) => {
  const token = localStorage.getItem('token');
  return token ? <>{children}</> : <Navigate to="/login" replace />;
};

export default function App() {
  return (
    <Router>
      <Routes>
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
          path="/resume"
          element={
            <PrivateRoute>
              <DashboardLayout>
                <ResumeModule />
              </DashboardLayout>
            </PrivateRoute>
          }
        />
        <Route
          path="/interview"
          element={
            <PrivateRoute>
              <DashboardLayout>
                <MockInterview />
              </DashboardLayout>
            </PrivateRoute>
          }
        />
        <Route
          path="/coding"
          element={
            <PrivateRoute>
              <DashboardLayout>
                <CodingPractice />
              </DashboardLayout>
            </PrivateRoute>
          }
        />
        <Route
          path="/behavioral"
          element={
            <PrivateRoute>
              <DashboardLayout>
                <BehavioralPractice />
              </DashboardLayout>
            </PrivateRoute>
          }
        />
        <Route
          path="/history"
          element={
            <PrivateRoute>
              <DashboardLayout>
                <InterviewHistory />
              </DashboardLayout>
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
          path="/settings"
          element={
            <PrivateRoute>
              <DashboardLayout>
                <Settings />
              </DashboardLayout>
            </PrivateRoute>
          }
        />

        {/* Catch-all Redirect */}
        <Route path="*" element={<Navigate to="/dashboard" replace />} />
      </Routes>
    </Router>
  );
}
