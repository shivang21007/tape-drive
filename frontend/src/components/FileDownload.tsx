import React, { useState, useEffect } from 'react';
import { Button } from './ui/Button';
import axios from 'axios';
import { downloadFile, isFileTypeSupported } from '../utils/downloadUtils';

interface FileDownloadProps {
  fileId: number;
  fileName: string;
}

interface DownloadStatus {
  status: 'none' | 'processing' | 'completed' | 'failed';
  requestId?: number;
  message: string;
}

export const FileDownload: React.FC<FileDownloadProps> = ({ 
  fileId, 
  fileName
}) => {
  const [isDownloading, setIsDownloading] = useState(false);
  const [downloadStatus, setDownloadStatus] = useState<DownloadStatus>({ 
    status: 'none',
    message: ''
  });

  // Check download request status
  useEffect(() => {
    const checkDownloadStatus = async () => {
      try {
        const response = await axios.get(`/api/download-requests/status?fileId=${fileId}`);
        const data = response.data;
        setDownloadStatus(data);
      } catch (error) {
        console.error('Error checking download status:', error);
        setDownloadStatus({
          status: 'none',
          message: 'Error checking download status'
        });
      }
    };

    checkDownloadStatus();
  }, [fileId]);

  const handleDownload = async () => {
    if (!isFileTypeSupported(fileName)) {
      alert('File type not supported');
      return;
    }

    setIsDownloading(true);
    // const loadingToast = toast.loading('Checking file availability...');

    try {
      // First check if file is in cache
      const response = await axios.get(`/api/files/${fileId}/download`);
      const data = response.data;

      if (data.status === 'completed' && data.servedFrom === 'cache') {
        // File is in cache, download it
        const fileResponse = await axios.get(`/api/files/${fileId}/download?download=true`, {
          responseType: 'blob'
        });
        
        setIsDownloading(false);
        alert('File found in cache!');
        // toast.dismiss(loadingToast);
        // toast.success('File found in cache!');
        downloadFile(fileResponse.data, fileName);
      } else if (data.status === 'processing') {
        setIsDownloading(false);
        setDownloadStatus({
          status: 'processing',
          requestId: data.requestId,
          message: data.message
        });
        alert(data.message);
        // toast.dismiss(loadingToast);
        // toast.success(data.message);
      } else {
        throw new Error('Unexpected response from server');
      }
    } catch (error) {
      setIsDownloading(false);
      // toast.dismiss(loadingToast);
      
      if (axios.isAxiosError(error)) {
        if (error.response?.status === 404) {
          alert('File not found');
        } else if (error.response?.status === 403) {
          alert('Access denied');
        } else if (error.response?.status === 500) {
          alert('Server error. Please try again later.');
        } else {
          alert('Failed to initiate download');
        }
      } else {
        alert('Failed to initiate download');
      }
    }
  };

  const isButtonDisabled = isDownloading || 
    downloadStatus.status === 'processing';

  const getButtonText = () => {
    if (isDownloading) return 'Checking...';
    if (downloadStatus.status === 'processing') {
      return 'requested';
    }
    return 'Download';
  };

  return (
    <div className="flex items-center gap-2">
      <Button
        onClick={handleDownload}
        disabled={isButtonDisabled}
        className="bg-blue-500 hover:bg-blue-600 text-white disabled:opacity-50 disabled:cursor-not-allowed"
      >
        {getButtonText()}
      </Button>
    </div>
  );
}; 