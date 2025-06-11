"use client";
import { useState, useEffect } from "react";
import { useRouter } from "next/navigation";
import { uploadFile, listFiles, getFileContent, getAccessLogs, viewFile, getFileAccessLogs, clearLogs, exportLogsAsJson, addBlockchainEvidence, storeFileLocally } from "../lib/ipfs"
import LoginPage from "./login/page";
import ActivityTimeline from "../components/activity-timeline";
export default function Home() {
  const router = useRouter();
  const [user, setUser] = useState<{ email: string; isAdmin: boolean } | null>(null);
  const [file, setFile] = useState<File | null>(null);
  const [files, setFiles] = useState<{
    name: string;
    cid: string;
    size?: number;
    type?: string;
    isEncrypted?: boolean;
    hasAccess?: boolean;
  }[]>([]);
  const [selectedFile, setSelectedFile] = useState<string | null>(null);
  const [fileURL, setFileURL] = useState<string>("");
  const [viewURL, setViewURL] = useState<string | null>(null);
  const [accessLogs, setAccessLogs] = useState<any[]>([]);
  const [selectedFileAccessLogs, setSelectedFileAccessLogs] = useState<any[]>([]);
  const [isViewingFileLogs, setIsViewingFileLogs] = useState<boolean>(false);
  const [isViewingAllLogs, setIsViewingAllLogs] = useState<boolean>(false);
  const [isViewingTimeline, setIsViewingTimeline] = useState<boolean>(false);
  const [currentFileForLogs, setCurrentFileForLogs] = useState<string>("");
  const [isLoading, setIsLoading] = useState<boolean>(false);
  const [currentCaseId, setCurrentCaseId] = useState<string | null>(null);
  const [searchTerm, setSearchTerm] = useState<string>("");
  const [showUploadForm, setShowUploadForm] = useState<boolean>(false);
  const [evidenceDetails, setEvidenceDetails] = useState({
    location: "",
    gps: "",
    timestamp: new Date().toISOString().slice(0, 16),
    retriever: "",
    handler: "",
    device_type: "",
    status: "Stored"
  });
  const [password, setPassword] = useState("");
  const [passwordPrompt, setPasswordPrompt] = useState<{ fileName: string; action: 'view' | 'download' } | null>(null);
  const [passwordInput, setPasswordInput] = useState("");
  const [passwordError, setPasswordError] = useState("");

  useEffect(() => {
    if (typeof window !== "undefined") {
      const currentUser = localStorage.getItem("currentUser");
      if (!currentUser) {
        router.push("/login");
      } else {
        setUser(JSON.parse(currentUser));

        // Extract caseId from URL
        const urlParams = new URLSearchParams(window.location.search);
        const caseId = urlParams.get('caseId');
        setCurrentCaseId(caseId);

        // Check for returned camera photo
        const cameraPhoto = localStorage.getItem("cameraPhoto");
        if (cameraPhoto) {
          handleCameraPhotoReturn(cameraPhoto);
          localStorage.removeItem("cameraPhoto");
        }

        // Check for returned video
        const videoData = localStorage.getItem("videoData");
        if (videoData) {
          handleVideoReturn(videoData);
          localStorage.removeItem("videoData");
        }

        // Moved loadFiles() to the separate useEffect below
        if (JSON.parse(currentUser).isAdmin) {
          loadAccessLogs();
        }
      }
    }
  }, [router]);

  // Add a separate useEffect that depends on currentCaseId
  useEffect(() => {
    if (user) {
      loadFiles();
    }
  }, [currentCaseId, user]);

  const handleCameraPhotoReturn = async (photoDataUrl: string) => {
    try {
      // Convert base64 to file
      const response = await fetch(photoDataUrl);
      const blob = await response.blob();
      const newFile = new File([blob], `photo_${Date.now()}.png`, { type: "image/png" });
  
      // Set the file in the state
      setFile(newFile);
  
      // Check if GPS coordinates were saved and update the evidenceDetails
      const gpsCoordinates = localStorage.getItem("cameraGPS");
      if (gpsCoordinates) {
        setEvidenceDetails(prevState => ({
          ...prevState,
          gps: gpsCoordinates
        }));
        
        // Clear the GPS data from localStorage
        localStorage.removeItem("cameraGPS");
      }
  
      // Show the upload form if it's not already visible
      if (!showUploadForm) {
        setShowUploadForm(true);
      }
    } catch (error) {
      console.error("Error processing camera photo:", error);
    }
  };

  const handleVideoReturn = async (videoDataUrl: string) => {
    try {
      // Convert blob URL to file
      const response = await fetch(videoDataUrl);
      const blob = await response.blob();
      const newFile = new File([blob], `video_${Date.now()}.mp4`, { type: "video/mp4" });
  
      // Set the file in the state
      setFile(newFile);
  
      // Check if GPS coordinates were saved and update the evidenceDetails
      const videoGPS = localStorage.getItem("videoLocation");
      if (videoGPS) {
        setEvidenceDetails(prevState => ({
          ...prevState,
          gps: videoGPS
        }));
        
        // Clear the GPS data from localStorage
        localStorage.removeItem("videoLocation");
      }
  
      // Show the upload form if it's not already visible
      if (!showUploadForm) {
        setShowUploadForm(true);
      }
    } catch (error) {
      console.error("Error processing video:", error);
    }
  };

  const loadFiles = async () => {
    setIsLoading(true);
    try {
      const fileList = await listFiles(currentCaseId, user?.email);
      setFiles(fileList);
    } catch (error) {
      console.error("Error loading files:", error);
    } finally {
      setIsLoading(false);
    }
  };

  const loadAccessLogs = async () => {
    if (!user?.isAdmin) return;

    try {
      const logs = await getAccessLogs();
      // If logs don't have userEmail property, add it
      const logsWithUser = logs.map(log => ({
        ...log,
        userEmail: log.userEmail || 'Unknown'
      }));
      setAccessLogs(logsWithUser);
    } catch (error) {
      console.error("Error loading logs:", error);
    }
  };

  const handleLogout = () => {
    localStorage.removeItem("currentUser");
    router.push("/login");
  };

  const handleFileChange = (event: React.ChangeEvent<HTMLInputElement>) => {
    if (event.target.files && event.target.files.length > 0) {
      setFile(event.target.files[0]);
    }
  };

  const handleEvidenceFormChange = (e: React.ChangeEvent<HTMLInputElement | HTMLSelectElement>) => {
    const { name, value } = e.target;
    setEvidenceDetails(prevState => ({
      ...prevState,
      [name]: value
    }));
  };

  const handleOpenCamera = () => {
    // Preserve case ID in the URL when navigating to camera page
    const caseIdParam = currentCaseId ? `?caseId=${currentCaseId}` : '';
    router.push(`/camera${caseIdParam}`);
  };

  const handleOpenVideo = () => {
    // Preserve case ID in the URL when navigating to video page
    const caseIdParam = currentCaseId ? `?caseId=${currentCaseId}` : '';
    router.push(`/video${caseIdParam}`);
  };

  const handleUpload = async () => {
  if (!file) {
    alert("Please select a file first!");
    return;
  }
  setIsLoading(true);
  try {
    // Save to server's evidence directory
    try {
      const formData = new FormData();
      formData.append('file', file);
      const saveResponse = await fetch('/api/save-file', {
        method: 'POST',
        body: formData,
      });
      if (!saveResponse.ok) throw new Error('Local save failed');
      console.log("File saved to evidence directory");
    } catch (serverError) {
      console.error("Local filesystem save failed:", serverError);
      if (serverError instanceof Error) {
        alert(`Warning: Local filesystem save failed: ${serverError.message}`);
      } else {
        alert("Warning: Local filesystem save failed");
      }
    }
    // Pass user email, caseId, and encryptionOptions to uploadFile
    const encryptionOptions = password ? { password } : undefined;
    const cid = await uploadFile(file, user?.email, currentCaseId, encryptionOptions);
    try {
      await addBlockchainEvidence(file, user?.email, cid, evidenceDetails);
      alert(`File uploaded successfully and recorded on blockchain! CID: ${cid}`);
    } catch (blockchainError) {
      console.error("Blockchain recording failed:", blockchainError);
      alert(`File uploaded to IPFS successfully (CID: ${cid}), but blockchain recording failed: ${blockchainError}`);
    }
    await loadFiles();
    if (user?.isAdmin) {
      await loadAccessLogs();
    }
    setFile(null);
    setPassword("");
    const fileInput = document.querySelector('input[type="file"]') as HTMLInputElement;
    if (fileInput) fileInput.value = '';
    setShowUploadForm(false);
  } catch (error) {
    console.error("Upload failed:", error);
    alert(`Upload failed: ${error}`);
  } finally {
    setIsLoading(false);
  }
};

  const handleView = async (fileName: string) => {
    setIsLoading(true);
    try {
      const fileObj = files.find(f => f.name === fileName);
      if (fileObj?.isEncrypted) {
        setPasswordPrompt({ fileName, action: 'view' });
        setIsLoading(false);
        return;
      }
      const url = await viewFile(fileName, user?.email, currentCaseId);
      if (!url) {
        alert("Error viewing file");
        return;
      }
      setViewURL(url);
      window.open(url, '_blank');
      if (user?.isAdmin) {
        await loadAccessLogs();
      }
    } catch (error) {
      console.error("View failed:", error);
      alert(`View failed: ${error}`);
    } finally {
      setIsLoading(false);
    }
  };

  const handleRetrieve = async (fileName: string) => {
    setIsLoading(true);
    try {
      const fileObj = files.find(f => f.name === fileName);
      if (fileObj?.isEncrypted) {
        setPasswordPrompt({ fileName, action: 'download' });
        setIsLoading(false);
        return;
      }
      const blob = await getFileContent(fileName, user?.email, currentCaseId);
      if (!blob) {
        alert("Error retrieving file");
        return;
      }
      const url = URL.createObjectURL(blob.blob ?? blob);
      setFileURL(url);
      setSelectedFile(fileName);
      const a = document.createElement('a');
      a.href = url;
      a.download = fileName;
      document.body.appendChild(a);
      a.click();
      document.body.removeChild(a);
      if (user?.isAdmin) {
        await loadAccessLogs();
      }
    } catch (error) {
      console.error("Retrieve failed:", error);
      alert(`Retrieve failed: ${error}`);
    } finally {
      setIsLoading(false);
    }
  };

  // Handle password prompt submit
  const handlePasswordSubmit = async () => {
    if (!passwordPrompt) return;
    setIsLoading(true);
    setPasswordError("");
    try {
      if (passwordPrompt.action === 'view') {
        const url = await viewFile(passwordPrompt.fileName, user?.email, currentCaseId, passwordInput);
        if (!url) throw new Error("Invalid password or error viewing file");
        setViewURL(url);
        window.open(url, '_blank');
      } else {
        const blob = await getFileContent(passwordPrompt.fileName, user?.email, currentCaseId, passwordInput);
        if (!blob) throw new Error("Invalid password or error retrieving file");
        const url = URL.createObjectURL(blob.blob ?? blob);
        setFileURL(url);
        setSelectedFile(passwordPrompt.fileName);
        const a = document.createElement('a');
        a.href = url;
        a.download = passwordPrompt.fileName;
        document.body.appendChild(a);
        a.click();
        document.body.removeChild(a);
      }
      setPasswordPrompt(null);
      setPasswordInput("");
    } catch (error) {
      setPasswordError("Invalid password or error. Try again.");
    } finally {
      setIsLoading(false);
    }
  };

  const formatTimestamp = (timestamp: string) => {
    return new Date(timestamp).toLocaleString();
  };

  const formatFileSize = (size?: number) => {
    if (!size) return 'Unknown';

    if (size < 1024) return `${size} B`;
    if (size < 1024 * 1024) return `${(size / 1024).toFixed(2)} KB`;
    if (size < 1024 * 1024 * 1024) return `${(size / (1024 * 1024)).toFixed(2)} MB`;
    return `${(size / (1024 * 1024 * 1024)).toFixed(2)} GB`;
  };

  const getStatusBadgeColor = (status: string) => {
    return status === 'success' ? 'bg-green-600' : 'bg-red-600';
  };

  const getActionBadgeColor = (action: string) => {
    switch (action) {
      case 'uploaded':
        return 'bg-blue-600';
      case 'retrieved':
        return 'bg-green-600';
      case 'viewed':
        return 'bg-yellow-600';
      case 'deleted':
        return 'bg-red-600';
      case 'list_files':
        return 'bg-purple-600';
      default:
        if (action.includes('attempt')) return 'bg-orange-600';
        return 'bg-gray-600';
    }
  };

  if (!user) return <LoginPage />;

  function handleBack(event: React.MouseEvent<HTMLButtonElement, MouseEvent>): void {
    event.preventDefault();
    // If there is a caseId in the URL, go back to the main dashboard or remove the caseId param
    if (currentCaseId) {
      // Remove caseId from URL and reload page
      const url = new URL(window.location.href);
      url.searchParams.delete('caseId');
      window.location.href = url.pathname + url.search;
    } else {
      // Otherwise, just go back in history
      window.history.back();
    }
  }

  function handleSearch(event: React.ChangeEvent<HTMLInputElement>): void {
    setSearchTerm(event.target.value);
  }

  function handleViewAllLogs(event: React.MouseEvent<HTMLButtonElement, MouseEvent>): void {
    event.preventDefault();
    setIsViewingAllLogs(true);
    setIsViewingFileLogs(false);
    setIsViewingTimeline(false);
  }

  function handleViewTimeline(event: React.MouseEvent<HTMLButtonElement, MouseEvent>): void {
    event.preventDefault();
    setIsViewingTimeline(true);
    setIsViewingAllLogs(false);
    setIsViewingFileLogs(false);
  }

  async function handleExportLogs(event: React.MouseEvent<HTMLButtonElement, MouseEvent>): Promise<void> {
    event.preventDefault();
    try {
      const logs = await exportLogsAsJson();
      const blob = new Blob([JSON.stringify(logs, null, 2)], { type: "application/json" });
      const url = URL.createObjectURL(blob);
      const a = document.createElement("a");
      a.href = url;
      a.download = "access-logs.json";
      document.body.appendChild(a);
      a.click();
      document.body.removeChild(a);
      URL.revokeObjectURL(url);
    } catch (error) {
      alert("Failed to export logs.");
      console.error("Export logs error:", error);
    }
  }

  // Add this function to handle viewing logs for a specific file
  async function handleViewLogs(fileName: string, cid: string) {
    setIsLoading(true);
    setIsViewingFileLogs(true);
    setIsViewingAllLogs(false);
    setIsViewingTimeline(false);
    setCurrentFileForLogs(fileName);
    try {
      const logs = await getFileAccessLogs(fileName);
      setSelectedFileAccessLogs(logs);
    } catch (error) {
      setSelectedFileAccessLogs([]);
      alert("Failed to load file access logs.");
      console.error("File access logs error:", error);
    } finally {
      setIsLoading(false);
    }
  }

  return (
    <div className="flex flex-col h-screen bg-gray-900 text-white">
      {/* Header with title and logout button */}
      <header className="bg-gray-800 p-4 flex justify-between items-center shadow-md">
        <h1 className="text-3xl font-bold text-blue-400">Evidence File Storage</h1>
        <button
          onClick={handleLogout}
          className="bg-red-600 px-3 py-1 rounded hover:bg-red-700"
        >
          Logout
        </button>
      </header>

      {/* Back button and Search bar */}
<div className="bg-gray-800 border-t border-gray-700 px-4 py-3 flex justify-between items-center">
  <button
    onClick={handleBack}
    className="bg-gray-700 hover:bg-gray-600 text-white px-4 py-2 rounded flex items-center"
  >
    <span>← Back</span>
  </button>
  
  <div className="flex-1 max-w-2xl mx-4">
    <div className="relative">
      <input
        type="text"
        placeholder="Search files..."
        value={searchTerm}
        onChange={handleSearch}
        className="w-full bg-gray-700 border border-gray-600 rounded pl-10 pr-4 py-2 text-white focus:outline-none focus:border-blue-500"
      />
      <div className="absolute left-3 top-2.5 text-gray-400">
        🔍
      </div>
      {searchTerm && (
        <button 
          onClick={() => setSearchTerm("")}
          className="absolute right-3 top-2.5 text-gray-400 hover:text-white"
        >
          ✕
        </button>
      )}
    </div>
  </div>
</div>

      {/* Admin Actions Bar */}
      {user.isAdmin && (
        <div className="bg-gray-800 border-t border-gray-700 px-4 py-2 flex justify-center space-x-4">
          <button
            onClick={handleViewAllLogs}
            className="bg-purple-600 px-4 py-1 rounded hover:bg-purple-700 transition"
            disabled={isLoading}
          >
            View All Logs
          </button>
          <button
            onClick={handleViewTimeline}
            className="bg-indigo-600 px-4 py-1 rounded hover:bg-indigo-700 transition"
            disabled={isLoading}
          >
            Activity Timeline
          </button>
          <button
            onClick={handleExportLogs}
            className="bg-blue-600 px-4 py-1 rounded hover:bg-blue-700 transition"
            disabled={isLoading}
          >
            Export Logs
          </button>
        </div>
      )}

      {/* Main content area */}
      <main className="flex-1 p-6 overflow-auto">
        {/* Stored Files Section at the top */}
        <div className="bg-gray-800 p-6 rounded-lg shadow-lg mb-6">
          <div className="flex justify-between items-center mb-4">
            <h2 className="text-xl font-semibold text-green-300">Stored Files</h2>
            <button
              onClick={loadFiles}
              className="bg-green-600 px-3 py-1 rounded text-sm hover:bg-green-700"
              disabled={isLoading}
            >
              Refresh
            </button>
          </div>

          {isLoading ? (
            <div className="text-center py-4">
              <p className="text-gray-400">Loading...</p>
            </div>
          ) : files.length === 0 ? (
            <p className="text-gray-400">No files uploaded yet.</p>
          ) : (
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-4">
              {files.filter(file=>searchTerm===""||file.name.toLowerCase().includes(searchTerm.toLowerCase())).map((file) => (
                <div key={file.cid} className="flex flex-col p-4 border border-gray-700 rounded bg-gray-700 hover:bg-gray-600 transition">
                  <div className="flex justify-between items-center mb-2">
                    <span className="text-gray-300 font-medium truncate flex items-center">
                      {file.name}
                      {/* Lock icon if encrypted */}
                      {file.isEncrypted && <span className="ml-2 text-yellow-400" title="Password Protected">🔒</span>}
                    </span>
                    <div className="flex space-x-2 text-xs text-gray-400">
                      {file.size && <span>{formatFileSize(file.size)}</span>}
                    </div>
                  </div>
                  <div className="text-xs text-gray-400 truncate mb-3">
                    <span className="text-gray-500">CID: </span>{file.cid}
                  </div>
                  <div className="flex mt-auto space-x-2">
                    <button
                      onClick={() => handleView(file.name)}
                      className="bg-yellow-500 px-3 py-1 rounded text-sm flex-1 hover:bg-yellow-600"
                      disabled={isLoading}
                    >
                      View
                    </button>

                    {/* Only show these buttons for admin users */}
                    {user.isAdmin && (
                      <>
                        <button
                          onClick={() => handleRetrieve(file.name)}
                          className="bg-green-500 px-3 py-1 rounded text-sm flex-1 hover:bg-green-600"
                          disabled={isLoading}
                        >
                          Download
                        </button>
                        <button
                          onClick={() => handleViewLogs(file.name, file.cid)}
                          className="bg-blue-500 px-3 py-1 rounded text-sm flex-1 hover:bg-blue-600"
                          disabled={isLoading}
                        >
                          Logs
                        </button>
                      </>
                    )}
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>

        {/* Activity Timeline Section - Only visible to admin */}
        {user.isAdmin && isViewingTimeline && (
          <div className="bg-gray-800 p-6 rounded-lg shadow-lg mb-6">
            <div className="flex justify-between items-center mb-4">
              <h2 className="text-xl font-semibold text-indigo-300">Activity Timeline</h2>
              <button
                onClick={() => setIsViewingTimeline(false)}
                className="bg-gray-600 hover:bg-gray-700 px-3 py-1 rounded"
              >
                Close
              </button>
            </div>
            <ActivityTimeline logs={accessLogs} />
          </div>
        )}

        {/* File-specific Access Logs Section - Only visible to admin */}
        {user.isAdmin && isViewingFileLogs && (
          <div className="bg-gray-800 p-6 rounded-lg shadow-lg mb-6">
            <div className="flex justify-between items-center mb-4">
              <h2 className="text-xl font-semibold text-purple-300">Access Logs for: {currentFileForLogs}</h2>
              <button
                onClick={() => setIsViewingFileLogs(false)}
                className="bg-gray-600 hover:bg-gray-700 px-3 py-1 rounded"
              >
                Close
              </button>
            </div>
            {selectedFileAccessLogs.length === 0 ? (
              <p className="text-gray-400">No access logs for this file.</p>
            ) : (
              <div className="max-h-96 overflow-y-auto">
                <table className="w-full text-sm">
                  <thead className="bg-gray-700">
                    <tr>
                      <th className="text-left p-2">User</th>
                      <th className="text-left p-2">Action</th>
                      <th className="text-left p-2">Status</th>
                      <th className="text-left p-2">Timestamp</th>
                      <th className="text-left p-2">Details</th>
                    </tr>
                  </thead>
                  <tbody>
                    {selectedFileAccessLogs.map((log, index) => (
                      <tr key={index} className="border-t border-gray-700">
                        <td className="p-2 text-xs">
                          {log.userEmail || 'Unknown'}
                        </td>
                        <td className="p-2">
                          <span className={`px-2 py-1 rounded text-xs ${getActionBadgeColor(log.action)}`}>
                            {log.action}
                          </span>
                        </td>
                        <td className="p-2">
                          <span className={`px-2 py-1 rounded text-xs ${getStatusBadgeColor(log.status)}`}>
                            {log.status}
                          </span>
                        </td>
                        <td className="p-2">{formatTimestamp(log.timestamp)}</td>
                        <td className="p-2">
                          <div className="flex flex-col">
                            {log.fileSize && <span className="text-xs">Size: {formatFileSize(log.fileSize)}</span>}
                            {log.fileType && <span className="text-xs">Type: {log.fileType}</span>}
                            {log.errorDetails && <span className="text-xs text-red-400">Error: {log.errorDetails}</span>}
                          </div>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}
          </div>
        )}

        {/* All Access Logs Section - Only visible to admin */}
        {user.isAdmin && isViewingAllLogs && (
          <div className="bg-gray-800 p-6 rounded-lg shadow-lg mb-6">
            <div className="flex justify-between items-center mb-4">
              <h2 className="text-xl font-semibold text-purple-300">All System Logs</h2>
              <button
                onClick={() => setIsViewingAllLogs(false)}
                className="bg-gray-600 hover:bg-gray-700 px-3 py-1 rounded"
              >
                Close
              </button>
            </div>
            {accessLogs.length === 0 ? (
              <p className="text-gray-400">No access logs recorded.</p>
            ) : (
              <div className="max-h-96 overflow-y-auto">
                <table className="w-full text-sm">
                  <thead className="bg-gray-700">
                    <tr>
                      <th className="text-left p-2">File</th>
                      <th className="text-left p-2">User</th>
                      <th className="text-left p-2">Action</th>
                      <th className="text-left p-2">Status</th>
                      <th className="text-left p-2">Timestamp</th>
                      <th className="text-left p-2">Details</th>
                    </tr>
                  </thead>
                  <tbody>
                    {accessLogs.map((log, index) => (
                      <tr key={index} className="border-t border-gray-700">
                        <td className="p-2 truncate max-w-xs">{log.fileName}</td>
                        <td className="p-2 text-xs">
                          {log.userEmail || 'Unknown'}
                        </td>
                        <td className="p-2">
                          <span className={`px-2 py-1 rounded text-xs ${getActionBadgeColor(log.action)}`}>
                            {log.action}
                          </span>
                        </td>
                        <td className="p-2">
                          <span className={`px-2 py-1 rounded text-xs ${getStatusBadgeColor(log.status)}`}>
                            {log.status}
                          </span>
                        </td>
                        <td className="p-2">{formatTimestamp(log.timestamp)}</td>
                        <td className="p-2">
                          <details className="text-xs">
                            <summary>View Details</summary>
                            <div className="p-2 bg-gray-900 mt-1 rounded">
                              {log.cid && <div>CID: {log.cid}</div>}
                              {log.fileSize && <div>Size: {formatFileSize(log.fileSize)}</div>}
                              {log.fileType && <div>Type: {log.fileType}</div>}
                              {log.userAgent && <div>User Agent: {log.userAgent}</div>}
                              {log.errorDetails && <div className="text-red-400">Error: {log.errorDetails}</div>}
                            </div>
                          </details>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}
          </div>
        )}

        {/* Upload Form Modal - Only visible when + button is clicked */}
        {showUploadForm && (
          <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50">
            <div className="bg-gray-800 p-6 rounded-lg shadow-lg w-full max-w-lg">
              <div className="flex justify-between items-center mb-4">
                <h2 className="text-xl font-semibold text-blue-300">Upload Evidence</h2>
                <button
                  onClick={() => setShowUploadForm(false)}
                  className="text-gray-400 hover:text-white"
                >
                  ✕
                </button>
              </div>
              <div className="mb-4 relative">
                <div className="flex items-center gap-2">
                  <input
                    type="file"
                    onChange={handleFileChange}
                    className="w-full border border-gray-600 bg-gray-700 p-2 rounded"
                    disabled={isLoading}
                  />
                  <button
                    onClick={handleOpenCamera}
                    className="bg-blue-500 hover:bg-blue-600 px-3 py-2 rounded text-xl"
                    title="Take Photo"
                  >
                    📷
                  </button>
                  <button
                    onClick={handleOpenVideo}
                    className="bg-blue-500 hover:bg-blue-600 px-3 py-2 rounded text-xl"
                    title="Record Video"
                  >
                    🎥
                  </button>
                </div>
                {file && (
                  <div className="mt-2 text-sm text-green-400">
                    Selected: {file.name} ({formatFileSize(file.size)})
                  </div>
                )}
              </div>
              <div className="mb-4">
                <input
                  type="password"
                  placeholder="Optional: Set password to encrypt file"
                  value={password}
                  onChange={e => setPassword(e.target.value)}
                  className="w-full p-2 bg-gray-700 border border-gray-600 rounded"
                  disabled={isLoading}
                />
              </div>

              <div className="space-y-4">
                <input
                  type="text"
                  name="location"
                  placeholder="Location"
                  value={evidenceDetails.location}
                  onChange={handleEvidenceFormChange}
                  className="w-full p-2 bg-gray-700 border border-gray-600 rounded"
                />
                <input
                  type="text"
                  name="gps"
                  placeholder="GPS Coordinates"
                  value={evidenceDetails.gps}
                  onChange={handleEvidenceFormChange}
                  className="w-full p-2 bg-gray-700 border border-gray-600 rounded"
                />
                <input
                  type="datetime-local"
                  name="timestamp"
                  value={evidenceDetails.timestamp}
                  onChange={handleEvidenceFormChange}
                  className="w-full p-2 bg-gray-700 border border-gray-600 rounded"
                />
                <input
                  type="text"
                  name="retriever"
                  placeholder="Retriever"
                  value={evidenceDetails.retriever}
                  onChange={handleEvidenceFormChange}
                  className="w-full p-2 bg-gray-700 border border-gray-600 rounded"
                />
                <input
                  type="text"
                  name="handler"
                  placeholder="Handler"
                  value={evidenceDetails.handler}
                  onChange={handleEvidenceFormChange}
                  className="w-full p-2 bg-gray-700 border border-gray-600 rounded"
                />
                <input
                  type="text"
                  name="device_type"
                  placeholder="Device Type"
                  value={evidenceDetails.device_type}
                  onChange={handleEvidenceFormChange}
                  className="w-full p-2 bg-gray-700 border border-gray-600 rounded"
                />
                <select
                  name="status"
                  value={evidenceDetails.status}
                  onChange={handleEvidenceFormChange}
                  className="w-full p-2 bg-gray-700 border border-gray-600 rounded"
                >
                  <option value="Stored">Stored</option>
                  <option value="Collected">Collected</option>
                  <option value="Analyzed">Analyzed</option>
                  <option value="Archived">Archived</option>
                </select>
                <button
                  onClick={handleUpload}
                  className={`w-full ${isLoading ? 'bg-gray-500' : 'bg-blue-500 hover:bg-blue-600'} text-white py-2 rounded transition`}
                  disabled={isLoading}
                >
                  {isLoading ? 'Processing...' : 'Upload to IPFS'}
                </button>
              </div>
            </div>
          </div>
        )}

        {/* Password prompt modal for protected files */}
        {passwordPrompt && (
  <div className="fixed inset-0 bg-black bg-opacity-60 flex items-center justify-center z-50">
    <div className="bg-gray-800 p-6 rounded-lg shadow-lg w-full max-w-xs flex flex-col items-center">
      <h2 className="text-lg font-semibold text-yellow-300 mb-2">Password Required</h2>
      <p className="mb-2 text-gray-300">Enter password to {passwordPrompt.action === 'view' ? 'view' : 'download'} <span className="font-bold">{passwordPrompt.fileName}</span></p>
      <input
        type="password"
        className="w-full p-2 mb-2 bg-gray-700 border border-gray-600 rounded"
        placeholder="Password"
        value={passwordInput}
        onChange={e => setPasswordInput(e.target.value)}
        disabled={isLoading}
      />
      {passwordError && <div className="text-red-400 text-sm mb-2">{passwordError}</div>}
      <div className="flex gap-2 w-full">
        <button
          onClick={handlePasswordSubmit}
          className="bg-blue-500 hover:bg-blue-600 px-4 py-1 rounded text-white flex-1"
          disabled={isLoading || !passwordInput}
        >
          Submit
        </button>
        <button
          onClick={() => { setPasswordPrompt(null); setPasswordInput(""); setPasswordError(""); }}
          className="bg-gray-600 hover:bg-gray-700 px-4 py-1 rounded text-white flex-1"
          disabled={isLoading}
        >
          Cancel
        </button>
      </div>
    </div>
  </div>
)}
      </main>

      {/* Footer with user info (bottom left) and upload button */}
      <footer className="bg-gray-800 p-4 border-t border-gray-700 flex justify-between items-center">
        <div className="flex items-center">
          <span className="text-gray-400 mr-2">Logged in as:</span>
          <span className="text-white">{user.email}</span>
          {user.isAdmin && <span className="ml-2 bg-purple-600 px-2 py-1 rounded text-xs">Admin</span>}
        </div>

        {/* Plus button at bottom right */}
        <button
          onClick={() => setShowUploadForm(true)}
          className="bg-blue-500 hover:bg-blue-600 text-white w-12 h-12 rounded-full flex items-center justify-center text-2xl shadow-lg"
        >
          +
        </button>
      </footer>
    </div>
  );
}