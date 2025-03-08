// lib/ipfs.ts
import { create } from "ipfs-http-client";

// Initialize IPFS client
const client = create({
  host: "127.0.0.1",
  port: 5001,
  protocol: "http",
});

// Enhanced log structure with additional fields
interface AccessLog {
  fileName: string;
  timestamp: string;
  action: string;
  cid?: string;
  fileSize?: number;
  fileType?: string;
  status: "success" | "error";
  errorDetails?: string;
  userAgent?: string;
  mimeType?: string;
  userEmail?: string; // Added user email field
}

// In-memory storage for access logs
let accessLogs: AccessLog[] = [];

// Function to get file mime type based on file name
const getMimeType = (fileName: string): string => {
  const extension = fileName.split('.').pop()?.toLowerCase() || '';
  const mimeTypes: Record<string, string> = {
    'pdf': 'application/pdf',
    'doc': 'application/msword',
    'docx': 'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
    'xls': 'application/vnd.ms-excel',
    'xlsx': 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
    'ppt': 'application/vnd.ms-powerpoint',
    'pptx': 'application/vnd.openxmlformats-officedocument.presentationml.presentation',
    'jpg': 'image/jpeg',
    'jpeg': 'image/jpeg',
    'png': 'image/png',
    'gif': 'image/gif',
    'svg': 'image/svg+xml',
    'mp4': 'video/mp4',
    'mp3': 'audio/mpeg',
    'wav': 'audio/wav',
    'txt': 'text/plain',
    'html': 'text/html',
    'css': 'text/css',
    'js': 'application/javascript',
    'json': 'application/json',
    'xml': 'application/xml',
    'zip': 'application/zip',
    'rar': 'application/x-rar-compressed',
    'tar': 'application/x-tar',
    'gz': 'application/gzip',
  };
  
  return mimeTypes[extension] || 'application/octet-stream';
};

// Enhanced logging function with user tracking
const logAccess = (
  fileName: string, 
  action: string, 
  status: "success" | "error", 
  options: {
    cid?: string;
    fileSize?: number;
    fileType?: string;
    errorDetails?: string;
    mimeType?: string;
    userEmail?: string; // Added user email option
  } = {}
) => {
  // Get browser information
  const userAgent = typeof window !== 'undefined' ? window.navigator.userAgent : 'Server';
  
  const logEntry: AccessLog = {
    fileName,
    timestamp: new Date().toISOString(),
    action,
    status,
    userAgent,
    ...options
  };
  
  accessLogs.push(logEntry);
  
  // For debugging - log to console as well
  console.log(`[${logEntry.timestamp}] ${action.toUpperCase()} ${fileName} - ${status} - User: ${options.userEmail || 'Unknown'}`);
  
  return logEntry;
};

// Make sure directory exists
const ensureDirectory = async () => {
  try {
    await client.files.stat('/my-files');
  } catch (error) {
    await client.files.mkdir('/my-files', { parents: true });
  }
};

// Upload file to IPFS and store in MFS
export const uploadFile = async (file: File, userEmail?: string): Promise<string> => {
  try {
    await ensureDirectory();
    
    const buffer = await file.arrayBuffer();
    const fileSize = buffer.byteLength;
    const mimeType = getMimeType(file.name);
    
    const added = await client.add(buffer);
    const cid = added.cid.toString();
    
    await client.files.cp(`/ipfs/${cid}`, `/my-files/${file.name}`);

    // Log successful upload with user email
    logAccess(file.name, "uploaded", "success", {
      cid,
      fileSize,
      fileType: file.type || mimeType,
      mimeType,
      userEmail
    });
    
    return cid;
  } catch (error) {
    // Log failed upload with user email
    const errorMessage = error instanceof Error ? error.message : String(error);
    logAccess(file.name, "upload_attempt", "error", {
      errorDetails: errorMessage,
      userEmail
    });
    
    console.error("Error uploading file:", error);
    throw error;
  }
};

// List files in IPFS MFS
export const listFiles = async (userEmail?: string): Promise<{ name: string; cid: string; size?: number; type?: string }[]> => {
  try {
    await ensureDirectory();
    
    const files = [];
    for await (const file of client.files.ls("/my-files")) {
      try {
        const stat = await client.files.stat(`/my-files/${file.name}`);
        const fileSize = stat.size;
        const mimeType = getMimeType(file.name);
        
        files.push({ 
          name: file.name, 
          cid: file.cid.toString(),
          size: fileSize,
          type: mimeType
        });
      } catch (e) {
        files.push({ name: file.name, cid: file.cid.toString() });
      }
    }
    
    // Log successful listing with user email
    logAccess("directory", "list_files", "success", {
      fileSize: files.length,
      userEmail
    });
    
    return files;
  } catch (error) {
    // Log failed listing with user email
    const errorMessage = error instanceof Error ? error.message : String(error);
    logAccess("directory", "list_files", "error", {
      errorDetails: errorMessage,
      userEmail
    });
    
    console.error("Error listing files:", error);
    throw error;
  }
};

