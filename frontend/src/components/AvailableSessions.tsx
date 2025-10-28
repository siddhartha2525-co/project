import React, { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { useAuth } from '../contexts/AuthContext';
import { 
  Video, 
  Users, 
  Calendar, 
  Clock, 
  User,
  LogIn,
  RefreshCw
} from 'lucide-react';
import toast from 'react-hot-toast';

interface Session {
  id: string;
  title: string;
  description: string;
  maxStudents: number;
  startTime: string;
  endTime: string;
  status: string;
  createdAt: string;
  teacherName: string;
  participantCount: number;
  canJoin: boolean;
}

const AvailableSessions: React.FC = () => {
  const { user } = useAuth();
  const navigate = useNavigate();
  const [sessions, setSessions] = useState<Session[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [isJoining, setIsJoining] = useState<string | null>(null);

  const fetchSessions = async () => {
    try {
      setIsLoading(true);
      console.log('Fetching sessions from:', 'http://localhost:5002/api/sessions/available');
      
      const token = localStorage.getItem('token');
      console.log('Token available:', !!token);
      
      const response = await fetch('http://localhost:5002/api/sessions/available', {
        headers: {
          'Authorization': `Bearer ${token}`
        }
      });

      console.log('Response status:', response.status);
      console.log('Response ok:', response.ok);

      if (response.ok) {
        const data = await response.json();
        console.log('Sessions data:', data);
        setSessions(data.sessions);
      } else {
        const errorData = await response.json();
        console.error('Failed to fetch sessions:', errorData);
        toast.error(errorData.error || 'Failed to load sessions');
      }
    } catch (error) {
      console.error('Error fetching sessions:', error);
      toast.error('Failed to load sessions');
    } finally {
      setIsLoading(false);
    }
  };

  useEffect(() => {
    fetchSessions();
  }, []);

  const handleJoinSession = async (sessionId: string) => {
    try {
      setIsJoining(sessionId);
      const response = await fetch(`http://localhost:5002/api/sessions/${sessionId}/join`, {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${localStorage.getItem('token')}`
        }
      });

      if (response.ok) {
        const data = await response.json();
        toast.success('Successfully joined session!');
        // Navigate to the student session
        navigate(`/student/${sessionId}`);
      } else {
        const errorData = await response.json();
        toast.error(errorData.error || 'Failed to join session');
      }
    } catch (error) {
      console.error('Error joining session:', error);
      toast.error('Failed to join session');
    } finally {
      setIsJoining(null);
    }
  };

  const formatDateTime = (dateString: string) => {
    const date = new Date(dateString);
    return date.toLocaleString('en-US', {
      month: 'short',
      day: 'numeric',
      hour: '2-digit',
      minute: '2-digit'
    });
  };

  const getStatusColor = (status: string) => {
    switch (status) {
      case 'active': return 'text-green-600 bg-green-100';
      case 'pending': return 'text-yellow-600 bg-yellow-100';
      case 'ended': return 'text-red-600 bg-red-100';
      default: return 'text-gray-600 bg-gray-100';
    }
  };

  if (user?.role !== 'student') {
    return (
      <div className="min-h-screen bg-gray-50 flex items-center justify-center">
        <div className="text-center">
          <h1 className="text-2xl font-bold text-gray-900 mb-4">Access Denied</h1>
          <p className="text-gray-600 mb-6">Only students can view available sessions.</p>
          <button
            onClick={() => navigate('/dashboard')}
            className="px-4 py-2 bg-indigo-600 text-white rounded-lg hover:bg-indigo-700"
          >
            Back to Dashboard
          </button>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gray-50 p-6">
      <div className="max-w-6xl mx-auto">
        {/* Header */}
        <div className="bg-white rounded-lg shadow-sm p-6 mb-6">
          <div className="flex items-center justify-between">
            <div>
              <h1 className="text-2xl font-bold text-gray-900">Available Sessions</h1>
              <p className="text-gray-600">Join a video session to start learning</p>
            </div>
            <div className="flex items-center space-x-4">
              <button
                onClick={fetchSessions}
                disabled={isLoading}
                className="px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 disabled:opacity-50 flex items-center space-x-2"
              >
                <RefreshCw className={`w-4 h-4 ${isLoading ? 'animate-spin' : ''}`} />
                <span>Refresh</span>
              </button>
              <div className="text-right">
                <p className="text-sm font-medium text-gray-900">{user?.name}</p>
                <p className="text-xs text-gray-500 capitalize">{user?.role}</p>
              </div>
            </div>
          </div>
        </div>

        {/* Sessions Grid */}
        {isLoading ? (
          <div className="flex justify-center items-center h-64">
            <div className="text-center">
              <RefreshCw className="w-8 h-8 animate-spin mx-auto mb-4 text-blue-600" />
              <p className="text-gray-600">Loading sessions...</p>
            </div>
          </div>
        ) : sessions.length === 0 ? (
          <div className="bg-white rounded-lg shadow-sm p-12 text-center">
            <Video className="w-16 h-16 mx-auto mb-4 text-gray-400" />
            <h3 className="text-lg font-medium text-gray-900 mb-2">No sessions available</h3>
            <p className="text-gray-600 mb-4">There are currently no active video sessions you can join.</p>
            <button
              onClick={fetchSessions}
              className="px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700"
            >
              Refresh
            </button>
          </div>
        ) : (
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
            {sessions.map((session) => (
              <div key={session.id} className="bg-white rounded-lg shadow-sm overflow-hidden">
                <div className="p-6">
                  <div className="flex items-start justify-between mb-4">
                    <h3 className="text-lg font-semibold text-gray-900 line-clamp-2">
                      {session.title}
                    </h3>
                    <span className={`px-2 py-1 rounded-full text-xs font-medium ${getStatusColor(session.status)}`}>
                      {session.status}
                    </span>
                  </div>
                  
                  {session.description && (
                    <p className="text-gray-600 text-sm mb-4 line-clamp-2">
                      {session.description}
                    </p>
                  )}

                  <div className="space-y-3 mb-6">
                    <div className="flex items-center text-sm text-gray-600">
                      <User className="w-4 h-4 mr-2" />
                      <span>{session.teacherName}</span>
                    </div>
                    
                    <div className="flex items-center text-sm text-gray-600">
                      <Calendar className="w-4 h-4 mr-2" />
                      <span>{formatDateTime(session.startTime)}</span>
                    </div>
                    
                    <div className="flex items-center text-sm text-gray-600">
                      <Clock className="w-4 h-4 mr-2" />
                      <span>{formatDateTime(session.endTime)}</span>
                    </div>
                    
                    <div className="flex items-center text-sm text-gray-600">
                      <Users className="w-4 h-4 mr-2" />
                      <span>{session.participantCount} / {session.maxStudents} students</span>
                    </div>
                  </div>

                  <button
                    onClick={() => handleJoinSession(session.id)}
                    disabled={!session.canJoin || isJoining === session.id}
                    className={`w-full px-4 py-2 rounded-lg font-medium transition-colors flex items-center justify-center space-x-2 ${
                      session.canJoin
                        ? 'bg-green-600 text-white hover:bg-green-700 disabled:opacity-50'
                        : 'bg-gray-400 text-gray-600 cursor-not-allowed'
                    }`}
                  >
                    {isJoining === session.id ? (
                      <>
                        <RefreshCw className="w-4 h-4 animate-spin" />
                        <span>Joining...</span>
                      </>
                    ) : session.canJoin ? (
                      <>
                        <LogIn className="w-4 h-4" />
                        <span>Join Session</span>
                      </>
                    ) : (
                      <>
                        <Users className="w-4 h-4" />
                        <span>Session Full</span>
                      </>
                    )}
                  </button>
                </div>
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  );
};

export default AvailableSessions;
