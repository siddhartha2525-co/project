import React, { useEffect, useRef, useState } from "react";
import { Camera, Video, VideoOff, AlertCircle } from 'lucide-react';

const WebcamTest: React.FC = () => {
  const videoRef = useRef<HTMLVideoElement>(null);
  const [isCameraOn, setIsCameraOn] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [stream, setStream] = useState<MediaStream | null>(null);

  const startCamera = async () => {
    try {
      setError(null);
      console.log("Starting camera...");
      
      // Check if getUserMedia is supported
      if (!navigator.mediaDevices || !navigator.mediaDevices.getUserMedia) {
        throw new Error("Camera API not supported in this browser");
      }

      // First, try to enumerate devices to see what's available
      const devices = await navigator.mediaDevices.enumerateDevices();
      const videoDevices = devices.filter(device => device.kind === 'videoinput');
      console.log("Available video devices:", videoDevices);

      if (videoDevices.length === 0) {
        throw new Error("No camera devices found");
      }

      // Get camera stream with minimal constraints
      const mediaStream = await navigator.mediaDevices.getUserMedia({
        video: {
          width: { ideal: 640, min: 320 },
          height: { ideal: 480, min: 240 },
          facingMode: 'user'
        },
        audio: false
      });

      console.log("Camera stream obtained:", mediaStream);
      console.log("Stream tracks:", mediaStream.getTracks());
      
      if (videoRef.current) {
        console.log("Video element found, setting srcObject...");
        videoRef.current.srcObject = mediaStream;
        
        // Add multiple event listeners for better debugging
        videoRef.current.onloadedmetadata = () => {
          console.log("Video metadata loaded");
          console.log("Video dimensions:", videoRef.current?.videoWidth, "x", videoRef.current?.videoHeight);
        };
        
        videoRef.current.oncanplay = () => {
          console.log("Video can start playing");
        };
        
        videoRef.current.onplay = () => {
          console.log("Video play event fired");
          setIsCameraOn(true);
          setStream(mediaStream);
        };
        
        videoRef.current.onerror = (e) => {
          console.error("Video error event:", e);
          setError("Video error occurred");
        };

        // Wait a bit for the video element to be ready
        await new Promise(resolve => setTimeout(resolve, 100));

        // Try to play the video
        try {
          await videoRef.current.play();
          console.log("Video playback started successfully");
        } catch (playError: any) {
          console.error("Error playing video:", playError);
          setError("Error starting video playback: " + (playError.message || 'Unknown error'));
        }
      } else {
        console.error("Video element not found in startCamera");
        console.log("videoRef:", videoRef);
        console.log("videoRef.current:", videoRef.current);
        throw new Error("Video element not found - ref is null or undefined");
      }
    } catch (err: any) {
      console.error("Camera access error:", err);
      let errorMessage = "Unable to access camera";
      
      if (err.name === 'NotAllowedError') {
        errorMessage = "Camera permission denied. Please allow camera access.";
      } else if (err.name === 'NotFoundError') {
        errorMessage = "No camera found. Please connect a camera.";
      } else if (err.name === 'NotReadableError') {
        errorMessage = "Camera is in use by another application.";
      } else if (err.name === 'NotSupportedError') {
        errorMessage = "Camera not supported in this browser.";
      } else if (err.message) {
        errorMessage = err.message;
      }
      
      setError(errorMessage);
    }
  };

  const stopCamera = () => {
    if (stream) {
      stream.getTracks().forEach(track => track.stop());
      setStream(null);
    }
    if (videoRef.current) {
      videoRef.current.srcObject = null;
    }
    setIsCameraOn(false);
    setError(null);
  };

  const testCameraInConsole = () => {
    console.log("Testing camera access in console...");
    navigator.mediaDevices.getUserMedia({ video: true })
      .then(stream => {
        console.log("✅ Camera works in console:", stream);
        stream.getTracks().forEach(track => track.stop());
      })
      .catch(err => {
        console.error("❌ Camera failed in console:", err);
      });
  };

  useEffect(() => {
    // Check available devices on mount
    if (navigator.mediaDevices && navigator.mediaDevices.enumerateDevices) {
      navigator.mediaDevices.enumerateDevices()
        .then(devices => {
          const videoDevices = devices.filter(device => device.kind === 'videoinput');
          console.log("Available video devices:", videoDevices);
        })
        .catch(console.error);
    }

    return () => {
      stopCamera();
    };
  }, []);

  return (
    <div className="min-h-screen bg-gray-50 p-6">
      <div className="max-w-4xl mx-auto">
        <div className="bg-white rounded-lg shadow-lg p-8">
          <h1 className="text-3xl font-bold text-center text-gray-900 mb-8">
            🎥 Webcam Test Component
          </h1>
          
          <div className="text-center mb-6">
            <p className="text-gray-600 mb-4">
              This component tests basic camera access. If this works, we can integrate it into your main system.
            </p>
            
            <div className="flex justify-center space-x-4">
              <button
                onClick={isCameraOn ? stopCamera : startCamera}
                className={`px-6 py-3 rounded-lg font-medium transition-colors ${
                  isCameraOn
                    ? 'bg-red-600 text-white hover:bg-red-700'
                    : 'bg-green-600 text-white hover:bg-green-700'
                }`}
              >
                {isCameraOn ? (
                  <>
                    <VideoOff className="w-5 h-5 inline mr-2" />
                    Stop Camera
                  </>
                ) : (
                  <>
                    <Camera className="w-5 h-5 inline mr-2" />
                    Start Camera
                  </>
                )}
              </button>
              
                                    <button
                        onClick={testCameraInConsole}
                        className="px-6 py-3 bg-blue-600 text-white rounded-lg hover:bg-blue-700 font-medium"
                      >
                        Test in Console
                      </button>

                      <button
                        onClick={async () => {
                          try {
                            console.log("Testing basic camera access...");
                            const stream = await navigator.mediaDevices.getUserMedia({ video: true });
                            console.log("✅ Basic camera test successful:", stream);
                            alert("Basic camera test successful! Check console for details.");
                            stream.getTracks().forEach(track => track.stop());
                          } catch (err: any) {
                            console.error("❌ Basic camera test failed:", err);
                            alert("Basic camera test failed: " + (err.message || 'Unknown error'));
                          }
                        }}
                        className="px-6 py-3 bg-purple-600 text-white rounded-lg hover:bg-purple-700 font-medium"
                      >
                        Basic Camera Test
                      </button>

                      <button
                        onClick={() => {
                          console.log("=== Video Element Debug ===");
                          console.log("videoRef.current:", videoRef.current);
                          console.log("videoRef.current?.tagName:", videoRef.current?.tagName);
                          console.log("videoRef.current?.srcObject:", videoRef.current?.srcObject);
                          console.log("isCameraOn:", isCameraOn);
                          console.log("error:", error);
                          alert(`Video Ref: ${videoRef.current ? 'Found' : 'Not Found'}\nTag: ${videoRef.current?.tagName || 'N/A'}\nCamera On: ${isCameraOn}`);
                        }}
                        className="px-6 py-3 bg-orange-600 text-white rounded-lg hover:bg-orange-700 font-medium"
                      >
                        Debug Video Ref
                      </button>
            </div>
          </div>

          {/* Camera Feed */}
          <div className="flex justify-center mb-6">
            <div className="relative bg-black rounded-lg overflow-hidden">
              {/* Always render video element but hide when camera is off */}
              <video
                ref={videoRef}
                autoPlay
                playsInline
                muted
                className={`h-96 w-96 object-cover ${!isCameraOn ? 'hidden' : ''}`}
                style={{ transform: 'scaleX(-1)' }} // Mirror effect
              />
              
              {/* Overlay when camera is off */}
              {!isCameraOn && (
                <div className="absolute inset-0 flex items-center justify-center">
                  <div className="text-center text-white">
                    <Camera className="w-16 h-16 mx-auto mb-4 text-gray-400" />
                    <p className="text-lg font-medium">Camera is off</p>
                    <p className="text-sm text-gray-400">Click "Start Camera" to begin</p>
                  </div>
                </div>
              )}
            </div>
          </div>

          {/* Status & Error Display */}
          <div className="space-y-4">
            {error && (
              <div className="bg-red-50 border border-red-200 rounded-lg p-4">
                <div className="flex items-center">
                  <AlertCircle className="w-5 h-5 text-red-500 mr-2" />
                  <span className="text-red-800 font-medium">{error}</span>
                </div>
              </div>
            )}
            
            {isCameraOn && (
              <div className="bg-green-50 border border-green-200 rounded-lg p-4">
                <div className="flex items-center">
                  <Video className="w-5 h-5 text-green-500 mr-2" />
                  <span className="text-green-800 font-medium">
                    Camera is working! ✅
                  </span>
                </div>
              </div>
            )}
          </div>

          {/* Debug Information */}
                            <div className="mt-8 p-4 bg-gray-100 rounded-lg">
                    <h3 className="font-semibold text-gray-900 mb-2">Debug Information:</h3>
                    <div className="text-sm text-gray-600 space-y-1">
                      <p>• Camera Status: {isCameraOn ? 'ON' : 'OFF'}</p>
                      <p>• Browser: {navigator.userAgent.split(' ').pop()}</p>
                      <p>• getUserMedia Support: {navigator.mediaDevices && typeof navigator.mediaDevices.getUserMedia === 'function' ? 'Yes' : 'No'}</p>
                      <p>• Protocol: {window.location.protocol}</p>
                      <p>• Host: {window.location.host}</p>
                      <p>• User Agent: {navigator.userAgent}</p>
                      <p>• Platform: {navigator.platform}</p>
                      <p>• Cookie Enabled: {navigator.cookieEnabled ? 'Yes' : 'No'}</p>
                      <p>• Do Not Track: {navigator.doNotTrack || 'Not set'}</p>
                    </div>
                  </div>
        </div>
      </div>
    </div>
  );
};

export default WebcamTest;