// Get CID and stats for a specific file
export const getFileStats = async (fileName: string): Promise<{ cid: string; size: number; type: string } | null> => {
  try {
    const stat = await client.files.stat(`/my-files/${fileName}`);
    const mimeType = getMimeType(fileName);
    
    return {
      cid: stat.cid.toString(),
      size: stat.size,
      type: mimeType
    };
  } catch (error) {
    console.error("Error getting file stats:", error);
    return null;
  }
};

// Retrieve file content for download
export const getFileContent = async (fileName: string, userEmail?: string): Promise<Blob | null> => {
  try {
    const stats = await getFileStats(fileName);
    if (!stats) {
      throw new Error("Could not get file stats");
    }
    
    const chunks: Uint8Array[] = [];
    for await (const chunk of client.files.read(`/my-files/${fileName}`)) {
      chunks.push(chunk);
    }

    if (chunks.length === 0) {
      throw new Error("File content is empty");
    }

    // Combine all chunks into a single Uint8Array
    let totalLength = 0;
    for (const chunk of chunks) {
      totalLength += chunk.length;
    }
    
    const combinedChunks = new Uint8Array(totalLength);
    let offset = 0;
    for (const chunk of chunks) {
      combinedChunks.set(chunk, offset);
      offset += chunk.length;
    }
    
    // Log successful retrieval with user email
    logAccess(fileName, "retrieved", "success", {
      cid: stats.cid,
      fileSize: stats.size,
      fileType: stats.type,
      mimeType: stats.type,
      userEmail
    });
    
    return new Blob([combinedChunks], { type: stats.type });
  } catch (error) {
    // Log failed retrieval with user email
    const errorMessage = error instanceof Error ? error.message : String(error);
    logAccess(fileName, "retrieve_attempt", "error", {
      errorDetails: errorMessage,
      userEmail
    });
    
    console.error("Error retrieving file:", error);
    return null;
  }
};

// View file (generate URL for preview)
export const viewFile = async (fileName: string, userEmail?: string): Promise<string | null> => {
  try {
    const stats = await getFileStats(fileName);
    if (!stats) {
      throw new Error("Could not get file stats");
    }
    
    const blob = await getFileContent(fileName, userEmail);
    if (!blob) {
      throw new Error("Could not get file content");
    }

    const url = URL.createObjectURL(blob);
    
    // Log successful view with user email
    // Note: We log view explicitly even though getFileContent already logs retrieval
    logAccess(fileName, "viewed", "success", {
      cid: stats.cid,
      fileSize: stats.size,
      fileType: stats.type,
      mimeType: stats.type,
      userEmail
    });
    
    return url;
  } catch (error) {
    // Log failed view with user email
    const errorMessage = error instanceof Error ? error.message : String(error);
    logAccess(fileName, "view_attempt", "error", {
      errorDetails: errorMessage,
      userEmail
    });
    
    console.error("Error viewing file:", error);
    return null;
  }
};

// Delete file from IPFS MFS
export const deleteFile = async (fileName: string, userEmail?: string): Promise<void> => {
  try {
    const stats = await getFileStats(fileName);
    
    await client.files.rm(`/my-files/${fileName}`);
    
    // Log successful deletion with user email
    logAccess(fileName, "deleted", "success", {
      cid: stats?.cid,
      fileSize: stats?.size,
      fileType: stats?.type,
      userEmail
    });
  } catch (error) {
    // Log failed deletion with user email
    const errorMessage = error instanceof Error ? error.message : String(error);
    logAccess(fileName, "delete_attempt", "error", {
      errorDetails: errorMessage,
      userEmail
    });
    
    console.error("Error deleting file:", error);
    throw error;
  }
};

// Function to get all access logs
export const getAccessLogs = async (): Promise<AccessLog[]> => {
  return accessLogs;
};

// Function to get access logs for a specific file
export const getFileAccessLogs = async (fileName: string): Promise<AccessLog[]> => {
  return accessLogs.filter(log => log.fileName === fileName);
};

// Function to export logs as JSON
export const exportLogsAsJson = (): string => {
  return JSON.stringify(accessLogs, null, 2);
};

// Function to clear logs
export const clearLogs = (): void => {
  accessLogs = [];
};
