"use client";

import { useState, useEffect, useRef } from "react";
import { useRouter } from "next/navigation";
import { uploadFile } from "../../lib/ipfs";

export default function CameraPage() {
  const router = useRouter();
  const [user, setUser] = useState<{ email: string } | null>(null);
  const [image, setImage] = useState<string | null>(null);
  const [location, setLocation] = useState<{ lat: number; lon: number } | null>(null);
  const videoRef = useRef<HTMLVideoElement>(null);
  const canvasRef = useRef<HTMLCanvasElement>(null);

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
      const stream = await navigator.mediaDevices.getUserMedia({ video: true });
      if (videoRef.current) {
        videoRef.current.srcObject = stream;
      }
    } catch (error) {
      console.error("Error accessing webcam:", error);
    }
  };

  const getLocation = () => {
    if (navigator.geolocation) {
      navigator.geolocation.getCurrentPosition(
        (position) => {
          setLocation({ lat: position.coords.latitude, lon: position.coords.longitude });
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
      const context = canvasRef.current.getContext("2d");
      if (context) {
        context.drawImage(videoRef.current, 0, 0, canvasRef.current.width, canvasRef.current.height);
        setImage(canvasRef.current.toDataURL("image/png"));
      }
    }
  };

  const handleUpload = async () => {
    if (!image) return alert("No image to upload");
    setImage(null);

    try {
      const response = await fetch(image);
      const blob = await response.blob();
      const file = new File([blob], `photo_${Date.now()}.png`, { type: "image/png" });
      const metadata = JSON.stringify({ location, user: user?.email });
      const fileWithMetadata = new File([file, metadata], file.name, { type: file.type });
      await uploadFile(fileWithMetadata, user?.email);
      alert("Photo uploaded successfully!");
    } catch (error) {
      console.error("Upload failed:", error);
      alert("Upload failed");
    }
  };

  return (
    <div className="flex flex-col items-center p-6 min-h-screen bg-gray-900 text-white">
      <h1 className="text-4xl font-extrabold mb-6">Camera Upload</h1>
      <video ref={videoRef} autoPlay className="w-80 h-60 rounded-lg shadow-lg bg-black" />
      <canvas ref={canvasRef} width={640} height={480} className="hidden" />
      <button
        onClick={capturePhoto}
        className="mt-6 bg-blue-600 hover:bg-blue-700 text-white font-bold py-2 px-6 rounded-lg transition duration-300 shadow-md"
      >
        Capture Photo
      </button>
      {image && (
        <div className="mt-6 bg-gray-800 p-4 rounded-lg shadow-lg w-80 flex flex-col items-center">
          <img src={image} alt="Captured" className="w-full h-60 rounded-lg" />
          <p className="text-sm text-gray-400 mt-2">
            Location: {location ? `${location.lat}, ${location.lon}` : "Fetching..."}
          </p>
          <div className="flex gap-4 mt-4">
            <button
              onClick={handleUpload}
              className="bg-green-600 hover:bg-green-700 text-white font-bold py-2 px-6 rounded-lg transition duration-300 shadow-md"
            >
              Upload
            </button>
            <button
              onClick={() => setImage(null)}
              className="bg-red-600 hover:bg-red-700 text-white font-bold py-2 px-6 rounded-lg transition duration-300 shadow-md"
            >
              Retake
            </button>
          </div>
        </div>
      )}
    </div>
  );
}
