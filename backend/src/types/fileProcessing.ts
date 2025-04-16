export interface FileProcessingJob {
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