import React from 'react';
import { BrowserRouter as Router, Routes, Route, Navigate } from 'react-router-dom';
import { Provider } from 'react-redux';
import { Toaster } from 'react-hot-toast';
import { store } from './store';
import { AuthProvider, useAuth } from './contexts/AuthContext';
import Login from './components/Login';
import Register from './components/Register';
import Dashboard from './components/Dashboard';
import Profile from './components/Profile';
import StudentSession from './components/StudentSession';
import TeacherDashboard from './components/TeacherDashboard';
import CreateSession from './components/CreateSession';
import WebcamTest from './components/WebcamTest';
import AvailableSessions from './components/AvailableSessions';
import './index.css';

// Protected Route Component
const ProtectedRoute: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const { user, loading } = useAuth();
  
  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <div className="animate-spin rounded-full h-32 w-32 border-b-2 border-indigo-600"></div>
      </div>
    );
  }
  
  return user ? <>{children}</> : <Navigate to="/login" replace />;
};

function App() {
  return (
    <Provider store={store}>
      <AuthProvider>
        <Router>
          <div className="App">
            <Toaster
              position="top-right"
              toastOptions={{
                duration: 4000,
                style: {
                  background: '#363636',
                  color: '#fff',
                },
                success: {
                  duration: 3000,
                  iconTheme: {
                    primary: '#22c55e',
                    secondary: '#fff',
                  },
                },
                error: {
                  duration: 5000,
                  iconTheme: {
                    primary: '#ef4444',
                    secondary: '#fff',
                  },
                },
              }}
            />
            
            <Routes>
              {/* Public Routes */}
              <Route path="/login" element={<Login />} />
              <Route path="/register" element={<Register />} />
              <Route path="/webcam-test" element={<WebcamTest />} />
              
              {/* Protected Routes */}
              <Route path="/dashboard" element={
                <ProtectedRoute>
                  <Dashboard />
                </ProtectedRoute>
              } />
              <Route path="/profile" element={
                <ProtectedRoute>
                  <Profile />
                </ProtectedRoute>
              } />
              
              {/* Available Sessions Route */}
              <Route path="/sessions" element={
                <ProtectedRoute>
                  <AvailableSessions />
                </ProtectedRoute>
              } />
              
              {/* Student Session Route */}
              <Route path="/student/:sessionId" element={
                <ProtectedRoute>
                  <StudentSession />
                </ProtectedRoute>
              } />
              
              {/* Teacher Dashboard Route */}
              <Route path="/teacher-dashboard" element={
                <ProtectedRoute>
                  <TeacherDashboard />
                </ProtectedRoute>
              } />
              
              {/* Create Session Route */}
              <Route path="/session/create" element={
                <ProtectedRoute>
                  <CreateSession />
                </ProtectedRoute>
              } />
              
              {/* Default route */}
              <Route path="/" element={<Navigate to="/dashboard" replace />} />
              
              {/* Catch all route */}
              <Route path="*" element={<Navigate to="/dashboard" replace />} />
            </Routes>
          </div>
        </Router>
      </AuthProvider>
    </Provider>
  );
}

export default App;
