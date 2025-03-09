"use client";

import { useState, useEffect, useRef } from "react";
import { useRouter, useSearchParams } from "next/navigation";

export default function VideoPage() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const [user, setUser] = useState<{ email: string } | null>(null);
  const [videoBlob, setVideoBlob] = useState<Blob | null>(null);
  const [location, setLocation] = useState<{ lat: number; lon: number } | null>(null);
  const videoRef = useRef<HTMLVideoElement>(null);
  const mediaRecorderRef = useRef<MediaRecorder | null>(null);
  const streamRef = useRef<MediaStream | null>(null);
  const [recording, setRecording] = useState(false);
  const [isRedirecting, setIsRedirecting] = useState(false);

  useEffect(() => {
    const currentUser = localStorage.getItem("currentUser");
    if (!currentUser) {
      router.push("/login");
    } else {
      setUser(JSON.parse(currentUser));
      startCamera();
      getLocation();
    }

    // Cleanup function to stop all media tracks
    return () => {
      if (streamRef.current) {
        streamRef.current.getTracks().forEach(track => track.stop());
      }
    };
  }, [router]);

  const startCamera = async () => {
    try {
      const stream = await navigator.mediaDevices.getUserMedia({ video: true, audio: true });
      streamRef.current = stream;
      
      if (videoRef.current) {
        videoRef.current.srcObject = stream;
      }
      
      mediaRecorderRef.current = new MediaRecorder(stream);
      let chunks: BlobPart[] = [];

      mediaRecorderRef.current.ondataavailable = (event) => {
        if (event.data.size > 0) {
          chunks.push(event.data);
        }
      };

      mediaRecorderRef.current.onstop = () => {
        const recordedBlob = new Blob(chunks, { type: "video/mp4" });
        setVideoBlob(recordedBlob);
        chunks = [];
      };
    } catch (error) {
      console.error("Error accessing webcam:", error);
    }
  };

  const getLocation = () => {
    if (navigator.geolocation) {
      navigator.geolocation.getCurrentPosition(
        (position) => {
          const locationData = { lat: position.coords.latitude, lon: position.coords.longitude };
          setLocation(locationData);
          
          // Store location data immediately when it's available
          localStorage.setItem("videoLocation", `${locationData.lat},${locationData.lon}`);
        },
        (error) => {
          console.error("Error getting location:", error);
        }
      );
    } else {
      console.error("Geolocation is not supported by this browser.");
    }
  };

  const startRecording = () => {
    if (mediaRecorderRef.current) {
      setRecording(true);
      mediaRecorderRef.current.start();
    }
  };

  const stopRecording = () => {
    if (mediaRecorderRef.current) {
      setRecording(false);
      mediaRecorderRef.current.stop();
    }
  };

  const handleUpload = async () => {
    if (!videoBlob) return alert("No video to upload");
    
    try {
      setIsRedirecting(true);
      
      // Store video data in localStorage
      const videoURL = URL.createObjectURL(videoBlob);
      localStorage.setItem("videoData", videoURL);
      
      // Add location data if available
      if (location) {
        localStorage.setItem("videoLocation", `${location.lat},${location.lon}`);
      }
      
      // Get the caseId from URL if present
      const caseId = searchParams.get('caseId');
      const caseIdParam = caseId ? `?caseId=${caseId}` : '';
      
      // Redirect back to main page
      router.push(`/${caseIdParam}`);
    } catch (error) {
      console.error("Upload preparation failed:", error);
      alert("Upload preparation failed");
      setIsRedirecting(false);
    }
  };

  const handleCancel = () => {
    // Stop all media tracks before redirecting
    if (streamRef.current) {
      streamRef.current.getTracks().forEach(track => track.stop());
    }
    
    // Get the caseId from URL if present
    const caseId = searchParams.get('caseId');
    const caseIdParam = caseId ? `?caseId=${caseId}` : '';
    
    // Redirect back to main page without saving video
    router.push(`/${caseIdParam}`);
  };

  return (
    <div className="flex flex-col items-center p-6 min-h-screen bg-gray-900 text-white">
      <h1 className="text-3xl font-bold mb-4">Video Recorder</h1>
      <p className="mb-4 text-gray-400">
        {recording 
          ? "Recording in progress..." 
          : videoBlob 
            ? "Review your video below" 
            : "Press 'Start Recording' when ready"}
      </p>
      
      {!videoBlob ? (
        <video ref={videoRef} autoPlay muted className="w-80 h-60 bg-black rounded-lg shadow-lg mb-4" />
      ) : (
        <video controls className="w-80 h-60 bg-black rounded-lg shadow-lg mb-4">
          <source src={URL.createObjectURL(videoBlob)} type="video/mp4" />
        </video>
      )}
      
      {location && (
        <p className="text-sm text-gray-400 mb-4">
          Location: {location.lat.toFixed(6)}, {location.lon.toFixed(6)}
        </p>
      )}
      
      <div className="mt-4 flex gap-4">
        {!videoBlob ? (
          !recording ? (
            <>
              <button 
                onClick={startRecording} 
                className="bg-blue-500 px-6 py-2 rounded-lg shadow-md hover:bg-blue-600"
              >
                Start Recording
              </button>
              <button 
                onClick={handleCancel}
                className="bg-gray-500 px-6 py-2 rounded-lg shadow-md hover:bg-gray-600"
              >
                Cancel
              </button>
            </>
          ) : (
            <button 
              onClick={stopRecording} 
              className="bg-red-500 px-6 py-2 rounded-lg shadow-md hover:bg-red-600"
            >
              Stop Recording
            </button>
          )
        ) : (
          <>
            <button 
              onClick={handleUpload} 
              disabled={isRedirecting}
              className={`bg-green-500 px-6 py-2 rounded-lg shadow-md ${isRedirecting ? 'opacity-50' : 'hover:bg-green-600'}`}
            >
              {isRedirecting ? 'Redirecting...' : 'Use This Video'}
            </button>
            <button 
              onClick={() => {
                setVideoBlob(null);
                startCamera();
              }} 
              className="bg-yellow-500 px-6 py-2 rounded-lg shadow-md hover:bg-yellow-600"
              disabled={isRedirecting}
            >
              Retake
            </button>
            <button 
              onClick={handleCancel}
              className="bg-gray-500 px-6 py-2 rounded-lg shadow-md hover:bg-gray-600"
              disabled={isRedirecting}
            >
              Cancel
            </button>
          </>
        )}
      </div>
    </div>
  );
}