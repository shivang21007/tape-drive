import React, { useState } from 'react';
import { Button } from './ui/Button';
import axios from 'axios';
import { useNavigate } from 'react-router-dom';
import { convertFileSizeToBytes } from '../utils/format';

interface FileDownloadProps {
  fileId: number;
  fileName: string;
  fileSize?: string; 
  method?: string; // File size in bytes
  iscached?: 0 | 1; // 0 for false, 1 for true
}

interface DownloadStatus {
  status: 'none' | 'processing' | 'completed' | 'failed' | 'requested';
  requestId?: number;
  message: string;
}

const LARGE_FILE_THRESHOLD = 10 * 1024 * 1024 * 1024; // 10GB 

export const FileDownload: React.FC<FileDownloadProps> = ({ 
  fileId, 
  fileName,
  fileSize,
  iscached
}) => {
  const [isDownloading, setIsDownloading] = useState(false);
  const [downloadStatus, setDownloadStatus] = useState<DownloadStatus>({ 
    status: 'none',
    message: ''
  });
  const navigate = useNavigate();

  // Check if file is too large
  const isLargeFile = fileSize ? convertFileSizeToBytes(fileSize) > LARGE_FILE_THRESHOLD : false;

  // Direct Download to Browser
  const handleDownload = async () => {
    if (isLargeFile) {
      alert('File is too large to Direct Download. Please use Secure Download.');
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

  // Secure Download to Server
  const handleSecureDownload = async () => {
    setIsDownloading(true);

    try {
      // Check if file is in cache without creating a download request
      const response = await axios.get(`/api/files/${fileId}/check-cache`);
      const data = response.data;

      if (data.isInCache) {
        // File is in cache, redirect to secure download page
        navigate(`/securedownload?fileId=${fileId}&fileName=${encodeURIComponent(fileName)}`);
      } else {
        // File not in cache, create a download request
        const downloadResponse = await axios.get(`/api/files/${fileId}/download`);
        const downloadData = downloadResponse.data;
        
        if (downloadData.status === 'processing') {
          setDownloadStatus({
            status: 'processing',
            requestId: downloadData.requestId,
            message: downloadData.message
          });
          alert(downloadData.message);
        }
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
    } finally {
      setIsDownloading(false);
    }
  };

  const isDownloadButtonDisabled = isDownloading || 
    downloadStatus.status === 'processing';

  const getRequestDownloadButtonText = () => {
    if (isDownloading) return 'Checking...';
    if (downloadStatus.status === 'processing' || downloadStatus.status === 'requested') {
      return 'Requested...';
    }
    return 'Request Download';
  };

  const getButtonText = () => {
    if (isLargeFile) return 'Large File use Other Option';
    if (isDownloading) return 'Checking...';
    if (downloadStatus.status === 'processing' || downloadStatus.status === 'requested') {
      return 'Requested...';
    }
    return 'Download Directly';
  };

  return (
    <>
      { iscached === 1 &&
        <div className="flex items-center gap-1 justify-center">
          {!isLargeFile &&
            <Button
              onClick={handleDownload}
              disabled={isLargeFile || isDownloadButtonDisabled}
              style={{
                cursor: (isLargeFile || isDownloadButtonDisabled) ? 'not-allowed' : 'pointer'
              }}
              className={`${
                isLargeFile 
                  ? 'bg-green-500 hover:bg-green-600' 
                  : 'bg-blue-500 hover:bg-blue-600'
              } text-white disabled:opacity-50 disabled:cursor-not-allowed`}
            >
              {getButtonText()}
            </Button>
          }
          <Button
            onClick={handleSecureDownload}
            disabled={isDownloadButtonDisabled}
            style={{
              cursor: isDownloadButtonDisabled ? 'not-allowed' : 'pointer'
            }}
            className={`${
              isLargeFile 
                ? 'bg-green-500 hover:bg-green-600' 
                : 'bg-blue-500 hover:bg-blue-600'
            } text-white disabled:opacity-50 disabled:cursor-not-allowed`}
          >
            Download To Server
          </Button>
        </div>
      }
      { iscached === 0 &&
        <div className="flex items-center gap-1 justify-center">
          <Button
            onClick={handleDownload}
            disabled={isDownloadButtonDisabled}
            style={{
              cursor: isDownloadButtonDisabled ? 'not-allowed' : 'pointer'
            }}
            className={`${
              isLargeFile 
                ? 'bg-green-500 hover:bg-green-600' 
                : 'bg-blue-500 hover:bg-blue-600'
            } text-white disabled:opacity-50 disabled:cursor-not-allowed`}
          >
            {getRequestDownloadButtonText()}
          </Button>
        </div>
      }
    </>
  );
}; 