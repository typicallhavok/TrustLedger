// lib/ipfs.ts
import { create } from "ipfs-http-client";

// Initialize IPFS client
const client = create({url: 'http://localhost:5002/api/v0'});

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
  userEmail?: string;
  isEncrypted?: boolean;
  encryptionAlgorithm?: string;
}

// Interface for encrypted file metadata
interface EncryptedFileMetadata {
  originalName: string;
  originalSize: number;
  mimeType: string;
  encryptionAlgorithm: string;
  iv: string;
  salt: string;
  timestamp: string;
  userEmail?: string;
  caseId?: string | null;
}

// Interface for file access permissions
interface FilePermissions {
  fileName: string;
  cid: string;
  allowedUsers: string[];
  createdBy: string;
  timestamp: string;
  isPublic: boolean;
}

// In-memory storage for access logs
let accessLogs: AccessLog[] = [];

// In-memory storage for file permissions
let filePermissions: FilePermissions[] = [];

// Encryption utilities
class EncryptionService {
  // Generate a key from password using PBKDF2
  static async deriveKey(password: string, salt: Uint8Array): Promise<CryptoKey> {
    const encoder = new TextEncoder();
    const passwordBuffer = encoder.encode(password);
    
    const baseKey = await crypto.subtle.importKey(
      'raw',
      passwordBuffer,
      'PBKDF2',
      false,
      ['deriveKey']
    );

    return crypto.subtle.deriveKey(
      {
        name: 'PBKDF2',
        salt: salt,
        iterations: 100000,
        hash: 'SHA-256'
      },
      baseKey,
      { name: 'AES-GCM', length: 256 },
      false,
      ['encrypt', 'decrypt']
    );
  }

  // Generate random salt
  static generateSalt(): Uint8Array {
    return crypto.getRandomValues(new Uint8Array(16));
  }

  // Generate random IV
  static generateIV(): Uint8Array {
    return crypto.getRandomValues(new Uint8Array(12));
  }

  // Encrypt file data
  static async encryptFile(
    fileData: ArrayBuffer, 
    password: string
  ): Promise<{
    encryptedData: ArrayBuffer;
    salt: Uint8Array;
    iv: Uint8Array;
  }> {
    const salt = this.generateSalt();
    const iv = this.generateIV();
    const key = await this.deriveKey(password, salt);

    const encryptedData = await crypto.subtle.encrypt(
      { name: 'AES-GCM', iv: iv },
      key,
      fileData
    );

    return { encryptedData, salt, iv };
  }

  // Decrypt file data
  static async decryptFile(
    encryptedData: ArrayBuffer,
    password: string,
    salt: Uint8Array,
    iv: Uint8Array
  ): Promise<ArrayBuffer> {
    const key = await this.deriveKey(password, salt);

    try {
      const decryptedData = await crypto.subtle.decrypt(
        { name: 'AES-GCM', iv: iv },
        key,
        encryptedData
      );
      return decryptedData;
    } catch (error) {
      throw new Error('Invalid password or corrupted data');
    }
  }

  // Create encrypted file package
  static async createEncryptedPackage(
    file: File,
    password: string,
    userEmail?: string,
    caseId?: string | null
  ): Promise<{
    encryptedBuffer: ArrayBuffer;
    metadata: EncryptedFileMetadata;
  }> {
    const fileBuffer = await file.arrayBuffer();
    const { encryptedData, salt, iv } = await this.encryptFile(fileBuffer, password);

    const metadata: EncryptedFileMetadata = {
      originalName: file.name,
      originalSize: file.size,
      mimeType: file.type || getMimeType(file.name),
      encryptionAlgorithm: 'AES-GCM-256',
      iv: Array.from(iv).join(','),
      salt: Array.from(salt).join(','),
      timestamp: new Date().toISOString(),
      userEmail,
      caseId
    };

    // Combine metadata and encrypted data
    const metadataString = JSON.stringify(metadata);
    const metadataBuffer = new TextEncoder().encode(metadataString);
    const metadataLength = new Uint32Array([metadataBuffer.length]);

    // Create final package: [metadata_length][metadata][encrypted_data]
    const packageBuffer = new ArrayBuffer(
      4 + metadataBuffer.length + encryptedData.byteLength
    );
    
    const packageView = new Uint8Array(packageBuffer);
    packageView.set(new Uint8Array(metadataLength.buffer), 0);
    packageView.set(metadataBuffer, 4);
    packageView.set(new Uint8Array(encryptedData), 4 + metadataBuffer.length);

    return { encryptedBuffer: packageBuffer, metadata };
  }

