export interface FileProcessingJob {
  type: string;
  fileId: number;
  fileName: string;
  fileSize: string;
  userName: string;
  userEmail: string;
  groupName: string;
  isAdmin: boolean;
  filePath: string;
  requestedAt: number;
}

export interface SecureCopyUploadJob {
  type: string;
  fileId: number;
  fileName: string;
  userName: string;
  userEmail: string;
  groupName: string;
  filePath: string;
  server: string;
  isAdmin: boolean;
  requestedAt: number;
}

export interface SecureCopyDownloadJob {
  type: string;
  downloadRequestId: number;
  fileId: number;
  fileName: string;
  userName: string;
  userEmail: string;
  groupName: string;
  filePath: string;
  server: string;
  isAdmin: boolean;
  requestedAt: number;
}
