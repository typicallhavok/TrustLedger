"use client";

import { useState, useEffect, useRef } from "react";
import { useRouter } from "next/navigation";
import { uploadFile } from "../../lib/ipfs";

export default function VideoPage() {
  const router = useRouter();
  const [user, setUser] = useState<{ email: string } | null>(null);
  const [videoBlob, setVideoBlob] = useState<Blob | null>(null);
  const [location, setLocation] = useState<{ lat: number; lon: number } | null>(null);
  const videoRef = useRef<HTMLVideoElement>(null);
  const mediaRecorderRef = useRef<MediaRecorder | null>(null);
  const [recording, setRecording] = useState(false);

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
      const stream = await navigator.mediaDevices.getUserMedia({ video: true, audio: true });
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
    setVideoBlob(null);

    try {
      const file = new File([videoBlob], `video_${Date.now()}.mp4`, { type: "video/mp4" });
      const metadata = JSON.stringify({ location, user: user?.email });
      const fileWithMetadata = new File([file, metadata], file.name, { type: file.type });
      await uploadFile(fileWithMetadata, user?.email);
      alert("Video uploaded successfully!");
    } catch (error) {
      console.error("Upload failed:", error);
      alert("Upload failed");
    }
  };

  return (
    <div className="flex flex-col items-center p-6 min-h-screen bg-gray-900 text-white">
      <h1 className="text-3xl font-bold mb-4">Video Recorder</h1>
      <video ref={videoRef} autoPlay className="w-80 h-60 bg-black rounded-lg shadow-lg" />
      <div className="mt-4 flex gap-4">
        {!recording ? (
          <button onClick={startRecording} className="bg-blue-500 px-6 py-2 rounded-lg shadow-md hover:bg-blue-600">
            Start Recording
          </button>
        ) : (
          <button onClick={stopRecording} className="bg-red-500 px-6 py-2 rounded-lg shadow-md hover:bg-red-600">
            Stop Recording
          </button>
        )}
      </div>
      {videoBlob && (
        <div className="mt-4">
          <video controls className="w-80 h-60 rounded-lg shadow-lg">
            <source src={URL.createObjectURL(videoBlob)} type="video/mp4" />
          </video>
          <p className="text-sm text-gray-400 mt-2">
            Location: {location ? `${location.lat}, ${location.lon}` : "Fetching..."}
          </p>
          <div className="flex gap-2 mt-2">
            <button onClick={handleUpload} className="bg-green-500 px-6 py-2 rounded-lg shadow-md hover:bg-green-600">
              Upload
            </button>
            <button onClick={() => setVideoBlob(null)} className="bg-yellow-500 px-6 py-2 rounded-lg shadow-md hover:bg-yellow-600">
              Retake
            </button>
          </div>
        </div>
      )}
    </div>
  );
}
