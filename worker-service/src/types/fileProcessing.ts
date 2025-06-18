export interface FileProcessingJob {
  type: 'upload' | 'download';
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
  type: 'upload';
  fileId: number;
  fileName: string;
  userName: string;
  userEmail: string;
  groupName: string;
  filePath: string;
  server: string;
  sshUser: string;
  isAdmin: boolean;
  requestedAt: number;
} 

export interface SecureCopyDownloadJob {
  type: 'download';
  downloadRequestId: number;
  fileId: number;
  fileName: string;
  userName: string;
  userEmail: string;
  groupName: string;
  filePath: string;
  server: string;
  sshUser: string;
  isAdmin: boolean;
  requestedAt: number;
}