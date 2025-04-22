import React, { useState, useRef, useCallback } from 'react';
import { useAuth } from '../contexts/AuthContext';
import { useNavigate } from 'react-router-dom';
import octroLogo from '../assets/octro-logo.png';
import axios, { CancelTokenSource } from 'axios';
import { ToastContainer, toast } from 'react-toastify';
import 'react-toastify/dist/ReactToastify.css';
import Confetti from 'react-confetti';
import { ImCross } from 'react-icons/im';

const formatFileSize = (bytes: number): string => {
  const units = ['B', 'KB', 'MB', 'GB', 'TB'];
  let size = bytes;
  let unitIndex = 0;

  while (size >= 1024 && unitIndex < units.length - 1) {
    size /= 1024;
    unitIndex++;
  }

  return `${size.toFixed(2)} ${units[unitIndex]}`;
};

const Home: React.FC = () => {
  const { user, logout } = useAuth();
  const navigate = useNavigate();

  // Show welcome message for users without a role
  if (!user?.role || user.role === 'user') {
    return (
      <div className="min-h-screen bg-gray-100">
        <div className="max-w-7xl mx-auto py-6 sm:px-6 lg:px-8">
          <div className="px-4 py-6 sm:px-0">
            <div className="bg-white overflow-hidden shadow rounded-lg">
              <div className="px-4 py-5 sm:p-6">
                <h1 className="text-2xl font-bold text-gray-900 mb-4">Welcome to TapeX</h1>
                <p className="text-gray-600">
                  Thank you for joining TapeX! To get started, please contact your administrator to assign you a role.
                  Once you have a role, you'll be able to access the file management features.
                </p>
                <div className="mt-6">
                  <button
                    onClick={logout}
                    className="bg-red-500 hover:bg-red-600 text-white font-bold py-2 px-4 rounded"
                  >
                    Logout
                  </button>
                </div>
              </div>
            </div>
          </div>
        </div>
      </div>
    );
  }

  const [selectedFile, setSelectedFile] = useState<File | null>(null);
  const [uploadProgress, setUploadProgress] = useState<number>(0);
  const [uploadSpeed, setUploadSpeed] = useState<string>('0 KB/s');
  const [timeRemaining, setTimeRemaining] = useState<string>('Calculating...');
  const [isUploading, setIsUploading] = useState<boolean>(false);
  const [showConfetti, setShowConfetti] = useState<boolean>(false);
  const fileInputRef = useRef<HTMLInputElement>(null);
  const cancelTokenRef = useRef<CancelTokenSource | null>(null);
  const lastLoadedRef = useRef<number>(0);
  const lastTimeRef = useRef<number>(0);

  const handleFileSelect = (event: React.ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0];
    if (file) {
      setSelectedFile(file);
      toast.info(`Selected: ${file.name} (${formatFileSize(file.size)})`, {
        position: "top-right",
        autoClose: 3000,
      });
    }
  };

  const stopConfetti = useCallback(() => {
    setTimeout(() => {
      setShowConfetti(false);
    }, 5000);
  }, []);

  const handleCancelUpload = async () => {
    if (cancelTokenRef.current) {
      cancelTokenRef.current.cancel('Upload cancelled by user');
      setIsUploading(false);
      setUploadProgress(0);

      // Clean up the partial upload file only
      try {
        await axios.post('/api/cancel-upload', {
          fileName: selectedFile?.name,
          userName: user?.name,
          groupName: user?.role
        });
      } catch (error) {
        console.error('Error cleaning up partial upload:', error);
      }

      // Reset file input
      if (fileInputRef.current) {
        fileInputRef.current.value = '';
      }
      setSelectedFile(null);
    }
  };

  const calculateSpeedAndTime = (loaded: number, total: number, currentTime: number, toastId: string | number) => {
    const timeDiff = (currentTime - lastTimeRef.current) / 1000; // Convert to seconds
    const loadedDiff = loaded - lastLoadedRef.current;
    const speed = loadedDiff / timeDiff; // bytes per second

    // Update speed
    const formattedSpeed = formatFileSize(speed) + '/s';
    setUploadSpeed(formattedSpeed);

    // Calculate time remaining
    if (speed > 0) {
      const remainingBytes = total - loaded;
      const secondsRemaining = remainingBytes / speed;
      setTimeRemaining(formatTimeRemaining(secondsRemaining));
    }

    // Update toast with current speed
    toast.update(toastId, {
      render: `Uploading: ${Math.round((loaded * 100) / total)}% (${formattedSpeed})`,
    });

    // Update refs
    lastLoadedRef.current = loaded;
    lastTimeRef.current = currentTime;
  };

  const formatTimeRemaining = (seconds: number): string => {
    if (seconds < 60) {
      return `${Math.ceil(seconds)} seconds`;
    } else if (seconds < 3600) {
      const minutes = Math.ceil(seconds / 60);
      return `${minutes} minute${minutes > 1 ? 's' : ''}`;
    } else {
      const hours = Math.floor(seconds / 3600);
      const minutes = Math.ceil((seconds % 3600) / 60);
      return `${hours} hour${hours > 1 ? 's' : ''} ${minutes} minute${minutes > 1 ? 's' : ''}`;
    }
  };

  const handleUpload = async () => {
    if (!selectedFile) return;

    setIsUploading(true);
    setUploadProgress(0);
    setUploadSpeed('0 KB/s');
    setTimeRemaining('Calculating...');
    lastLoadedRef.current = 0;
    lastTimeRef.current = Date.now();

    const uploadToastId = toast.loading('Starting upload...', {
      position: "top-right",
    });

    // Create a new cancel token
    cancelTokenRef.current = axios.CancelToken.source();

    const formData = new FormData();
    formData.append('file', selectedFile);
    formData.append('userName', user?.name || '');
    formData.append('groupName', user?.role || '');

    try {
      await axios.post('/api/upload', formData, {
        headers: {
          'Content-Type': 'multipart/form-data',
        },
        cancelToken: cancelTokenRef.current.token,
        onUploadProgress: (progressEvent) => {
          const currentTime = Date.now();
          const progress = progressEvent.total
            ? Math.round((progressEvent.loaded * 100) / progressEvent.total)
            : 0;

          setUploadProgress(progress);
          calculateSpeedAndTime(
            progressEvent.loaded,
            progressEvent.total || 0,
            currentTime,
            uploadToastId
          );
        },
      });

      setShowConfetti(true);
      stopConfetti();

      toast.update(uploadToastId, {
        render: 'Upload completed successfully!',
        type: 'success',
        isLoading: false,
        autoClose: 2000,
      });

      setSelectedFile(null);
      if (fileInputRef.current) {
        fileInputRef.current.value = '';
      }
    } catch (error) {
      if (axios.isCancel(error)) {
        toast.update(uploadToastId, {
          render: 'Upload cancelled',
          type: 'info',
          isLoading: false,
          autoClose: 2000,
        });
      } else {
        console.error('Upload failed:', error);
        toast.update(uploadToastId, {
          render: 'Upload failed!',
          type: 'error',
          isLoading: false,
          autoClose: 2000,
        });
      }
    } finally {
      setIsUploading(false);
      setUploadProgress(0);
      setUploadSpeed('0 KB/s');
      setTimeRemaining('Calculating...');
      cancelTokenRef.current = null;
    }
  };

  return (
    <div className="app">
      {showConfetti && <Confetti
        numberOfPieces={200}
        recycle={false}
        gravity={0.2}
        initialVelocityY={10}
      />}
      <ToastContainer />
      <header className="header">
        <div className="header-right">
          <img src={octroLogo} alt="Octro Logo" />
        </div>
        <div className="header-left">
          <div className="header-content">
            <div className="user-info">
              <div className="text-lg font-medium">
                {user?.role ? user.role.charAt(0).toUpperCase() + user.role.slice(1).toLowerCase() : 'User'}
              </div>
              <div className="text-sm">{user?.name || 'User'}</div>
            </div>
            <div className="header-buttons">
              {user?.role === 'admin' && (
                <button
                  onClick={() => navigate('/admin')}
                  className="rounded-md bg-gray-800 px-4 py-2 text-sm font-medium text-white transition-colors hover:bg-gray-700"
                >
                  Admin Panel
                </button>
              )}

              <button
                onClick={logout}
                className="rounded-md bg-gray-800 px-4 py-2 text-sm font-medium text-white transition-colors hover:bg-gray-700"
              >
                Logout
              </button>
            </div>
          </div>
        </div>
      </header>

      <main className="main-content">
        <h1>TapeX</h1>
        <h4>Tape Management demystified</h4>
        <div className="button-group">
          <button
            onClick={handleUpload}
            disabled={!selectedFile || isUploading}
            className={`rounded-md px-4 py-2 text-sm font-medium text-white transition-colors
            ${selectedFile ? 'bg-green-600 hover:bg-green-700' : 'bg-blue-600 hover:bg-blue-700'}
            ${!selectedFile || isUploading ? 'bg-gray-400 cursor-not-allowed' : 'cursor-pointer'}
            `}
          >
            {isUploading ? 'Uploading...' : 'Upload'}
          </button>
          {isUploading && (
            <button
              onClick={handleCancelUpload}
              style={{
                padding: '0.8rem',
                fontSize: '1.1rem',
                fontWeight: 500,
                borderRadius: '8px',
                border: 'none',
                cursor: 'pointer',
                marginRight: '1rem',
                position: 'relative',
                overflow: 'hidden',
                background: 'linear-gradient(135deg, #ef4444, #dc2626)',
                color: 'white',
                transition: 'all 0.3s ease',
                boxShadow: '0 2px 4px rgba(239, 68, 68, 0.1)',
                width: '3.2rem',
                height: '3.2rem',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center'
              }}
              title="Cancel upload"
            >
              <ImCross size={20} color="white" />
            </button>
          )}
          <button
            onClick={() => navigate('/files')}
            className="rounded-md bg-gray-800 px-4 py-2 text-sm font-medium text-white transition-colors hover:bg-gray-700"
          >
            View Files
          </button>
          <button
            onClick={() => navigate('/history')}
            className="rounded-md bg-gray-800 px-4 py-2 text-sm font-medium text-white transition-colors hover:bg-gray-700"
          >
            History
          </button>
        </div>
        <div className="file-input-container">
          <input
            type="file"
            ref={fileInputRef}
            onChange={handleFileSelect}
            style={{ display: 'none', position: 'absolute', visibility: 'hidden', width: 0, height: 0 }}
            aria-hidden="true"
          />
          <button
            onClick={() => fileInputRef.current?.click()}
            className={`rounded-md px-4 py-2 text-sm font-medium text-white transition-colors duration-1000 ${selectedFile
                ? "bg-green-600 hover:bg-green-700"
                : "bg-gray-800 hover:bg-gray-700"
              }`}
            disabled={isUploading}
          >
            Choose File
          </button>
          {isUploading && (
            <div className="mt-4 w-full relative">
              <div className="h-2 w-full bg-gray-200 rounded-full">
                <div
                  className="h-2 bg-blue-600 rounded-full transition-all duration-300"
                  style={{ width: `${uploadProgress}%` }}
                />
              </div>
              <div className="mt-1 text-sm text-gray-600 text-center">
                {uploadProgress}% - {uploadSpeed}
              </div>
              <div className="mt-1 text-sm text-gray-500 text-center">
                Time remaining: {timeRemaining}
              </div>
            </div>
          )}
        </div>

        {/* Selected File Display */}
        {selectedFile && (
          <div className="mt-4 flex flex-col items-center justify-center">
            <div className="text-gray-700 font-medium">Selected File</div>
            <div className="text-gray-600 text-sm mt-1">
              "{selectedFile.name}" ({formatFileSize(selectedFile.size)})
            </div>
          </div>
        )}
      </main>

      <footer className="footer">
        Made with <span className="heart">❤</span> by DevOps Team
      </footer>
    </div>
  );
};

export default Home; 