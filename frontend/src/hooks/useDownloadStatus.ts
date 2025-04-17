import { useState, useEffect } from 'react';
import axios from 'axios';
import { toast } from 'react-hot-toast';

interface DownloadStatus {
  status: 'pending' | 'processing' | 'completed' | 'failed';
  filePath?: string;
  message?: string;
}

export const useDownloadStatus = (requestId: number | null) => {
  const [status, setStatus] = useState<DownloadStatus | null>(null);
  const [isPolling, setIsPolling] = useState(false);
  const [loadingToast, setLoadingToast] = useState<string | null>(null);

  useEffect(() => {
    let interval: NodeJS.Timeout | null = null;

    const startPolling = () => {
      if (!requestId) return;

      setIsPolling(true);
      const toastId = toast.loading('Checking download status...');
      setLoadingToast(toastId);

      interval = setInterval(async () => {
        try {
          const response = await axios.get(`/api/download-requests/${requestId}/status`);
          const newStatus = response.data;

          setStatus(newStatus);

          if (newStatus.status === 'completed' && newStatus.filePath) {
            clearInterval(interval!);
            setIsPolling(false);
            if (loadingToast) {
              toast.dismiss(loadingToast);
            }
            toast.success('File is ready for download!');
          } else if (newStatus.status === 'failed') {
            clearInterval(interval!);
            setIsPolling(false);
            if (loadingToast) {
              toast.dismiss(loadingToast);
            }
            toast.error('Failed to process download request');
          }
        } catch (error) {
          console.error('Error checking download status:', error);
          if (loadingToast) {
            toast.dismiss(loadingToast);
          }
          toast.error('Error checking download status');
        }
      }, 5000); // Poll every 5 seconds
    };

    if (requestId) {
      startPolling();
    }

    return () => {
      if (interval) {
        clearInterval(interval);
      }
      if (loadingToast) {
        toast.dismiss(loadingToast);
      }
    };
  }, [requestId, loadingToast]);

  return { status, isPolling };
}; 