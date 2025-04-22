import { useState, useEffect } from 'react';
import axios from 'axios';
import { toast } from 'react-hot-toast';

interface DownloadStatus {
  status: 'pending' | 'processing' | 'completed' | 'failed';
  servedFrom?: 'cache' | 'tape';
  filePath?: string;
  message?: string;
}

export const useDownloadStatus = (requestId: number | null) => {
  const [status, setStatus] = useState<DownloadStatus | null>(null);
  const [isPolling, setIsPolling] = useState(false);

  useEffect(() => {
    let intervalId: NodeJS.Timeout | null = null;

    const checkStatus = async () => {
      if (!requestId) return;

      try {
        const response = await axios.get(`/api/download-requests/${requestId}/status`);
        const data = response.data;

        setStatus(data);

        // If the request is completed or failed, stop polling
        if (data.status === 'completed' || data.status === 'failed') {
          if (intervalId) {
            clearInterval(intervalId);
            intervalId = null;
          }
          setIsPolling(false);

          if (data.status === 'completed') {
            toast.success('File is ready for download!');
          } else if (data.status === 'failed') {
            toast.error('Failed to process download request');
          }
        }
      } catch (error) {
        console.error('Error checking download status:', error);
        if (intervalId) {
          clearInterval(intervalId);
          intervalId = null;
        }
        setIsPolling(false);
      }
    };

    if (requestId) {
      setIsPolling(true);
      // Initial check
      checkStatus();
      // Start polling every 5 seconds
      intervalId = setInterval(checkStatus, 5000);
    }

    return () => {
      if (intervalId) {
        clearInterval(intervalId);
      }
      setIsPolling(false);
    };
  }, [requestId]); // Only re-run when requestId changes

  return { status, isPolling };
}; 