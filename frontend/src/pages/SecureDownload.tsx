import React, { useState, useEffect } from 'react';
import axios from 'axios';
import { toast, ToastContainer } from 'react-toastify';
import { useNavigate, useLocation } from 'react-router-dom';

const SecureDownload: React.FC = () => {
    const location = useLocation();
    const navigate = useNavigate();
    const searchParams = new URLSearchParams(location.search);
    const fileId = searchParams.get('fileId') || '';
    const fileName = searchParams.get('fileName') || '';
    
    const [servers, setServers] = useState<string[]>([]);
    const [selectedServer, setSelectedServer] = useState('');
    const [serverPath, setServerPath] = useState('');
    const [error, setError] = useState('');
    const [pathError, setPathError] = useState('');

    useEffect(() => {
        const fetchServers = async () => {
            try {
                const response = await axios.get('/api/secureservers');
                setServers(response.data.servers);
            } catch (error) {
                console.error('Error fetching servers:', error);
                setError('Failed to fetch server list');
            }
        };

        fetchServers();
    }, []);

    const validatePath = (path: string): boolean => {
        // Check if path contains any special characters or spaces
        const specialChars = ['\\', ':', '*', '?', '<', '>', '|', ';', '&','@','%','!','&','#','^'," ",' '];
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
        setServerPath(newPath);
        validatePath(newPath);
    };

    const handleSubmit = async (e: React.FormEvent) => {
        e.preventDefault();
        setError('');

        if (!fileId || !fileName || !selectedServer || !serverPath) {
            setError('Please fill all fields');
            return;
        }

        try {
            const requestData = {
                fileId: fileId,
                fileName: fileName,
                server: selectedServer,
                filePath: serverPath,
                type: 'download'
            };

            console.log('Sending request with data:', requestData);

            const response = await axios.post('/api/securedownload', requestData);
            console.log('Response:', response.data);

            if (response.data.success) {
                toast.success('Secure download request submitted successfully');
                setTimeout(() => {
                    navigate('/history');
                }, 5000);
            } else {
                const errorMessage = response.data.message || 'Failed to submit secure download request';
                toast.error(errorMessage);
                setError(errorMessage);
            }
        } catch (error) {
            console.error('Error submitting secure download:', error);
            let errorMessage = 'Failed to submit secure download request';
            
            if (axios.isAxiosError(error)) {
                errorMessage = error.response?.data?.error || errorMessage;
            }
            
            toast.error(errorMessage);
            setError(errorMessage);
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
                    <h1 className="text-3xl font-bold text-gray-900 mb-6">Secure Download</h1>
                    <div className="space-x-4">
                        <button
                            onClick={() => navigate('/')}
                            className="px-4 py-2 bg-gray-500 text-white rounded-md hover:bg-gray-600 transition-colors"
                        >
                            Back to Home
                        </button>
                        <button
                            onClick={() => navigate('/history')}
                            className="px-4 py-2 bg-gray-500 text-white rounded-md hover:bg-gray-600 transition-colors"
                        >
                            Download-History
                        </button>
                    </div>
                </div>
                <div className="bg-white shadow sm:rounded-lg p-6">
                    <form onSubmit={handleSubmit} className="space-y-6">
                        <div>
                            <label htmlFor="fileId" className="block text-sm font-medium text-gray-700">
                                File ID
                            </label>
                            <input
                                type="text"
                                id="fileId"
                                value={fileId || ''}
                                readOnly
                                className="mt-1 block w-full border border-gray-300 rounded-md shadow-sm py-2 px-3 bg-gray-100 focus:outline-none focus:ring-blue-500 focus:border-blue-500 sm:text-sm"
                            />
                        </div>

                        <div>
                            <label htmlFor="fileName" className="block text-sm font-medium text-gray-700">
                                File Name
                            </label>
                            <input
                                type="text"
                                id="fileName"
                                value={fileName || ''}
                                readOnly
                                className="mt-1 block w-full border border-gray-300 rounded-md shadow-sm py-2 px-3 bg-gray-100 focus:outline-none focus:ring-blue-500 focus:border-blue-500 sm:text-sm"
                            />
                        </div>

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
                            <label htmlFor="serverPath" className="block text-sm font-medium text-gray-700">
                                Server Path
                            </label>
                            <input
                                type="text"
                                id="serverPath"
                                value={serverPath}
                                onChange={handlePathChange}
                                className={`mt-1 block w-full border ${
                                    pathError ? 'border-red-500' : 'border-gray-300'
                                } rounded-md shadow-sm py-2 px-3 focus:outline-none focus:ring-blue-500 focus:border-blue-500 sm:text-sm`}
                                placeholder="Enter server path (e.g., /path/to/destination)"
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
                                Download
                            </button>
                        </div>
                    </form>
                </div>
            </div>
        </div>
    );
};

export default SecureDownload;
