"use client";
import { useState, useEffect } from "react";
import { useRouter } from "next/navigation";
import { uploadFile, listFiles, getFileContent, deleteFile, getAccessLogs, viewFile, getFileAccessLogs, clearLogs, exportLogsAsJson } from "../lib/ipfs";
import LoginPage from "./login/page";
import ActivityTimeline from "../components/activity-timeline";

export default function Home() {
  const router = useRouter();
  const [user, setUser] = useState<{ email: string; isAdmin: boolean } | null>(null);
  const [file, setFile] = useState<File | null>(null);
  const [files, setFiles] = useState<{ name: string; cid: string; size?: number; type?: string }[]>([]);
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
  const [searchTerm, setSearchTerm] = useState<string>("");

  useEffect(() => {
    if (typeof window !== "undefined") {
      const currentUser = localStorage.getItem("currentUser");
      if (!currentUser) {
        router.push("/login");
      } else {
        setUser(JSON.parse(currentUser));
        loadFiles();
        if (JSON.parse(currentUser).isAdmin) {
          loadAccessLogs();
        }
      }
    }
  }, [router]);

  const loadFiles = async () => {
    setIsLoading(true);
    try {
      const fileList = await listFiles();
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

  const handleSearchChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    setSearchTerm(e.target.value);
  };

  const filteredFiles = files.filter(file => 
    file.name.toLowerCase().includes(searchTerm.toLowerCase())
  );

  const handleFileChange = (event: React.ChangeEvent<HTMLInputElement>) => {
    if (event.target.files && event.target.files.length > 0) {
      setFile(event.target.files[0]);
    }
  };

  const handleUpload = async () => {
    if (!file) return alert("Please select a file first!");
    setIsLoading(true);
    try {
      // Pass user email to uploadFile function
      const cid = await uploadFile(file, user?.email);
      alert(`File uploaded successfully! CID: ${cid}`);
      await loadFiles();
      if (user?.isAdmin) {
        await loadAccessLogs();
      }
      setFile(null);
      // Reset the file input
      const fileInput = document.querySelector('input[type="file"]') as HTMLInputElement;
      if (fileInput) fileInput.value = '';
    } catch (error) {
      console.error("Upload failed:", error);
      alert(`Upload failed: ${error}`);
    } finally {
      setIsLoading(false);
    }
  };

  const handleRetrieve = async (fileName: string) => {
    setIsLoading(true);
    try {
      // Pass user email to getFileContent function
      const blob = await getFileContent(fileName, user?.email);
      if (!blob) {
        alert("Error retrieving file");
        return;
      }

      const url = URL.createObjectURL(blob);
      setFileURL(url);
      setSelectedFile(fileName);

      // Create a download link and trigger it
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

  const handleView = async (fileName: string) => {
    setIsLoading(true);
    try {
      // Pass user email to viewFile function
      const url = await viewFile(fileName, user?.email);
      if (!url) {
        alert("Error viewing file");
        return;
      }

      setViewURL(url);
      
      // Open the file in a new tab
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

  const handleDelete = async (fileName: string) => {
    if (!user?.isAdmin) {
      alert("You don't have permission to delete files");
      return;
    }
    
    if (!confirm(`Are you sure you want to delete ${fileName}?`)) return;
    
    setIsLoading(true);
    try {
      // Pass user email to deleteFile function
      await deleteFile(fileName, user?.email);
      alert("File deleted successfully!");
      await loadFiles();
      await loadAccessLogs();
    } catch (error) {
      console.error("Delete failed:", error);
      alert(`Delete failed: ${error}`);
    } finally {
      setIsLoading(false);
    }
  };

  const handleViewLogs = async (fileName: string, cid: string) => {
    if (!user?.isAdmin) {
      alert("You don't have permission to view logs");
      return;
    }
    setIsLoading(true);
    try {
      const logs = await getFileAccessLogs(fileName);
      setSelectedFileAccessLogs(logs);
      setIsViewingFileLogs(true);
      setIsViewingAllLogs(false);
      setIsViewingTimeline(false);
      setCurrentFileForLogs(fileName);
    } catch (error) {
      console.error("Error fetching file logs:", error);
      alert(`Error fetching file logs: ${error}`);
    } finally {
      setIsLoading(false);
    }
  };

  const handleViewAllLogs = async () => {
    if (!user?.isAdmin) {
      alert("You don't have permission to view logs");
      return;
    }
    
    setIsLoading(true);
    try {
      await loadAccessLogs();
      setIsViewingAllLogs(true);
      setIsViewingFileLogs(false);
      setIsViewingTimeline(false);
    } catch (error) {
      console.error("Error fetching all logs:", error);
      alert(`Error fetching all logs: ${error}`);
    } finally {
      setIsLoading(false);
    }
  };
  
  const handleViewTimeline = async () => {
    if (!user?.isAdmin) {
      alert("You don't have permission to view activity timeline");
      return;
    }
    
    setIsLoading(true);
    try {
      await loadAccessLogs();
      setIsViewingTimeline(true);
      setIsViewingAllLogs(false);
      setIsViewingFileLogs(false);
    } catch (error) {
      console.error("Error fetching logs for timeline:", error);
      alert(`Error fetching logs for timeline: ${error}`);
    } finally {
      setIsLoading(false);
    }
  };

  const handleExportLogs = () => {
    if (!user?.isAdmin) {
      alert("You don't have permission to export logs");
      return;
    }
    
    try {
      const jsonData = exportLogsAsJson();
      const blob = new Blob([jsonData], { type: 'application/json' });
      const url = URL.createObjectURL(blob);
      
      const a = document.createElement('a');
      a.href = url;
      a.download = 'ipfs-access-logs.json';
      document.body.appendChild(a);
      a.click();
      document.body.removeChild(a);
      
      alert("Logs exported successfully!");
    } catch (error) {
      console.error("Export failed:", error);
      alert(`Export failed: ${error}`);
    }
  };

  const handleClearLogs = () => {
    if (!user?.isAdmin) {
      alert("You don't have permission to clear logs");
      return;
    }
    
    if (!confirm("Are you sure you want to clear all access logs? This action cannot be undone.")) return;
    
    try {
      clearLogs();
      loadAccessLogs();
      setIsViewingAllLogs(false);
      setIsViewingFileLogs(false);
      setIsViewingTimeline(false);
      alert("Logs cleared successfully!");
    } catch (error) {
      console.error("Clear logs failed:", error);
      alert(`Clear logs failed: ${error}`);
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

  return (
    <div className="flex flex-col items-center p-6 min-h-screen bg-gray-900 text-white">
      <div className="w-full max-w-lg flex justify-between items-center mb-6">
        <h1 className="text-4xl font-bold text-blue-400">IPFS File Storage</h1>
        <div className="flex flex-col items-end">
          <div className="mb-2 text-sm">
            <span className="text-gray-400">Logged in as: </span>
            <span className="text-white">{user.email}</span>
            {user.isAdmin && <span className="ml-2 bg-purple-600 px-2 py-1 rounded text-xs">Admin</span>}
          </div>
          <button 
            onClick={handleLogout}
            className="bg-red-600 px-3 py-1 rounded text-sm hover:bg-red-700"
          >
            Logout
          </button>
        </div>
      </div>

      {/* Admin Actions */}
      {user.isAdmin && (
        <div className="w-full max-w-lg flex flex-wrap justify-between mb-6 gap-2">
          <div className="flex space-x-2">
            <button 
              onClick={handleViewAllLogs} 
              className="bg-purple-600 px-4 py-2 rounded hover:bg-purple-700 transition"
              disabled={isLoading}
            >
              View All Logs
            </button>
            <button 
              onClick={handleViewTimeline} 
              className="bg-indigo-600 px-4 py-2 rounded hover:bg-indigo-700 transition"
              disabled={isLoading}
            >
              Activity Timeline
            </button>
          </div>
          <div className="flex space-x-2">
            <button 
              onClick={handleExportLogs} 
              className="bg-blue-600 px-4 py-2 rounded hover:bg-blue-700 transition"
              disabled={isLoading}
            >
              Export Logs
            </button>
            <button 
              onClick={handleClearLogs} 
              className="bg-red-600 px-4 py-2 rounded hover:bg-red-700 transition"
              disabled={isLoading}
            >
              Clear Logs
            </button>
          </div>
        </div>
      )}

      {/* Upload Section */}
      <div className="w-full max-w-lg bg-gray-800 p-6 rounded-lg shadow-lg">
        <h2 className="text-xl font-semibold mb-4 text-blue-300">Upload File</h2>
        <input 
          type="file" 
          onChange={handleFileChange} 
          className="w-full border border-gray-600 bg-gray-700 p-2 rounded mb-4"
          disabled={isLoading}
        />
        <button 
          onClick={handleUpload} 
          className={`w-full ${isLoading ? 'bg-gray-500' : 'bg-blue-500 hover:bg-blue-600'} text-white py-2 rounded transition`}
          disabled={isLoading || !file}
        >
          {isLoading ? 'Processing...' : 'Upload to IPFS'}
        </button>
      </div>

      {/* Search Bar */}
      <div className="w-full max-w-lg mt-6">
        <input
          type="text"
          placeholder="Search files..."
          value={searchTerm}
          onChange={handleSearchChange}
          className="w-full p-2 bg-gray-700 border border-gray-600 rounded"
        />
      </div>

      {/* Stored Files Section */}
      <div className="w-full max-w-lg bg-gray-800 p-6 mt-6 rounded-lg shadow-lg">
        <div className="flex justify-between items-center mb-4">
          <h2 className="text-xl font-semibold text-green-300">Stored Files</h2>
          <button 
            onClick={loadFiles} 
            className="bg-green-600 px-3 py-1 rounded text-sm"
            disabled={isLoading}
          >
            Refresh
          </button>
        </div>
        
        {isLoading ? (
          <div className="text-center py-4">
            <p className="text-gray-400">Loading...</p>
          </div>
        ) : filteredFiles.length === 0 ? (
          <p className="text-gray-400">
            {files.length === 0 ? "No files uploaded yet." : "No files match your search."}
          </p>
        ) : (
          <ul>
            {filteredFiles.map((file) => (
              <li key={file.cid} className="flex flex-col p-3 border border-gray-700 rounded mb-2 bg-gray-700">
                <div className="flex justify-between items-center">
                  <span className="text-gray-300">{file.name}</span>
                  <div className="flex space-x-2 text-xs text-gray-400">
                    {file.size && <span>{formatFileSize(file.size)}</span>}
                    {file.type && <span>{file.type}</span>}
                  </div>
                </div>
                <div className="text-xs text-gray-400 truncate mt-1">
                  CID: {file.cid}
                </div>
                <div className="flex mt-2 space-x-2">
                  <button 
                    onClick={() => handleView(file.name)} 
                    className="bg-yellow-500 px-3 py-1 rounded text-sm flex-1"
                    disabled={isLoading}
                  >
                    View
                  </button>
                  
                  {/* Only show these buttons for admin users */}
                  {user.isAdmin && (
                    <>
                      <button 
                        onClick={() => handleRetrieve(file.name)} 
                        className="bg-green-500 px-3 py-1 rounded text-sm flex-1"
                        disabled={isLoading}
                      >
                        Download
                      </button>
                      <button 
                        onClick={() => handleViewLogs(file.name, file.cid)} 
                        className="bg-blue-500 px-3 py-1 rounded text-sm flex-1"
                        disabled={isLoading}
                      >
                        Logs
                      </button>
                      <button 
                        onClick={() => handleDelete(file.name)} 
                        className="bg-red-500 px-3 py-1 rounded text-sm flex-1"
                        disabled={isLoading}
                      >
                        Delete
                      </button>
                    </>
                  )}
                </div>
              </li>
            ))}
          </ul>
        )}
      </div>
      
      {/* Activity Timeline Section - Only visible to admin */}
      {user.isAdmin && isViewingTimeline && (
        <div className="w-full mt-6">
          <div className="flex justify-between items-center mb-4">
            <h2 className="text-xl font-semibold text-indigo-300">Activity Timeline</h2>
            <button 
              onClick={() => setIsViewingTimeline(false)} 
              className="bg-gray-600 px-3 py-1 rounded"
            >
              Close
            </button>
          </div>
          <ActivityTimeline logs={accessLogs} />
        </div>
      )}

      {/* File-specific Access Logs Section - Only visible to admin */}
      {user.isAdmin && isViewingFileLogs && (
        <div className="w-full max-w-lg bg-gray-800 p-6 mt-6 rounded-lg shadow-lg">
          <div className="flex justify-between items-center mb-4">
            <h2 className="text-xl font-semibold text-purple-300">Access Logs for: {currentFileForLogs}</h2>
            <button 
              onClick={() => setIsViewingFileLogs(false)} 
              className="bg-gray-600 px-3 py-1 rounded"
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
        <div className="w-full max-w-lg bg-gray-800 p-6 mt-6 rounded-lg shadow-lg">
          <div className="flex justify-between items-center mb-4">
            <h2 className="text-xl font-semibold text-purple-300">All System Logs</h2>
            <button 
              onClick={() => setIsViewingAllLogs(false)} 
              className="bg-gray-600 px-3 py-1 rounded"
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
    </div>
  );
}