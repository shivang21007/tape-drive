import React, { useState, useEffect } from 'react';
import axios from 'axios';
import {toast, ToastContainer } from 'react-toastify';
import { useNavigate } from 'react-router-dom';


const SecureCopy: React.FC = () => {
  const navigate = useNavigate();
  const [servers, setServers] = useState<string[]>([]);
  const [selectedServer, setSelectedServer] = useState('');
  const [filePath, setFilePath] = useState('');
  const [error, setError] = useState('');

  useEffect(() => {
    const fetchServers = async () => {
      try {
        const response = await axios.get('/api/securecopy/servers');
        setServers(response.data.servers);
      } catch (error) {
        console.error('Error fetching servers:', error);
        setError('Failed to fetch server list');
      }
    };

    fetchServers();
  }, []);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError('');

    try {
      const response = await axios.post('/api/securecopy/upload', {
        server: selectedServer,
        filePath
      });
      toast.success('File uploaded successfully');
      console.log('Upload successful :', response.data);

      // TODO: Handle successful upload
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
          <h1 className="text-3xl font-bold text-gray-900 mb-6">Secure Copy</h1>
          <div className="space-x-4">
            <button
              onClick={() => navigate('/')}
              className="px-4 py-2 bg-gray-500 text-white rounded-md hover:bg-gray-600 transition-colors"
            >
              Back to Home
            </button>
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
                >
                  <option value="">Select a server</option>
                  {servers.map((server) => (
                    <option key={server} value={server}>
                      {server}
                    </option>
                  ))}
                </select>
              </div>

              <div>
                <label htmlFor="filePath" className="block text-sm font-medium text-gray-700">
                  Full File Path
                </label>
                <input
                  type="text"
                  id="filePath"
                  value={filePath}
                  onChange={(e) => setFilePath(e.target.value)}
                  className="mt-1 block w-full border border-gray-300 rounded-md shadow-sm py-2 px-3 focus:outline-none focus:ring-blue-500 focus:border-blue-500 sm:text-sm"
                  placeholder="Enter full file path"
                  required
                />
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
    </div>
  );
};

export default SecureCopy; 