  // Extract and decrypt file package
  static async extractEncryptedPackage(
    packageBuffer: ArrayBuffer,
    password: string
  ): Promise<{
    fileData: ArrayBuffer;
    metadata: EncryptedFileMetadata;
  }> {
    const packageView = new Uint8Array(packageBuffer);
    
    // Extract metadata length
    const metadataLength = new Uint32Array(packageBuffer.slice(0, 4))[0];
    
    // Extract metadata
    const metadataBuffer = packageBuffer.slice(4, 4 + metadataLength);
    const metadataString = new TextDecoder().decode(metadataBuffer);
    const metadata: EncryptedFileMetadata = JSON.parse(metadataString);

    // Extract encrypted data
    const encryptedData = packageBuffer.slice(4 + metadataLength);

    // Convert string arrays back to Uint8Array
    const iv = new Uint8Array(metadata.iv.split(',').map(n => parseInt(n)));
    const salt = new Uint8Array(metadata.salt.split(',').map(n => parseInt(n)));

    // Decrypt the file data
    const fileData = await this.decryptFile(encryptedData, password, salt, iv);

    return { fileData, metadata };
  }
}

// Permission management
class PermissionManager {
  static addFilePermission(
    fileName: string,
    cid: string,
    createdBy: string,
    allowedUsers: string[] = [],
    isPublic: boolean = false
  ): void {
    const permission: FilePermissions = {
      fileName,
      cid,
      allowedUsers: [...new Set([createdBy, ...allowedUsers])], // Ensure creator is always included
      createdBy,
      timestamp: new Date().toISOString(),
      isPublic
    };

    // Remove existing permission for this file
    filePermissions = filePermissions.filter(p => p.fileName !== fileName);
    filePermissions.push(permission);
  }

  static checkFileAccess(fileName: string, userEmail: string): boolean {
    const permission = filePermissions.find(p => p.fileName === fileName);
    if (!permission) return true; // If no permission set, allow access (backward compatibility)
    
    return permission.isPublic || 
           permission.allowedUsers.includes(userEmail) ||
           permission.createdBy === userEmail;
  }

  static getFilePermissions(fileName: string): FilePermissions | null {
    return filePermissions.find(p => p.fileName === fileName) || null;
  }

  static updateFilePermissions(
    fileName: string,
    allowedUsers: string[],
    isPublic: boolean,
    updatedBy: string
  ): boolean {
    const permissionIndex = filePermissions.findIndex(p => p.fileName === fileName);
    if (permissionIndex === -1) return false;

    const permission = filePermissions[permissionIndex];
    
    // Only creator can update permissions
    if (permission.createdBy !== updatedBy) return false;

    permission.allowedUsers = [...new Set([permission.createdBy, ...allowedUsers])];
    permission.isPublic = isPublic;

    return true;
  }

  static getAllPermissions(): FilePermissions[] {
    return [...filePermissions];
  }
}

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

// Enhanced logging function with encryption tracking
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
    userEmail?: string;
    isEncrypted?: boolean;
    encryptionAlgorithm?: string;
  } = {}
) => {
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

  const encryptionStatus = options.isEncrypted ? '[ENCRYPTED]' : '[UNENCRYPTED]';
  console.log(`[${logEntry.timestamp}] ${action.toUpperCase()} ${fileName} ${encryptionStatus} - ${status} - User: ${options.userEmail || 'Unknown'}`);

  return logEntry;
};

// Enhanced blockchain evidence function
interface EvidenceDetails {
  location: string;
  gps: string;
  timestamp: string;
  retriever: string;
  handler: string;
  device_type: string;
  status: string;
  isEncrypted?: boolean;
  encryptionAlgorithm?: string;
}

export const addBlockchainEvidence = async (
  fileData: File, 
  userEmail: string | undefined, 
  cid: string, 
  evidenceDetails: EvidenceDetails
) => {
  try {
    const response = await fetch('http://127.0.0.1:3000/evidence', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        timestamp: evidenceDetails.timestamp || new Date().toISOString(),
        id: cid,
        hash: cid,
        retriever: evidenceDetails.retriever || userEmail,
        handler: evidenceDetails.handler || userEmail,
        location: evidenceDetails.location || "Digital Storage",
        device_type: evidenceDetails.device_type || "IPFS",
        status: evidenceDetails.status || "Stored",
        isEncrypted: evidenceDetails.isEncrypted || false,
        encryptionAlgorithm: evidenceDetails.encryptionAlgorithm
      }),
    });

    if (!response.ok) {
      throw new Error(`Blockchain API error: ${response.status}`);
    }

    return await response.json();
  } catch (error) {
    console.error("Error adding blockchain evidence:", error);
    throw error;
  }
};

