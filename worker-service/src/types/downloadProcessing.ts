export interface DownloadProcessingJob {
  type: 'download';
  requestId: number;
  fileId: number;
  fileName: string;
  userName: string;
  userEmail: string;
  groupName: string;
  tapeLocation: string;
  tapeNumber: string;
  requestedAt: number;
} 