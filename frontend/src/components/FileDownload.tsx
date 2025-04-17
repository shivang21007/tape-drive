import React, { useState } from 'react';
import { Button } from './ui/Button';
import { toast } from 'react-hot-toast';
import axios from 'axios';
import { useDownloadStatus } from '../hooks/useDownloadStatus';
import { downloadFile, isFileTypeSupported } from '../utils/downloadUtils';

interface FileDownloadProps {
  fileId: number;
  fileName: string;
  isAdmin: boolean;
}

export const FileDownload: React.FC<FileDownloadProps> = ({ fileId, fileName, isAdmin }) => {
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
      const response = await axios.get(`/api/files/${fileId}/download`, {
        responseType: 'blob'
      });

      // If we get a blob response, the file was in cache
      if (response.data instanceof Blob) {
        setIsDownloading(false);
        toast.dismiss(loadingToast);
        toast.success('File found in cache!');
        downloadFile(response.data, fileName);
        return;
      }

      // If we get a JSON response, the file is not in cache
      const { requestId: newRequestId, message } = response.data;
      setRequestId(newRequestId);
      toast.dismiss(loadingToast);
      toast.success(message);
    } catch (error) {
      setIsDownloading(false);
      toast.dismiss(loadingToast);
      if (axios.isAxiosError(error) && error.response?.status === 404) {
        toast.error('File not found');
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