// Directory creation with permission support
export const createDirectory = async (dirPath: string, userEmail?: string): Promise<void> => {
  try {
    const normalizedPath = dirPath.startsWith('/') ? dirPath : `/${dirPath}`;
    await client.files.mkdir(normalizedPath, { parents: true });

    logAccess(dirPath, "directory_created", "success", { userEmail });
  } catch (error) {
    const errorMessage = error instanceof Error ? error.message : String(error);
    logAccess(dirPath, "directory_create_attempt", "error", {
      errorDetails: errorMessage,
      userEmail
    });

    console.error("Error creating directory:", error);
    throw error;
  }
};

// Ensure directory exists
const ensureDirectory = async () => {
  try {
    await client.files.stat('/my-files');
  } catch (error) {
    await client.files.mkdir('/my-files', { parents: true });
  }
};

// Enhanced upload function with encryption support
export const uploadFile = async (
  file: File, 
  userEmail?: string, 
  caseId?: string | null,
  encryptionOptions?: {
    password: string;
    allowedUsers?: string[];
    isPublic?: boolean;
  }
): Promise<string> => {
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

    let uploadBuffer: ArrayBuffer;
    let finalFileName: string;
    let isEncrypted = false;
    let encryptionAlgorithm: string | undefined;

    if (encryptionOptions?.password) {
      // Encrypt the file
      const { encryptedBuffer } = await EncryptionService.createEncryptedPackage(
        file,
        encryptionOptions.password,
        userEmail,
        caseId
      );
      
      uploadBuffer = encryptedBuffer;
      finalFileName = `${file.name}.encrypted`;
      isEncrypted = true;
      encryptionAlgorithm = 'AES-GCM-256';

      // Set up permissions
      PermissionManager.addFilePermission(
        finalFileName,
        '', // CID will be updated after upload
        userEmail || 'anonymous',
        encryptionOptions.allowedUsers || [],
        encryptionOptions.isPublic || false
      );
    } else {
      // Upload unencrypted
      uploadBuffer = await file.arrayBuffer();
      finalFileName = file.name;
    }

    const uploadPath = caseId ? `/my-files/${caseId}/${finalFileName}` : `/my-files/${finalFileName}`;
    const fileSize = uploadBuffer.byteLength;
    const mimeType = getMimeType(file.name);

    const added = await client.add(uploadBuffer);
    const cid = added.cid.toString();

    await client.files.cp(`/ipfs/${cid}`, uploadPath);

    // Update CID in permissions if encrypted
    if (isEncrypted) {
      const permission = PermissionManager.getFilePermissions(finalFileName);
      if (permission) {
        permission.cid = cid;
      }
    }

    // Log successful upload
    logAccess(finalFileName, "uploaded", "success", {
      cid,
      fileSize,
      fileType: file.type || mimeType,
      mimeType,
      userEmail,
      isEncrypted,
      encryptionAlgorithm
    });

    return cid;
  } catch (error) {
    const errorMessage = error instanceof Error ? error.message : String(error);
    logAccess(file.name, "upload_attempt", "error", {
      errorDetails: errorMessage,
      userEmail,
      isEncrypted: !!encryptionOptions?.password
    });

    console.error("Error uploading file:", error);
    throw error;
  }
};

// Enhanced local storage function
export async function storeFileLocally(file: File): Promise<void> {
  return new Promise((resolve, reject) => {
    try {
      const reader = new FileReader();

      reader.onload = function(event) {
        if (!event.target?.result) {
          reject(new Error("Failed to read file"));
          return;
        }

        const fileData = event.target.result;
        const key = `evidence_${Date.now()}_${file.name}`;

        try {
          localStorage.setItem(key, fileData.toString());

          const evidenceIndex = JSON.parse(localStorage.getItem('evidenceIndex') || '[]');
          evidenceIndex.push({
            key,
            name: file.name,
            type: file.type,
            size: file.size,
            date: new Date().toISOString()
          });
          localStorage.setItem('evidenceIndex', JSON.stringify(evidenceIndex));

          console.log(`File ${file.name} stored locally with key ${key}`);
          resolve();
        } catch (e) {
          console.error("Error storing in localStorage:", e);
          reject(new Error(`File too large to store locally: ${file.name}`));
        }
      };

      reader.onerror = function() {
        reject(new Error("Error reading file"));
      };

      reader.readAsDataURL(file);
    } catch (error) {
      reject(error);
    }
  });
}

