import React, { useState, useRef, useCallback } from 'react';
import { useAuth } from '../contexts/AuthContext';
import { useNavigate } from 'react-router-dom';
import octroLogo from '../assets/octro-logo.png';
import axios from 'axios';
import { ToastContainer, toast } from 'react-toastify';
import 'react-toastify/dist/ReactToastify.css';
import Confetti from 'react-confetti';

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
  const [selectedFile, setSelectedFile] = useState<File | null>(null);
  const [uploadProgress, setUploadProgress] = useState<number>(0);
  const [isUploading, setIsUploading] = useState<boolean>(false);
  const [showConfetti, setShowConfetti] = useState<boolean>(false);
  const fileInputRef = useRef<HTMLInputElement>(null);

  const handleFileSelect = (event: React.ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0];
    if (file) {
      setSelectedFile(file);
      toast.info(`Selected: ${file.name} (${formatFileSize(file.size)})`, {
        position: "top-right",
        autoClose: 2000,
      });
    }
  };

  const stopConfetti = useCallback(() => {
    setTimeout(() => {
      setShowConfetti(false);
    }, 5000); // Stop confetti after 5 seconds
  }, []);

  const handleUpload = async () => {
    if (!selectedFile) return;

    setIsUploading(true);
    setUploadProgress(0);

    const uploadToastId = toast.loading('Starting upload...', {
      position: "top-right",
    });

    const formData = new FormData();
    formData.append('file', selectedFile);
    formData.append('userName', user?.name || '');
    formData.append('groupName', user?.role || '');

    try {
      await axios.post('/api/upload', formData, {
        headers: {
          'Content-Type': 'multipart/form-data',
        },
        onUploadProgress: (progressEvent) => {
          const progress = progressEvent.total
            ? Math.round((progressEvent.loaded * 100) / progressEvent.total)
            : 0;
          setUploadProgress(progress);
          toast.update(uploadToastId, {
            render: `Uploading: ${progress}%`,
          });
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
      console.error('Upload failed:', error);
      toast.update(uploadToastId, {
        render: 'Upload failed!',
        type: 'error',
        isLoading: false,
        autoClose: 2000,
      });
    } finally {
      setIsUploading(false);
      setUploadProgress(0);
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
            className="rounded-md bg-blue-600 px-4 py-2 text-sm font-medium text-white transition-colors hover:bg-blue-700 disabled:bg-gray-400"
          >
            {isUploading ? 'Uploading...' : 'Upload'}
          </button>
          <button>View</button>
          <button>Download</button>
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
            className="rounded-md bg-gray-800 px-4 py-2 text-sm font-medium text-white transition-colors hover:bg-gray-700"
          >
            Choose File
          </button>
          {selectedFile && (
            <div className="mt-2 text-sm text-gray-600">
              Selected: {selectedFile.name} ({formatFileSize(selectedFile.size)})
            </div>
          )}
          {isUploading && (
            <div className="mt-4 w-full">
              <div className="h-2 w-full bg-gray-200 rounded-full">
                <div
                  className="h-2 bg-blue-600 rounded-full transition-all duration-300"
                  style={{ width: `${uploadProgress}%` }}
                />
              </div>
              <div className="mt-1 text-sm text-gray-600 text-center">
                {uploadProgress}%
              </div>
            </div>
          )}
        </div>
      </main>

      <footer className="footer">
        Made with <span className="heart">❤</span> by DevOps Team
      </footer>
    </div>
  );
};

export default Home; 