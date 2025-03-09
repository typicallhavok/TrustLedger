"use client";

import { useState, useEffect, useRef } from "react";
import { useRouter, useSearchParams } from "next/navigation";

export default function CameraPage() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const [user, setUser] = useState<{ email: string } | null>(null);
  const [image, setImage] = useState<string | null>(null);
  const [location, setLocation] = useState<{ lat: number; lon: number } | null>(null);
  const videoRef = useRef<HTMLVideoElement>(null);
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const [isLoading, setIsLoading] = useState<boolean>(false);

  useEffect(() => {
    const currentUser = localStorage.getItem("currentUser");
    if (!currentUser) {
      router.push("/login");
    } else {
      setUser(JSON.parse(currentUser));
      startCamera();
      getLocation();
    }
  }, [router]);

  const startCamera = async () => {
    try {
      const stream = await navigator.mediaDevices.getUserMedia({ 
        video: { 
          facingMode: "environment", // Prefer back camera if available
          width: { ideal: 1280 },
          height: { ideal: 720 }
        } 
      });
      if (videoRef.current) {
        videoRef.current.srcObject = stream;
      }
    } catch (error) {
      console.error("Error accessing camera:", error);
      alert("Could not access camera. Please check permissions.");
    }
  };

  const getLocation = () => {
    if (navigator.geolocation) {
      navigator.geolocation.getCurrentPosition(
        (position) => {
          setLocation({ 
            lat: position.coords.latitude, 
            lon: position.coords.longitude 
          });
        },
        (error) => {
          console.error("Error getting location:", error);
        }
      );
    } else {
      console.error("Geolocation is not supported by this browser.");
    }
  };

  const capturePhoto = () => {
    if (videoRef.current && canvasRef.current) {
      const video = videoRef.current;
      const canvas = canvasRef.current;
      
      // Set canvas dimensions to match video
      canvas.width = video.videoWidth;
      canvas.height = video.videoHeight;
      
      const context = canvas.getContext("2d");
      if (context) {
        context.drawImage(video, 0, 0, canvas.width, canvas.height);
        const imageDataUrl = canvas.toDataURL("image/png");
        setImage(imageDataUrl);
      }
    }
  };

  const handleUpload = () => {
    if (!image) {
      alert("Please capture a photo first");
      return;
    }
    
    setIsLoading(true);
    
    try {
      // Store the image data in localStorage for the main page to retrieve
      localStorage.setItem("cameraPhoto", image);
      
      // Store the GPS coordinates in localStorage
      if (location) {
        localStorage.setItem("cameraGPS", `${location.lat.toFixed(6)}, ${location.lon.toFixed(6)}`);
      }
      
      // Get the caseId from URL if it exists
      const caseId = searchParams.get('caseId');
      
      // Navigate back to the main page with the caseId parameter if it exists
      const redirectPath = caseId ? `/?caseId=${caseId}` : '/';
      router.push(redirectPath);
    } catch (error) {
      console.error("Error handling photo upload:", error);
      setIsLoading(false);
      alert("Failed to process photo");
    }
  };

  const handleCancel = () => {
    // Get the caseId from URL if it exists
    const caseId = searchParams.get('caseId');
    
    // Navigate back to the main page with the caseId parameter if it exists
    const redirectPath = caseId ? `/?caseId=${caseId}` : '/';
    router.push(redirectPath);
  };

  const stopCamera = () => {
    if (videoRef.current && videoRef.current.srcObject) {
      const stream = videoRef.current.srcObject as MediaStream;
      const tracks = stream.getTracks();
      
      tracks.forEach(track => {
        track.stop();
      });
      
      videoRef.current.srcObject = null;
    }
  };

  return (
    <div className="flex flex-col items-center p-6 min-h-screen bg-gray-900 text-white">
      <h1 className="text-4xl font-extrabold mb-6">Camera Upload</h1>
      
      {!image ? (
        <>
          <div className="relative w-full max-w-lg">
            <video 
              ref={videoRef} 
              autoPlay 
              playsInline
              className="w-full h-auto rounded-lg shadow-lg bg-black"
            />
            <div className="text-sm text-gray-400 mt-2 text-center">
              Location: {location ? `${location.lat.toFixed(6)}, ${location.lon.toFixed(6)}` : "Fetching..."}
            </div>
          </div>
          
          <button
            onClick={capturePhoto}
            className="mt-6 bg-blue-600 hover:bg-blue-700 text-white font-bold py-3 px-8 rounded-lg transition duration-300 shadow-md w-64"
          >
            Capture Photo
          </button>
          
          <button
            onClick={handleCancel}
            className="mt-4 bg-gray-600 hover:bg-gray-700 text-white font-bold py-2 px-6 rounded-lg transition duration-300 shadow-md"
          >
            Cancel
          </button>
        </>
      ) : (
        <div className="mt-6 bg-gray-800 p-6 rounded-lg shadow-lg w-full max-w-lg flex flex-col items-center">
          <img src={image} alt="Captured" className="w-full rounded-lg shadow-md" />
          
          <p className="text-sm text-gray-400 mt-4">
            Location: {location ? `${location.lat.toFixed(6)}, ${location.lon.toFixed(6)}` : "Unknown"}
          </p>
          
          <div className="flex gap-4 mt-6 w-full">
            <button
              onClick={handleUpload}
              disabled={isLoading}
              className={`${isLoading ? 'bg-green-800' : 'bg-green-600 hover:bg-green-700'} text-white font-bold py-3 px-6 rounded-lg transition duration-300 shadow-md flex-1`}
            >
              {isLoading ? 'Processing...' : 'Upload'}
            </button>
            
            <button
              onClick={() => {
                setImage(null);
                startCamera(); // Restart camera after retake
              }}
              disabled={isLoading}
              className="bg-red-600 hover:bg-red-700 text-white font-bold py-3 px-6 rounded-lg transition duration-300 shadow-md flex-1"
            >
              Retake
            </button>
          </div>
        </div>
      )}
      
      {/* Hidden canvas for image capture */}
      <canvas ref={canvasRef} className="hidden" />
    </div>
  );
}