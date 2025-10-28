import React, { useState, useRef, useEffect, useCallback } from 'react';
import { useParams } from 'react-router-dom';
import { useAuth } from '../contexts/AuthContext';
import { Camera, Video, VideoOff, AlertCircle, TrendingUp, Users } from 'lucide-react';

interface EmotionData {
  emotion: string;
  confidence: number;
  timestamp: string;
}

interface EngagementMetrics {
  currentEmotion: string;
  confidence: number;
  engagementScore: number;
  sessionDuration: number;
}

const StudentSession: React.FC = () => {
  const { sessionId } = useParams<{ sessionId: string }>();
  const { user } = useAuth();
  const videoRef = useRef<HTMLVideoElement>(null);
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const streamRef = useRef<MediaStream | null>(null);
  
  const [isCameraOn, setIsCameraOn] = useState(false);
  const [isProcessing, setIsProcessing] = useState(false);
  const [connectionStatus, setConnectionStatus] = useState<'disconnected' | 'connecting' | 'connected'>('disconnected');
  const [engagementMetrics, setEngagementMetrics] = useState<EngagementMetrics>({
    currentEmotion: 'neutral',
    confidence: 0,
    engagementScore: 0,
    sessionDuration: 0
  });
  const [alerts, setAlerts] = useState<string[]>([]);
  const [sessionStartTime] = useState(Date.now());

  // Start webcam with simplified approach
  const startCamera = useCallback(async () => {
    try {
      setConnectionStatus('connecting');
      setAlerts(prev => [...prev.slice(-2), 'Starting camera...']);
      
      // Check if getUserMedia is supported
      if (!navigator.mediaDevices || !navigator.mediaDevices.getUserMedia) {
        throw new Error('Camera API not supported in this browser');
      }

      // Use simple constraints that work on most devices
      const stream = await navigator.mediaDevices.getUserMedia({
        video: {
          width: { ideal: 640, min: 320 },
          height: { ideal: 480, min: 240 },
          facingMode: 'user'
        },
        audio: false
      });

      console.log('Camera stream obtained:', stream);
      
      if (videoRef.current) {
        console.log('Video element found, setting srcObject...');
        // Set the stream as the video source
        videoRef.current.srcObject = stream;
        
        // Wait for the video to be ready
        videoRef.current.onloadedmetadata = () => {
          console.log('Video metadata loaded');
          if (videoRef.current) {
            console.log('Video dimensions:', videoRef.current.videoWidth, 'x', videoRef.current.videoHeight);
            videoRef.current.play().then(() => {
              console.log('Video playback started successfully');
              setConnectionStatus('connected');
              setAlerts(prev => [...prev.slice(-2), 'Camera started successfully!']);
            }).catch((playError) => {
              console.error('Error playing video:', playError);
              setAlerts(prev => [...prev.slice(-2), 'Error starting video playback']);
            });
          }
        };

        videoRef.current.oncanplay = () => {
          console.log('Video can start playing');
        };

        videoRef.current.onerror = (e) => {
          console.error('Video error event:', e);
          setAlerts(prev => [...prev.slice(-2), 'Video error occurred']);
        };

        streamRef.current = stream;
        setIsCameraOn(true);
      } else {
        console.error('Video element not found in startCamera');
        console.log('videoRef:', videoRef);
        console.log('videoRef.current:', videoRef.current);
        throw new Error('Video element not found - ref is null or undefined');
      }
    } catch (error: any) {
      console.error('Error accessing camera:', error);
      setConnectionStatus('disconnected');
      
      let errorMessage = 'Camera access denied. Please enable camera permissions.';
      if (error.name === 'NotAllowedError') {
        errorMessage = 'Camera permission denied. Please allow camera access in your browser settings.';
      } else if (error.name === 'NotFoundError') {
        errorMessage = 'No camera found. Please connect a camera and try again.';
      } else if (error.name === 'NotSupportedError') {
        errorMessage = 'Camera not supported in this browser. Please use a modern browser.';
      } else if (error.name === 'NotReadableError') {
        errorMessage = 'Camera is in use by another application. Please close other apps using the camera.';
      }
      
      setAlerts(prev => [...prev.slice(-2), errorMessage]);
    }
  }, []);

  // Stop webcam
  const stopCamera = useCallback(() => {
    if (streamRef.current) {
      streamRef.current.getTracks().forEach(track => track.stop());
      streamRef.current = null;
    }
    if (videoRef.current) {
      videoRef.current.srcObject = null;
    }
    setIsCameraOn(false);
    setConnectionStatus('disconnected');
  }, []);

  // Capture frame and send for processing
  const captureAndProcessFrame = useCallback(async () => {
    if (!videoRef.current || !canvasRef.current || !isCameraOn || isProcessing) return;

    try {
      setIsProcessing(true);
      
      // Capture frame from video
      const canvas = canvasRef.current;
      const context = canvas.getContext('2d');
      if (!context) return;

      // Get video dimensions
      const videoWidth = videoRef.current.videoWidth;
      const videoHeight = videoRef.current.videoHeight;
      
      // Set canvas dimensions to match video
      canvas.width = videoWidth;
      canvas.height = videoHeight;
      
      // Clear canvas and draw video frame
      context.clearRect(0, 0, canvas.width, canvas.height);
      context.drawImage(videoRef.current, 0, 0, videoWidth, videoHeight);

      // Convert to blob and send to backend
      canvas.toBlob(async (blob) => {
        if (!blob) {
          setIsProcessing(false);
          return;
        }

        const formData = new FormData();
        formData.append('frame', blob);
        formData.append('studentId', user?.id?.toString() || '');
        formData.append('sessionId', sessionId || '');

        try {
          const response = await fetch('http://localhost:5002/api/metrics/process-frame', {
            method: 'POST',
            body: formData,
          });

          if (response.ok) {
            const data = await response.json();
            updateEngagementMetrics(data);
          } else {
            console.error('Frame processing failed:', response.status);
          }
        } catch (error) {
          console.error('Error processing frame:', error);
        } finally {
          setIsProcessing(false);
        }
      }, 'image/jpeg', 0.8);

    } catch (error) {
      console.error('Error capturing frame:', error);
      setIsProcessing(false);
    }
  }, [isCameraOn, isProcessing, user?.id, sessionId]);

  // Update engagement metrics
  const updateEngagementMetrics = (data: any) => {
    setEngagementMetrics(prev => ({
      ...prev,
      currentEmotion: data.emotion || 'neutral',
      confidence: data.confidence || 0,
      engagementScore: data.engagementScore || prev.engagementScore,
      sessionDuration: Math.floor((Date.now() - sessionStartTime) / 1000)
    }));

    // Generate alerts based on emotion
    if (data.emotion === 'confused' && data.confidence > 0.7) {
      setAlerts(prev => [...prev.slice(-2), 'You seem confused. Consider asking a question!']);
    } else if (data.emotion === 'bored' && data.confidence > 0.7) {
      setAlerts(prev => [...prev.slice(-2), 'Stay engaged! Try taking notes or asking questions.']);
    }
  };

  // Process frames at regular intervals
  useEffect(() => {
    if (!isCameraOn) return;

    const interval = setInterval(() => {
      captureAndProcessFrame();
    }, 2000); // Process every 2 seconds

    return () => clearInterval(interval);
  }, [isCameraOn, captureAndProcessFrame]);

  // Update session duration
  useEffect(() => {
    const interval = setInterval(() => {
      setEngagementMetrics(prev => ({
        ...prev,
        sessionDuration: Math.floor((Date.now() - sessionStartTime) / 1000)
      }));
    }, 1000);

    return () => clearInterval(interval);
  }, [sessionStartTime]);

  // Check camera permissions on mount
  useEffect(() => {
    const checkCameraPermissions = async () => {
      try {
        if (navigator.permissions && navigator.permissions.query) {
          const permission = await navigator.permissions.query({ name: 'camera' as PermissionName });
          if (permission.state === 'denied') {
            setAlerts(prev => [...prev, 'Camera permission denied. Please enable camera access in browser settings.']);
          }
        }
      } catch (error) {
        console.log('Permission API not supported');
      }
    };
    
    checkCameraPermissions();
    
    // List available media devices for debugging
    if (navigator.mediaDevices && navigator.mediaDevices.enumerateDevices) {
      navigator.mediaDevices.enumerateDevices()
        .then(devices => {
          const videoDevices = devices.filter(device => device.kind === 'videoinput');
          console.log('Available video devices:', videoDevices);
          if (videoDevices.length === 0) {
            setAlerts(prev => [...prev, 'No camera devices found. Please connect a camera.']);
          }
        })
        .catch(console.error);
    }
  }, []);

  // Cleanup on unmount
  useEffect(() => {
    return () => {
      stopCamera();
    };
  }, [stopCamera]);

  const formatTime = (seconds: number) => {
    const mins = Math.floor(seconds / 60);
    const secs = seconds % 60;
    return `${mins}:${secs.toString().padStart(2, '0')}`;
  };

  const getEmotionColor = (emotion: string) => {
    switch (emotion) {
      case 'attentive': return 'text-green-600';
      case 'confused': return 'text-yellow-600';
      case 'bored': return 'text-red-600';
      case 'happy': return 'text-blue-600';
      default: return 'text-gray-600';
    }
  };

  return (
    <div className="min-h-screen bg-gray-50 p-6">
      <div className="max-w-6xl mx-auto">
        {/* Header */}
        <div className="bg-white rounded-lg shadow-sm p-6 mb-6">
          <div className="flex items-center justify-between">
            <div>
              <h1 className="text-2xl font-bold text-gray-900">Online Class Session</h1>
              <p className="text-gray-600">Session ID: {sessionId}</p>
            </div>
            <div className="flex items-center space-x-4">
              <div className="text-right">
                <p className="text-sm font-medium text-gray-900">{user?.name}</p>
                <p className="text-xs text-gray-500 capitalize">{user?.role}</p>
              </div>
              <div className="flex items-center space-x-2">
                <div className={`w-3 h-3 rounded-full ${
                  connectionStatus === 'connected' ? 'bg-green-500' : 
                  connectionStatus === 'connecting' ? 'bg-yellow-500' : 'bg-red-500'
                }`} />
                <span className="text-sm text-gray-600 capitalize">{connectionStatus}</span>
              </div>
            </div>
          </div>
        </div>

        <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
          {/* Main Webcam Feed */}
          <div className="lg:col-span-2">
            <div className="bg-white rounded-lg shadow-sm p-6">
              <div className="flex items-center justify-between mb-4">
                <h2 className="text-lg font-semibold text-gray-900">Your Camera Feed</h2>
                <div className="flex space-x-2">
                  <button
                    onClick={isCameraOn ? stopCamera : startCamera}
                    className={`px-4 py-2 rounded-lg font-medium transition-colors ${
                      isCameraOn
                        ? 'bg-red-600 text-white hover:bg-red-700'
                        : 'bg-green-600 text-white hover:bg-green-700'
                    }`}
                  >
                    {isCameraOn ? (
                      <>
                        <VideoOff className="w-4 h-4 inline mr-2" />
                        Stop Camera
                      </>
                    ) : (
                      <>
                        <Camera className="w-4 h-4 inline mr-2" />
                        Start Camera
                      </>
                    )}
                  </button>
                  
                  {/* Debug button for troubleshooting */}
                  <button
                    onClick={() => {
                      console.log('Video element:', videoRef.current);
                      console.log('Stream:', streamRef.current);
                      console.log('Camera state:', isCameraOn);
                      console.log('Connection status:', connectionStatus);
                      if (videoRef.current) {
                        console.log('Video dimensions:', videoRef.current.videoWidth, 'x', videoRef.current.videoHeight);
                        console.log('Video ready state:', videoRef.current.readyState);
                      }
                    }}
                    className="px-3 py-2 bg-gray-600 text-white rounded-lg hover:bg-gray-700 text-sm"
                    title="Debug camera info"
                  >
                    Debug
                  </button>
                  
                  {/* Test camera button */}
                  <button
                    onClick={async () => {
                      try {
                        const devices = await navigator.mediaDevices.enumerateDevices();
                        const videoDevices = devices.filter(device => device.kind === 'videoinput');
                        console.log('Available video devices:', videoDevices);
                        
                        if (videoDevices.length > 0) {
                          setAlerts(prev => [...prev.slice(-2), `Found ${videoDevices.length} camera(s): ${videoDevices.map(d => d.label || 'Unknown').join(', ')}`]);
                        } else {
                          setAlerts(prev => [...prev.slice(-2), 'No camera devices found!']);
                        }
                      } catch (error) {
                        console.error('Error enumerating devices:', error);
                        setAlerts(prev => [...prev.slice(-2), 'Error checking camera devices']);
                      }
                    }}
                    className="px-3 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 text-sm"
                    title="Test camera devices"
                  >
                    Test Cameras
                  </button>
                  
                  {/* Test video display button */}
                  <button
                    onClick={() => {
                      if (videoRef.current && isCameraOn) {
                        const video = videoRef.current;
                        console.log('Video element state:');
                        console.log('- srcObject:', video.srcObject);
                        console.log('- videoWidth:', video.videoWidth);
                        console.log('- videoHeight:', video.videoHeight);
                        console.log('- readyState:', video.readyState);
                        console.log('- paused:', video.paused);
                        console.log('- ended:', video.ended);
                        console.log('- currentTime:', video.currentTime);
                        console.log('- duration:', video.duration);
                        
                        // Try to force a refresh
                        video.load();
                        setAlerts(prev => [...prev.slice(-2), 'Video element refreshed. Check console for details.']);
                      } else {
                        setAlerts(prev => [...prev.slice(-2), 'Camera must be on to test video display']);
                      }
                    }}
                    className="px-3 py-2 bg-green-600 text-white rounded-lg hover:bg-green-700 text-sm"
                    title="Test video display"
                  >
                    Test Video
                  </button>
                </div>
              </div>

              {/* Video Container */}
              <div className="relative bg-black rounded-lg overflow-hidden">
                {/* Always render video element but hide when camera is off */}
                <video
                  ref={videoRef}
                  autoPlay
                  playsInline
                  muted
                  controls={false}
                  className={`w-full h-96 object-cover ${!isCameraOn ? 'hidden' : ''}`}
                  style={{ transform: 'scaleX(-1)' }} // Mirror effect for selfie view
                  onError={(e) => {
                    console.error('Video error:', e);
                    setAlerts(prev => [...prev.slice(-2), 'Video playback error. Please try again.']);
                  }}
                  onLoadedData={() => {
                    console.log('Video loaded successfully');
                    if (videoRef.current) {
                      console.log('Video dimensions:', videoRef.current.videoWidth, 'x', videoRef.current.videoHeight);
                    }
                  }}
                  onCanPlay={() => {
                    console.log('Video can play');
                    if (videoRef.current) {
                      console.log('Final video dimensions:', videoRef.current.videoWidth, 'x', videoRef.current.videoHeight);
                    }
                  }}
                  onLoadedMetadata={() => {
                    console.log('Video metadata loaded in element');
                  }}
                  onPlay={() => {
                    console.log('Video is playing');
                    setAlerts(prev => [...prev.slice(-2), 'Video is now playing!']);
                  }}
                />
                
                {/* Overlay when camera is off */}
                {!isCameraOn && (
                  <div className="absolute inset-0 flex items-center justify-center">
                    <div className="text-center text-white">
                      <Camera className="w-16 h-16 mx-auto mb-4 text-gray-400" />
                      <p className="text-lg font-medium">Camera is off</p>
                      <p className="text-sm text-gray-400">Click "Start Camera" to begin</p>
                      
                      {/* Camera troubleshooting tips */}
                      <div className="mt-4 p-3 bg-gray-800 rounded-lg max-w-sm mx-auto">
                        <p className="text-xs text-gray-300 mb-2">💡 Troubleshooting:</p>
                        <ul className="text-xs text-gray-400 text-left space-y-1">
                          <li>• Allow camera permissions when prompted</li>
                          <li>• Check if camera is not in use by other apps</li>
                          <li>• Try refreshing the page if camera doesn't start</li>
                          <li>• Use Chrome/Firefox/Safari for best compatibility</li>
                        </ul>
                      </div>
                    </div>
                  </div>
                )}
                
                {isProcessing && (
                  <div className="absolute top-4 right-4 bg-blue-600 text-white px-3 py-1 rounded-full text-sm">
                    Processing...
                  </div>
                )}
                
                {/* Camera status overlay */}
                {isCameraOn && (
                  <div className="absolute bottom-4 left-4 bg-black bg-opacity-70 text-white px-3 py-1 rounded-full text-sm">
                    <div className="flex items-center space-x-2">
                      <div className="w-2 h-2 bg-green-500 rounded-full animate-pulse" />
                      <span>Live</span>
                    </div>
                  </div>
                )}
                
                <canvas ref={canvasRef} className="hidden" />
              </div>

              {/* Processing Status */}
              {isCameraOn && (
                <div className="mt-4 p-4 bg-blue-50 rounded-lg">
                  <div className="flex items-center space-x-2">
                    <div className="w-2 h-2 bg-blue-500 rounded-full animate-pulse" />
                    <span className="text-sm text-blue-700">
                      {isProcessing ? 'Processing frame...' : 'Ready for next frame'}
                    </span>
                  </div>
                </div>
              )}
            </div>
          </div>

          {/* Sidebar - Engagement Metrics */}
          <div className="space-y-6">
            {/* Current Emotion */}
            <div className="bg-white rounded-lg shadow-sm p-6">
              <h3 className="text-lg font-semibold text-gray-900 mb-4">Current Emotion</h3>
              <div className="text-center">
                <div className={`text-4xl font-bold mb-2 ${getEmotionColor(engagementMetrics.currentEmotion)}`}>
                  {engagementMetrics.currentEmotion.charAt(0).toUpperCase() + engagementMetrics.currentEmotion.slice(1)}
                </div>
                <p className="text-sm text-gray-600">
                  Confidence: {(engagementMetrics.confidence * 100).toFixed(1)}%
                </p>
              </div>
            </div>

            {/* Engagement Score */}
            <div className="bg-white rounded-lg shadow-sm p-6">
              <h3 className="text-lg font-semibold text-gray-900 mb-4">Engagement Score</h3>
              <div className="text-center">
                <div className="text-4xl font-bold text-blue-600 mb-2">
                  {engagementMetrics.engagementScore}%
                </div>
                <div className="w-full bg-gray-200 rounded-full h-2">
                  <div 
                    className="bg-blue-600 h-2 rounded-full transition-all duration-300"
                    style={{ width: `${engagementMetrics.engagementScore}%` }}
                  />
                </div>
              </div>
            </div>

            {/* Session Info */}
            <div className="bg-white rounded-lg shadow-sm p-6">
              <h3 className="text-lg font-semibold text-gray-900 mb-4">Session Info</h3>
              <div className="space-y-3">
                <div className="flex items-center justify-between">
                  <span className="text-sm text-gray-600">Duration:</span>
                  <span className="font-medium">{formatTime(engagementMetrics.sessionDuration)}</span>
                </div>
                <div className="flex items-center justify-between">
                  <span className="text-sm text-gray-600">Status:</span>
                  <span className={`px-2 py-1 rounded-full text-xs font-medium ${
                    connectionStatus === 'connected' ? 'bg-green-100 text-green-800' :
                    connectionStatus === 'connecting' ? 'bg-yellow-100 text-yellow-800' :
                    'bg-red-100 text-red-800'
                  }`}>
                    {connectionStatus}
                  </span>
                </div>
              </div>
            </div>

            {/* Alerts */}
            {alerts.length > 0 && (
              <div className="bg-white rounded-lg shadow-sm p-6">
                <h3 className="text-lg font-semibold text-gray-900 mb-4 flex items-center">
                  <AlertCircle className="w-5 h-5 mr-2 text-yellow-500" />
                  Alerts
                </h3>
                <div className="space-y-2">
                  {alerts.map((alert, index) => (
                    <div key={index} className="p-3 bg-yellow-50 border border-yellow-200 rounded-lg">
                      <p className="text-sm text-yellow-800">{alert}</p>
                    </div>
                  ))}
                </div>
              </div>
            )}
          </div>
        </div>
      </div>
    </div>
  );
};

export default StudentSession;
