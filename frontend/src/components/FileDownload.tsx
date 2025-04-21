import React, { useState } from 'react';
import { Button } from './ui/Button';
import { toast } from 'react-hot-toast';
import axios from 'axios';
import { useDownloadStatus } from '../hooks/useDownloadStatus';
import { downloadFile, isFileTypeSupported } from '../utils/downloadUtils';

interface FileDownloadProps {
  fileId: number;
  fileName: string;
}

export const FileDownload: React.FC<FileDownloadProps> = ({ fileId, fileName }) => {
  const [isDownloading, setIsDownloading] = useState(false);
  const [requestId, setRequestId] = useState<number | null>(null);
  const { status, isPolling } = useDownloadStatus(requestId);

  const handleDownload = async () => {
    if (!isFileTypeSupported(fileName)) {
      toast.error('File type not supported');
      return;
    }

    setIsDownloading(true);
    const loadingToast = toast.loading('Checking file availability...');

    try {
      const response = await axios.get(`/api/files/${fileId}/download`);

      // If file is in cache, it will return a completed status
      if (response.data.status === 'completed' && response.data.filePath) {
        // Download the file from the cache
        const fileResponse = await axios.get(`/api/files/${fileId}/download`, {
          responseType: 'blob'
        });
        
        setIsDownloading(false);
        toast.dismiss(loadingToast);
        toast.success('File found in cache!');
        downloadFile(fileResponse.data, fileName);
        return;
      }

      // If file is not in cache, start polling
      if (response.data.status === 'pending' && response.data.requestId) {
        setRequestId(response.data.requestId);
        toast.dismiss(loadingToast);
        toast.success(response.data.message);
      } else {
        throw new Error('Unexpected response from server');
      }
    } catch (error) {
      setIsDownloading(false);
      toast.dismiss(loadingToast);
      if (axios.isAxiosError(error)) {
        if (error.response?.status === 404) {
          toast.error('File not found');
        } else if (error.response?.status === 403) {
          toast.error('Access denied');
        } else {
          toast.error('Failed to initiate download');
        }
      } else {
        toast.error('Failed to initiate download');
      }
    }
  };

  return (
    <div className="flex items-center gap-2">
      <Button
        onClick={handleDownload}
        disabled={isDownloading || isPolling}
        className="bg-blue-500 hover:bg-blue-600 text-white disabled:opacity-50 disabled:cursor-not-allowed"
      >
        {isDownloading || isPolling ? 'Processing...' : 'Download'}
      </Button>
      
      {status?.status === 'processing' && (
        <div className="text-sm text-gray-600">
          Processing download request...
        </div>
      )}
    </div>
  );
}; 