// Enhanced list files with permission checking
export const listFiles = async (
  caseId?: string | null, 
  userEmail?: string
): Promise<{ name: string; cid: string; size?: number; type?: string; isEncrypted?: boolean; hasAccess?: boolean }[]> => {
  try {
    await ensureDirectory();

    const listPath = caseId ? `/my-files/${caseId}` : `/my-files`;
    const files = [];

    // Create directory if it doesn't exist
    try {
      await client.files.stat(listPath);
    } catch (error) {
      if (caseId) {
        await client.files.mkdir(listPath, { parents: true });
        logAccess(listPath, "directory_created", "success", { userEmail });
      }
    }

    // List files
    for await (const file of client.files.ls(listPath)) {
      if (caseId && file.type === 'directory') {
        continue;
      }

      try {
        const stat = await client.files.stat(`${listPath}/${file.name}`);

        if (stat.type === 'file' || (!caseId && stat.type === 'directory')) {
          const fileSize = stat.size;
          const isEncrypted = file.name.endsWith('.encrypted');
          const originalName = isEncrypted ? file.name.replace('.encrypted', '') : file.name;
          const mimeType = getMimeType(originalName);

          // Check access permissions
          const hasAccess = userEmail ? PermissionManager.checkFileAccess(file.name, userEmail) : true;

          files.push({
            name: file.name,
            cid: file.cid.toString(),
            size: fileSize,
            type: mimeType,
            isEncrypted,
            hasAccess
          });
        }
      } catch (e) {
        const isEncrypted = file.name.endsWith('.encrypted');
        const hasAccess = userEmail ? PermissionManager.checkFileAccess(file.name, userEmail) : true;
        
        files.push({ 
          name: file.name, 
          cid: file.cid.toString(),
          isEncrypted,
          hasAccess
        });
      }
    }

    logAccess(listPath, "list_files", "success", {
      fileSize: files.length,
      userEmail
    });

    return files;
  } catch (error) {
    const listPath = caseId ? `/my-files/${caseId}` : `/my-files`;
    const errorMessage = error instanceof Error ? error.message : String(error);
    logAccess(listPath, "list_files", "error", {
      errorDetails: errorMessage,
      userEmail
    });

    console.error("Error listing files:", error);
    throw error;
  }
};

// Enhanced file stats function
export const getFileStats = async (
  fileName: string, 
  caseId?: string | null
): Promise<{ cid: string; size: number; type: string; isEncrypted: boolean } | null> => {
  try {
    const filePath = caseId ? `/my-files/${caseId}/${fileName}` : `/my-files/${fileName}`;
    const stat = await client.files.stat(filePath);
    const isEncrypted = fileName.endsWith('.encrypted');
    const originalName = isEncrypted ? fileName.replace('.encrypted', '') : fileName;
    const mimeType = getMimeType(originalName);

    return {
      cid: stat.cid.toString(),
      size: stat.size,
      type: mimeType,
      isEncrypted
    };
  } catch (error) {
    console.error("Error getting file stats:", error);
    return null;
  }
};

