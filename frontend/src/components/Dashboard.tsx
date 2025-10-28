import React, { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { useAuth } from '../contexts/AuthContext';
import { 
  LogOut, 
  Plus, 
  Video, 
  BarChart3,
  Camera
} from 'lucide-react';

const Dashboard: React.FC = () => {
  const { user, logout } = useAuth();
  const navigate = useNavigate();
  const [sessions] = useState([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    // Fetch user's sessions
    fetchSessions();
  }, []);

  const fetchSessions = async () => {
    try {
      // TODO: Implement API call to fetch sessions
      setLoading(false);
    } catch (error) {
      console.error('Failed to fetch sessions:', error);
      setLoading(false);
    }
  };

  const handleLogout = () => {
    logout();
    navigate('/login');
  };

  const createSession = () => {
    if (user?.role === 'teacher') {
      navigate('/session/create');
    }
  };

  const joinSession = () => {
    if (user?.role === 'student') {
      navigate('/sessions');
    } else {
      navigate('/teacher-dashboard');
    }
  };

  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <div className="animate-spin rounded-full h-32 w-32 border-b-2 border-indigo-600"></div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gray-50">
      {/* Header */}
      <header className="bg-white shadow-sm border-b">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="flex justify-between items-center py-4">
            <div className="flex items-center space-x-4">
              <h1 className="text-2xl font-bold text-gray-900">
                Emotion Engagement System
              </h1>
            </div>
            <div className="flex items-center space-x-4">
              <div className="text-right">
                <p className="text-sm font-medium text-gray-900">{user?.name}</p>
                <p className="text-xs text-gray-500 capitalize">{user?.role}</p>
              </div>
              <button
                onClick={handleLogout}
                className="inline-flex items-center px-3 py-2 border border-transparent text-sm leading-4 font-medium rounded-md text-gray-500 bg-white hover:text-gray-700 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-indigo-500"
              >
                <LogOut className="h-4 w-4 mr-2" />
                Logout
              </button>
            </div>
          </div>
        </div>
      </header>

      {/* Main Content */}
      <main className="max-w-7xl mx-auto py-6 sm:px-6 lg:px-8">
        {/* Welcome Section */}
        <div className="px-4 py-6 sm:px-0">
          <div className="bg-white overflow-hidden shadow rounded-lg">
            <div className="px-4 py-5 sm:p-6">
              <h2 className="text-lg font-medium text-gray-900 mb-4">
                Welcome back, {user?.name}! 👋
              </h2>
              <p className="text-gray-600">
                {user?.role === 'teacher' 
                  ? 'Create and manage your online classes with real-time emotion detection.'
                  : 'Join your classes and track your engagement levels.'
                }
              </p>
              
              {/* Webcam Test Button */}
              <div className="mt-4">
                <button
                  onClick={() => navigate('/webcam-test')}
                  className="inline-flex items-center px-4 py-2 border border-transparent text-sm font-medium rounded-md text-white bg-blue-600 hover:bg-blue-700 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-blue-500"
                >
                  <Camera className="h-4 w-4 mr-2" />
                  Test Webcam
                </button>
              </div>
            </div>
          </div>
        </div>

        {/* Quick Actions */}
        <div className="px-4 py-6 sm:px-0">
          <div className="grid grid-cols-1 gap-5 sm:grid-cols-2 lg:grid-cols-3">
            {user?.role === 'teacher' && (
              <button
                onClick={createSession}
                className="relative group bg-white p-6 focus-within:ring-2 focus-within:ring-inset focus-within:ring-indigo-500 rounded-lg shadow hover:shadow-md transition-shadow"
              >
                <div>
                  <span className="rounded-lg inline-flex p-3 bg-indigo-50 text-indigo-700 ring-4 ring-white">
                    <Plus className="h-6 w-6" />
                  </span>
                </div>
                <div className="mt-8">
                  <h3 className="text-lg font-medium">
                    <span className="absolute inset-0" aria-hidden="true" />
                    Create New Session
                  </h3>
                  <p className="mt-2 text-sm text-gray-500">
                    Start a new online class with emotion detection
                  </p>
                </div>
              </button>
            )}

            <button
              onClick={joinSession}
              className="relative group bg-white p-6 focus-within:ring-2 focus-within:ring-inset focus-within:ring-indigo-500 rounded-lg shadow hover:shadow-md transition-shadow"
            >
              <div>
                <span className="rounded-lg inline-flex p-3 bg-green-50 text-green-700 ring-4 ring-white">
                  <Video className="h-6 w-6" />
                </span>
              </div>
              <div className="mt-8">
                <h3 className="text-lg font-medium">
                  <span className="absolute inset-0" aria-hidden="true" />
                  Join Session
                </h3>
                <p className="mt-2 text-sm text-gray-500">
                  {user?.role === 'teacher' ? 'Join an existing session' : 'Join your class'}
                </p>
              </div>
            </button>

            {user?.role === 'teacher' ? (
              <button
                onClick={() => navigate('/teacher-dashboard')}
                className="relative group bg-white p-6 focus-within:ring-2 focus-within:ring-inset focus-within:ring-indigo-500 rounded-lg shadow hover:shadow-md transition-shadow"
              >
                <div>
                  <span className="rounded-lg inline-flex p-3 bg-purple-50 text-purple-700 ring-4 ring-white">
                    <BarChart3 className="h-6 w-6" />
                  </span>
                </div>
                <div className="mt-8">
                  <h3 className="text-lg font-medium">
                    <span className="absolute inset-0" aria-hidden="true" />
                    Teacher Dashboard
                  </h3>
                  <p className="mt-2 text-sm text-gray-500">
                    Monitor student engagement and class analytics
                  </p>
                </div>
              </button>
            ) : (
              <button
                onClick={() => navigate('/student/demo-session')}
                className="relative group bg-white p-6 focus-within:ring-2 focus-within:ring-inset focus-within:ring-indigo-500 rounded-lg shadow hover:shadow-md transition-shadow"
              >
                <div>
                  <span className="rounded-lg inline-flex p-3 bg-purple-50 text-purple-700 ring-4 ring-white">
                    <BarChart3 className="h-6 w-6" />
                  </span>
                </div>
                <div className="mt-8">
                  <h3 className="text-lg font-medium">
                    <span className="absolute inset-0" aria-hidden="true" />
                    Join Session
                  </h3>
                  <p className="mt-2 text-sm text-gray-500">
                    Join an online class with emotion detection
                  </p>
                </div>
              </button>
            )}
          </div>
        </div>

        {/* Recent Sessions */}
        <div className="px-4 py-6 sm:px-0">
          <div className="bg-white shadow rounded-lg">
            <div className="px-4 py-5 sm:p-6">
              <h3 className="text-lg leading-6 font-medium text-gray-900 mb-4">
                Recent Sessions
              </h3>
              {sessions.length === 0 ? (
                <div className="text-center py-12">
                  <Video className="mx-auto h-12 w-12 text-gray-400" />
                  <h3 className="mt-2 text-sm font-medium text-gray-900">No sessions yet</h3>
                  <p className="mt-1 text-sm text-gray-500">
                    {user?.role === 'teacher' 
                      ? 'Get started by creating your first session.'
                      : 'Join a session to get started.'
                    }
                  </p>
                  <div className="mt-6">
                    <button
                      onClick={user?.role === 'teacher' ? createSession : joinSession}
                      className="inline-flex items-center px-4 py-2 border border-transparent shadow-sm text-sm font-medium rounded-md text-white bg-indigo-600 hover:bg-indigo-700 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-indigo-500"
                    >
                      {user?.role === 'teacher' ? 'Create Session' : 'Join Session'}
                    </button>
                  </div>
                </div>
              ) : (
                <div className="space-y-4">
                  {/* Session items would go here */}
                  <p className="text-gray-500 text-sm">Session list will be populated here</p>
                </div>
              )}
            </div>
          </div>
        </div>
      </main>
    </div>
  );
};

export default Dashboard;
