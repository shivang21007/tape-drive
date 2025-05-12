import React, { useState, useEffect } from 'react';
import axios from 'axios';
import {toast, ToastContainer } from 'react-toastify';
import { useNavigate } from 'react-router-dom';

interface Server {
  server_name: string;
  server_ip: string;
  group_name: string;
}

const SecureUpload: React.FC = () => {
  const navigate = useNavigate();
  const [servers, setServers] = useState<Server[]>([]);
  const [selectedServer, setSelectedServer] = useState('');
  const [filePath, setFilePath] = useState('');
  const [error, setError] = useState('');
  const [pathError, setPathError] = useState('');
  const [isLoading, setIsLoading] = useState(true);

  useEffect(() => {
    const fetchServers = async () => {
      setIsLoading(true);
      setError('');
      try {
        const response = await axios.get('/api/serverinfo');
        
        if (Array.isArray(response.data)) {
          if (response.data.length === 0) {
            setError('Your group has no assigned servers. Please contact the administrator.');
          } else {
            setServers(response.data);
            // If there's only one server, auto-select it
            if (response.data.length === 1) {
              setSelectedServer(response.data[0].server_name);
            }
          }
        } else {
          setError('Invalid server data received');
        }
      } catch (error) {
        console.error('Error fetching servers:', error);
        if (axios.isAxiosError(error)) {
          if (error.response?.status === 401) {
            setError('Please log in to access server information');
          } else if (error.response?.status === 403) {
            setError('You do not have permission to access server information');
          } else {
            setError(error.response?.data?.error || 'Failed to fetch server list');
          }
        } else {
          setError('Failed to fetch server list');
        }
      } finally {
        setIsLoading(false);
      }
    };

    fetchServers();
  }, []);

  const validatePath = (path: string): boolean => {
    // Check if path contains any special characters or spaces
    const specialChars = [':', '*', '?', '<', '>', '|', ';', '&','@','%','!','&','#','^'," ",' '];
    const isValid = !specialChars.some(char => path.includes(char));
    
    if (!isValid) {
      setPathError('Path cannot contain special characters or spaces');
    } else {
      setPathError('');
    }
    
    return isValid;
  };

  const handlePathChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const newPath = e.target.value;
    setFilePath(newPath);
    validatePath(newPath);
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError('');

    if (!selectedServer || !filePath) {
      setError('Please fill all fields');
      return;
    }

    if (!validatePath(filePath)) {
      setError('Invalid file path');
      return;
    }

    try {
      const response = await axios.post('/api/secureupload', {
        server: selectedServer,
        filePath: filePath,
        type: 'upload'
      });
      if (response.status === 200) {
        toast.success('File uploaded successfully')
        setTimeout(() => {
          navigate('/files');
        }, 3000);
      }
    } catch (error) {
      console.error('Error uploading file:', error);
      setError('Failed to upload file');
    }
    setSelectedServer('');
    setFilePath('');
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
          <h1 className="text-3xl font-bold text-gray-900 mb-6">Secure Upload</h1>
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
        <div className="bg-white shadow sm:rounded-lg p-6">
          <form onSubmit={handleSubmit} className="space-y-6">
            <div>
              <label htmlFor="server" className="block text-sm font-medium text-gray-700">
                Choose Server
              </label>
              <select
                id="server"
                value={selectedServer}
                onChange={(e) => setSelectedServer(e.target.value)}
                className="mt-1 block w-full pl-3 pr-10 py-2 text-base border-gray-300 focus:outline-none focus:ring-blue-500 focus:border-blue-500 sm:text-sm rounded-md"
                required
                disabled={isLoading || servers.length === 0}
              >
                <option value="">
                  {isLoading ? 'Loading servers...' : 'Select a server'}
                </option>
                {!isLoading && servers.length === 0 ? (
                  <option value="" disabled>
                    Your group has no assigned servers. Please contact the administrator.
                  </option>
                ) : (
                  servers.map((server) => (
                    <option key={server.server_name} value={server.server_name}>
                      {server.server_name} ({server.server_ip})
                    </option>
                  ))
                )}
              </select>
              {error && (
                <p className="mt-2 text-sm text-red-600">{error}</p>
              )}
            </div>

            <div>
              <label htmlFor="filePath" className="block text-sm font-medium text-gray-700">
                Full File Path
              </label>
              <input
                type="text"
                id="filePath"
                value={filePath}
                onChange={handlePathChange}
                className={`mt-1 block w-full border ${
                  pathError ? 'border-red-500' : 'border-gray-300'
                } rounded-md shadow-sm py-2 px-3 focus:outline-none focus:ring-blue-500 focus:border-blue-500 sm:text-sm`}
                placeholder="Enter full file path"
                required
              />
              {pathError && (
                <p className="mt-1 text-sm text-red-600">{pathError}</p>
              )}
            </div>

            {error && (
              <div className="text-red-600 text-sm">
                {error}
              </div>
            )}

            <div>
              <button
                type="submit"
                className="w-full flex justify-center py-2 px-4 border border-transparent rounded-md shadow-sm text-sm font-medium text-white bg-blue-600 hover:bg-blue-700 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-blue-500"
              >
                Upload
              </button>
            </div>
          </form>
        </div>
      </div>
    </div>
  );
};

export default SecureUpload; 