// Enhanced file content retrieval with decryption
export const getFileContent = async (
  fileName: string, 
  userEmail?: string, 
  caseId?: string | null,
  decryptionPassword?: string
): Promise<{ blob: Blob; metadata?: EncryptedFileMetadata } | null> => {
  try {
    // Check permissions
    if (userEmail && !PermissionManager.checkFileAccess(fileName, userEmail)) {
      throw new Error('Access denied: You do not have permission to access this file');
    }

    const filePath = caseId ? `/my-files/${caseId}/${fileName}` : `/my-files/${fileName}`;
    const stat = await client.files.stat(filePath);
    const isEncrypted = fileName.endsWith('.encrypted');

    const chunks: Uint8Array[] = [];
    for await (const chunk of client.files.read(filePath)) {
      chunks.push(chunk);
    }

    if (chunks.length === 0) {
      throw new Error("File content is empty");
    }

    // Combine chunks
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

    let finalBlob: Blob;
    let metadata: EncryptedFileMetadata | undefined;

    if (isEncrypted) {
      if (!decryptionPassword) {
        throw new Error('Password required for encrypted file');
      }

      try {
        const { fileData, metadata: fileMetadata } = await EncryptionService.extractEncryptedPackage(
          combinedChunks.buffer,
          decryptionPassword
        );

        finalBlob = new Blob([fileData], { type: fileMetadata.mimeType });
        metadata = fileMetadata;
      } catch (error) {
        throw new Error('Failed to decrypt file: Invalid password or corrupted data');
      }
    } else {
      const originalName = fileName;
      const mimeType = getMimeType(originalName);
      finalBlob = new Blob([combinedChunks], { type: mimeType });
    }

    // Log successful retrieval
    logAccess(fileName, "retrieved", "success", {
      cid: stat.cid.toString(),
      fileSize: stat.size,
      fileType: metadata?.mimeType || getMimeType(fileName),
      mimeType: metadata?.mimeType || getMimeType(fileName),
      userEmail,
      isEncrypted,
      encryptionAlgorithm: metadata?.encryptionAlgorithm
    });

    return { blob: finalBlob, metadata };
  } catch (error) {
    const errorMessage = error instanceof Error ? error.message : String(error);
    logAccess(fileName, "retrieve_attempt", "error", {
      errorDetails: errorMessage,
      userEmail,
      isEncrypted: fileName.endsWith('.encrypted')
    });

    console.error("Error retrieving file:", error);
    throw error;
  }
};

// Enhanced view file function
export const viewFile = async (
  fileName: string, 
  userEmail?: string, 
  caseId?: string | null,
  decryptionPassword?: string
): Promise<string | null> => {
  try {
    const result = await getFileContent(fileName, userEmail, caseId, decryptionPassword);
    if (!result) {
      throw new Error("Could not get file content");
    }

    const url = URL.createObjectURL(result.blob);

    // Log successful view
    const filePath = caseId ? `/my-files/${caseId}/${fileName}` : `/my-files/${fileName}`;
    const stat = await client.files.stat(filePath);

    logAccess(fileName, "viewed", "success", {
      cid: stat.cid.toString(),
      fileSize: stat.size,
      fileType: result.metadata?.mimeType || getMimeType(fileName),
      mimeType: result.metadata?.mimeType || getMimeType(fileName),
      userEmail,
      isEncrypted: !!result.metadata,
      encryptionAlgorithm: result.metadata?.encryptionAlgorithm
    });

    return url;
  } catch (error) {
    const errorMessage = error instanceof Error ? error.message : String(error);
    logAccess(fileName, "view_attempt", "error", {
      errorDetails: errorMessage,
      userEmail,
      isEncrypted: fileName.endsWith('.encrypted')
    });

    console.error("Error viewing file:", error);
    throw error;
  }
};

// Permission management functions
export const updateFilePermissions = async (
  fileName: string,
  allowedUsers: string[],
  isPublic: boolean,
  updatedBy: string
): Promise<boolean> => {
  try {
    const success = PermissionManager.updateFilePermissions(fileName, allowedUsers, isPublic, updatedBy);
    
    logAccess(fileName, "permissions_updated", success ? "success" : "error", {
      userEmail: updatedBy,
      errorDetails: success ? undefined : "Permission denied or file not found"
    });

    return success;
  } catch (error) {
    const errorMessage = error instanceof Error ? error.message : String(error);
    logAccess(fileName, "permissions_update_attempt", "error", {
      errorDetails: errorMessage,
      userEmail: updatedBy
    });
    
    return false;
  }
};

export const getFilePermissions = (fileName: string): FilePermissions | null => {
  return PermissionManager.getFilePermissions(fileName);
};

export const getAllFilePermissions = (): FilePermissions[] => {
  return PermissionManager.getAllPermissions();
};

// Existing functions (unchanged)
export const getAccessLogs = async (): Promise<AccessLog[]> => {
  return accessLogs;
};

export const getFileAccessLogs = async (fileName: string): Promise<AccessLog[]> => {
  return accessLogs.filter(log => log.fileName === fileName);
};

export const exportLogsAsJson = (): string => {
  return JSON.stringify(accessLogs, null, 2);
};

export const clearLogs = (): void => {
  accessLogs = [];
};

// Export encryption service for direct use if needed
export { EncryptionService, PermissionManager };