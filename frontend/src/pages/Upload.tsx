import React, { useState, useRef } from 'react';
import axios from 'axios';
import { toast, ToastContainer } from 'react-toastify';
import { useNavigate } from 'react-router-dom';
import Radio from '@mui/material/Radio';
import RadioGroup from '@mui/material/RadioGroup';
import FormControlLabel from '@mui/material/FormControlLabel';
import FormControl from '@mui/material/FormControl';
import { FontAwesomeIcon } from '@fortawesome/react-fontawesome';
import { faXmark } from '@fortawesome/free-solid-svg-icons';
import { useAuth } from '../contexts/AuthContext';

const Upload: React.FC = () => {
  const navigate = useNavigate();
  const [selectedFiles, setSelectedFiles] = useState<FileList | null>(null);
  const [isUploading, setIsUploading] = useState(false);
  const [error, setError] = useState('');
  const [uploadMode, setUploadMode] = useState<'file' | 'folder'>('file');
  const [uploadProgress, setUploadProgress] = useState(0);
  const [showUploadWarning, setShowUploadWarning] = useState(false);
  const cancelTokenSource = useRef<any>(null);
  const { user } = useAuth();

  const handleRadioChange = (_: React.ChangeEvent<HTMLInputElement>, value: string) => {
    setUploadMode(value as 'file' | 'folder');
    setSelectedFiles(null);
    setError('');
  };

  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    setError('');
    if (e.target.files && e.target.files.length > 0) {
      setSelectedFiles(e.target.files);
    } else {
      setSelectedFiles(null);
    }
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError('');
    setShowUploadWarning(false);
    if (!selectedFiles || selectedFiles.length === 0) {
      setShowUploadWarning(true);
      setError('Please select a file or folder to upload.');
      return;
    }
    setIsUploading(true);
    setUploadProgress(0);
    cancelTokenSource.current = axios.CancelToken.source();
    try {
      const formData = new FormData();
      if (uploadMode === 'folder' && selectedFiles.length > 0) {
        // Get parent folder name from first file's webkitRelativePath
        const firstRelPath = (selectedFiles[0] as any).webkitRelativePath;
        const parentFolder = firstRelPath ? firstRelPath.split('/')[0] : '';
        Array.from(selectedFiles).forEach((file) => {
          let relPath = (file as any).webkitRelativePath || file.name;
          // Ensure relPath starts with parentFolder/
          if (parentFolder && !relPath.startsWith(parentFolder + '/')) {
            relPath = parentFolder + '/' + relPath;
          }
          formData.append('files', file);
          formData.append('relativePaths', relPath);
        });
      } else {
        Array.from(selectedFiles).forEach((file) => {
          formData.append('files', file);
          formData.append('relativePaths', file.name);
        });
      }
      await axios.post('/api/upload', formData, {
        headers: { 'Content-Type': 'multipart/form-data' },
        onUploadProgress: (progressEvent) => {
          if (progressEvent.total) {
            const percent = Math.round((progressEvent.loaded * 100) / progressEvent.total);
            setUploadProgress(percent);
          }
        },
        cancelToken: cancelTokenSource.current.token,
      });
      toast.success('Upload successful!');
      setSelectedFiles(null);
    } catch (err: any) {
      if (axios.isCancel && axios.isCancel(err)) {
        setError('Upload cancelled by user.');
      } else {
        setError('Failed to upload.');
        toast.error('Failed to upload.');
      }
    } finally {
      setIsUploading(false);
      setUploadProgress(0);
      cancelTokenSource.current = null;
    }
  };

  return (
    <div className="min-h-screen bg-gray-100">
      <ToastContainer 
        position="top-right"
        autoClose={3000}
        hideProgressBar={false}
        newestOnTop
        closeOnClick
        rtl={false}
        pauseOnFocusLoss
        draggable
        pauseOnHover
      />
      <div className="max-w-7xl mx-auto py-6 sm:px-6 lg:px-8">
        <div className="flex justify-between items-center mb-6">
          <h1 className="text-3xl font-bold text-gray-900 mb-6">Upload from PC</h1>
          <div className="space-x-4">
            <button
              onClick={() => navigate('/')} 
              className="px-4 py-2 bg-gray-500 text-white rounded-md hover:bg-gray-600 transition-colors"
            >
              Back to Home
            </button>
            <button
              onClick={() => navigate('/files')} 
              className="px-4 py-2 bg-gray-500 text-white rounded-md hover:bg-gray-600 transition-colors"
            >
              Upload-History
            </button>
          </div>
        </div>
        <br />
        <div className="bg-white shadow sm:rounded-lg p-8 flex flex-col gap-6">
          {/* MUI RadioGroup for File/Folder selection */}
          <FormControl sx={{ mb: 2 }}>
            <RadioGroup
              row
              aria-labelledby="upload-mode-label"
              name="upload-mode"
              value={uploadMode}
              onChange={handleRadioChange}
            >
              <FormControlLabel value="file" control={<Radio size="small" />} label="File" />
              <FormControlLabel value="folder" control={<Radio size="small" />} label="Folder" />
            </RadioGroup>
          </FormControl>
          <form onSubmit={handleSubmit} className="flex flex-col gap-2">
            <div className="flex flex-row items-center gap-4">
              {/* New button for file/folder selection */}
              <button
                type="button"
                className="px-6 py-2 border-2 border-blue-700 text-blue-700 bg-white rounded-lg font-medium shadow-sm transition-all duration-200 hover:bg-gradient-to-r hover:from-blue-600 hover:to-blue-400 hover:text-white focus:outline-none focus:ring-2 focus:ring-blue-400"
                onClick={() => document.getElementById('file')?.click()}
                style={{ minWidth: '140px' }}
                disabled={isUploading}
                aria-disabled={isUploading}
              >
                {uploadMode === 'folder' ? 'Choose Folder' : 'Choose File'}
              </button>
              <input
                type="file"
                id="file"
                onChange={handleFileChange}
                className="hidden"
                style={{ display: 'none' }}
                required
                multiple={uploadMode === 'folder'}
                // @ts-ignore
                {...(uploadMode === 'folder' ? { webkitdirectory: '', directory: '' } : {})}
              />
              <button
                type="submit"
                className="px-6 py-2 border-2 border-blue-700 text-blue-700 bg-white rounded-lg font-medium shadow-sm transition-all duration-200 hover:bg-gradient-to-r hover:from-blue-600 hover:to-blue-400 hover:text-white focus:outline-none focus:ring-2 focus:ring-blue-400"
                disabled={isUploading || !selectedFiles || selectedFiles.length === 0}
                style={{ minWidth: '140px' }}
                title={!selectedFiles || selectedFiles.length === 0 ? 'Please select a file or folder to upload.' : ''}
              >
                {isUploading ? 'Uploading...' : 'Upload'}
              </button>
              {/* Cancel button, only visible while uploading */}
              {isUploading && (
                <button
                  type="button"
                  className="cancel-btn px-6 py-2 rounded-lg font-medium ml-2 flex items-center gap-2"
                  onClick={async () => {
                    if (cancelTokenSource.current) {
                      cancelTokenSource.current.cancel('Upload cancelled by user.');
                    }
                    setIsUploading(false);
                    setSelectedFiles(null);
                    setError('Upload cancelled by user.');
                    // Clean up the partial upload file on the server
                    try {
                      if (selectedFiles && selectedFiles.length > 0 && user) {
                        const fileName = uploadMode === 'folder'
                          ? ((selectedFiles[0] as any).webkitRelativePath || selectedFiles[0].name).split('/')[0]
                          : selectedFiles[0].name;
                        await axios.post('/api/cancel-upload', {
                          fileName,
                          userName: user.name,
                          groupName: user.role
                        });
                      }
                    } catch (e) {
                      // Optionally handle error
                    }
                  }}
                >
                  <FontAwesomeIcon icon={faXmark} size="lg" className="text-white" />
                </button>
              )}
            </div>
            <br />
            {/* Show selected file/folder name on a new line below the buttons */}
            <div className="min-h-[1.5rem] mt-1">
              <span className="text-gray-600 text-sm truncate max-w-xs block">
                {selectedFiles && selectedFiles.length > 0 ? (
                  uploadMode === 'folder' ? (
                    (() => {
                      const first = selectedFiles[0];
                      // Try to get folder name from webkitRelativePath
                      // e.g. 'myfolder/file1.txt' => 'myfolder'
                      const relPath = (first as any).webkitRelativePath || first.name;
                      const folderName = relPath.includes('/') ? relPath.split('/')[0] : relPath;
                      return `Selected - "${folderName}"`;
                    })()
                  ) : (
                    `Selected - "${selectedFiles[0].name}"`
                  )
                ) : ''}
              </span>
            </div>
            {error && (
              <div className="text-red-600 text-sm">
                {error}
              </div>
            )}
            {/* Progress bar shown only while uploading */}
            {isUploading && (
              <div className="w-full mt-4">
                <div className="relative h-5 bg-gray-200 rounded-full overflow-hidden shadow-sm">
                  <div
                    className="absolute left-0 top-0 h-full bg-gradient-to-r from-blue-500 to-blue-400 transition-all duration-200"
                    style={{ width: `${uploadProgress}%` }}
                  />
                  <div className="absolute inset-0 flex items-center justify-center text-xs font-semibold text-blue-900">
                    Upload percentage - {uploadProgress}%
                  </div>
                </div>
              </div>
            )}
            {/* Show warning if trying to upload without selecting a file/folder */}
            {showUploadWarning && (
              <div className="text-yellow-600 text-sm mt-2">
                Please select a file or folder before uploading.
              </div>
            )}
          </form>
        </div>
      </div>
    </div>
  );
};

export default Upload; 