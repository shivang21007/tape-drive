import React, { useState, useEffect } from 'react';
import { Button } from './ui/Button';
import axios from 'axios';
import { isFileTypeSupported } from '../utils/downloadUtils';
import { useNavigate } from 'react-router-dom';
import { convertFileSizeToBytes } from '../utils/format';

interface FileDownloadProps {
  fileId: number;
  fileName: string;
  fileSize?: string; // File size in bytes
}

interface DownloadStatus {
  status: 'none' | 'processing' | 'completed' | 'failed';
  requestId?: number;
  message: string;
}

const LARGE_FILE_THRESHOLD = 6 * 1024 * 1024 * 1024; // 5GB 

export const FileDownload: React.FC<FileDownloadProps> = ({ 
  fileId, 
  fileName,
  fileSize
}) => {
  const [isDownloading, setIsDownloading] = useState(false);
  const [downloadStatus, setDownloadStatus] = useState<DownloadStatus>({ 
    status: 'none',
    message: ''
  });
  const navigate = useNavigate();

  // Check if file is too large
  const isLargeFile = fileSize ? convertFileSizeToBytes(fileSize) > LARGE_FILE_THRESHOLD : false;

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

    try {
      // First check if file is in cache
      const response = await axios.get(`/api/files/${fileId}/download`);
      const data = response.data;

      if (data.status === 'completed' && data.servedFrom === 'cache') {
        alert('File found in cache!');
        // File is in cache, download it directly
        window.location.href = `/api/files/${fileId}/download?download=true`;
        setIsDownloading(false);
      } else if (data.status === 'processing') {
        setIsDownloading(false);
        setDownloadStatus({
          status: 'processing',
          requestId: data.requestId,
          message: data.message
        });
        alert(data.message);
      } else {
        throw new Error('Unexpected response from server');
      }
    } catch (error) {
      setIsDownloading(false);
      
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

  const handleSecureCopy = () => {
    navigate(`/securecopy?fileId=${fileId}&fileName=${encodeURIComponent(fileName)}`);
  };

  const isButtonDisabled = isDownloading || 
    downloadStatus.status === 'processing';

  const getButtonText = () => {
    if (isLargeFile) return 'LargeFile';
    if (isDownloading) return 'Checking...';
    if (downloadStatus.status === 'processing') {
      return 'requested';
    }
    return 'Download';
  };

  return (
    <div className="flex items-center gap-2">
      <Button
        onClick={isLargeFile ? handleSecureCopy : handleDownload}
        disabled={isLargeFile || isButtonDisabled}
        className={`${
          isLargeFile 
            ? 'bg-green-500 hover:bg-green-600' 
            : 'bg-blue-500 hover:bg-blue-600'
        } text-white disabled:opacity-50 disabled:cursor-not-allowed`}
      >
        {getButtonText()}
      </Button>
    </div>
  );
}; 