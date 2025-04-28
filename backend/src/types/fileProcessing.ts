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

export interface SecureCopyJob {
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
