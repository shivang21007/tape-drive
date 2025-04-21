export type JobType = 'upload' | 'download';

export interface BaseJob {
  type: JobType;
  requestedAt: number;
}

export interface UploadJob extends BaseJob {
  type: 'upload';
  fileId: number;
  fileName: string;
  fileSize: string;
  userName: string;
  userEmail: string;
  groupName: string;
  isAdmin: boolean;
  filePath: string;
}

export interface DownloadJob extends BaseJob {
  type: 'download';
  requestId: number;
  fileId: number;
  fileName: string;
  userName: string;
  userEmail: string;
  groupName: string;
  tapeLocation: string;
  tapeNumber: string;
}

export type ProcessingJob = UploadJob | DownloadJob; 