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

// Add this function to ipfs.ts
export const createDirectory = async (dirPath: string, userEmail?: string): Promise<void> => {
  try {
    // Make sure the path starts with a slash
    const normalizedPath = dirPath.startsWith('/') ? dirPath : `/${dirPath}`;
    
    // Create directory with parents option to create any missing parent directories
    await client.files.mkdir(normalizedPath, { parents: true });
    
    // Log successful directory creation
    logAccess(dirPath, "directory_created", "success", {
      userEmail
    });
  } catch (error) {
    // Log failed directory creation
    const errorMessage = error instanceof Error ? error.message : String(error);
    logAccess(dirPath, "directory_create_attempt", "error", {
      errorDetails: errorMessage,
      userEmail
    });
    
    console.error("Error creating directory:", error);
    throw error;
  }
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
export const uploadFile = async (file: File, userEmail?: string, caseId?: string | null): Promise<string> => {
  try {
    await ensureDirectory();

    // Create case directory if needed
    if (caseId) {
      try {
        await client.files.stat(`/my-files/${caseId}`);
      } catch (error) {
        await client.files.mkdir(`/my-files/${caseId}`, { parents: true });
      }
    }

    // Define the correct path
    const uploadPath = caseId ? `/my-files/${caseId}/${file.name}` : `/my-files/${file.name}`;
    
    const buffer = await file.arrayBuffer();
    const fileSize = buffer.byteLength;
    const mimeType = getMimeType(file.name);
    
    const added = await client.add(buffer);
    const cid = added.cid.toString();
    
    // Use the correct path here
    await client.files.cp(`/ipfs/${cid}`, uploadPath);

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
export const listFiles = async (caseId?: string | null, userEmail?: string): Promise<{ name: string; cid: string; size?: number; type?: string }[]> => {
  try {
    await ensureDirectory();
    
    // Define the path based on caseId
    const listPath = caseId ? `/my-files/${caseId}` : `/my-files`;
    
    const files = [];
    
    // Create the directory if it doesn't exist (especially for case directories)
    try {
      await client.files.stat(listPath);
    } catch (error) {
      if (caseId) {
        await client.files.mkdir(listPath, { parents: true });
        
        // Log directory creation
        logAccess(listPath, "directory_created", "success", { userEmail });
      }
    }
    
    // List only files in the specified path
    for await (const file of client.files.ls(listPath)) {
      // Skip subdirectories if we're viewing a case folder
      if (caseId && file.type === 'directory') {
        continue;
      }
      
      try {
        const stat = await client.files.stat(`${listPath}/${file.name}`);
        
        // Only add if it's a file or if we're at the root without a caseId
        if (stat.type === 'file' || (!caseId && stat.type === 'directory')) {
          const fileSize = stat.size;
          const mimeType = getMimeType(file.name);
          
          files.push({ 
            name: file.name, 
            cid: file.cid.toString(),
            size: fileSize,
            type: mimeType
          });
        }
      } catch (e) {
        files.push({ name: file.name, cid: file.cid.toString() });
      }
    }
    
    // Log successful listing with user email
    logAccess(listPath, "list_files", "success", {
      fileSize: files.length,
      userEmail
    });
    
    return files;
  } catch (error) {
    // Define the path for error logging
    const listPath = caseId ? `/my-files/${caseId}` : `/my-files`;
    
    // Log failed listing with user email
    const errorMessage = error instanceof Error ? error.message : String(error);
    logAccess(listPath, "list_files", "error", {
      errorDetails: errorMessage,
      userEmail
    });
    
    console.error("Error listing files:", error);
    throw error;
  }
};

// Get CID and stats for a specific file
export const getFileStats = async (fileName: string, caseId?: string | null): Promise<{ cid: string; size: number; type: string } | null> => {
  try {
    const filePath = caseId ? `/my-files/${caseId}/${fileName}` : `/my-files/${fileName}`;
    const stat = await client.files.stat(filePath);
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
export const getFileContent = async (fileName: string, userEmail?: string, caseId?: string | null): Promise<Blob | null> => {
  try {
    const filePath = caseId ? `/my-files/${caseId}/${fileName}` : `/my-files/${fileName}`;
    
    // Get file stats
    const stat = await client.files.stat(filePath);
    const mimeType = getMimeType(fileName);
    
    const stats = {
      cid: stat.cid.toString(),
      size: stat.size,
      type: mimeType
    };
    
    const chunks: Uint8Array[] = [];
    for await (const chunk of client.files.read(filePath)) {
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

export const viewFile = async (fileName: string, userEmail?: string, caseId?: string | null): Promise<string | null> => {
  try {
    const blob = await getFileContent(fileName, userEmail, caseId);
    if (!blob) {
      throw new Error("Could not get file content");
    }

    // Get file stats for logging
    const filePath = caseId ? `/my-files/${caseId}/${fileName}` : `/my-files/${fileName}`;
    const stat = await client.files.stat(filePath);
    const mimeType = getMimeType(fileName);
    
    const stats = {
      cid: stat.cid.toString(),
      size: stat.size,
      type: mimeType
    };

    const url = URL.createObjectURL(blob);
    
    // Log successful view with user email
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