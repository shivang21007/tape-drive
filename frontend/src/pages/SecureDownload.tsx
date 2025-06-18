import React, { useState, useEffect } from 'react';
import axios from 'axios';
import { toast, ToastContainer } from 'react-toastify';
import { useNavigate, useLocation } from 'react-router-dom';

interface Server {
  server_name: string;
  server_ip: string;
  group_name: string;
}

const SecureDownload: React.FC = () => {
    const location = useLocation();
    const navigate = useNavigate();
    const searchParams = new URLSearchParams(location.search);
    const fileId = searchParams.get('fileId') || '';
    const fileName = searchParams.get('fileName') || '';

    const [servers, setServers] = useState<Server[]>([]);
    const [selectedServer, setSelectedServer] = useState('');
    const [serverPath, setServerPath] = useState('');
    const [error, setError] = useState('');
    const [pathError, setPathError] = useState('');
    const [isLoading, setIsLoading] = useState(true); // Added isLoading state

    // New states for SSH Username selection
    const [selectedUsername, setSelectedUsername] = useState('');
    const [showOtherUsername, setShowOtherUsername] = useState(false);
    const [otherUsernameInput, setOtherUsernameInput] = useState('');
    const [usernameDropdownValue, setUsernameDropdownValue] = useState('');

    useEffect(() => {
        const fetchServers = async () => {
            setIsLoading(true); // Set loading to true when fetching starts
            setError(''); // Clear previous errors
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
                setIsLoading(false); // Set loading to false when fetching ends
            }
        };

        fetchServers();
    }, []);

    const validatePath = (path: string): boolean => {
        // Check if path contains any special characters or spaces
        const specialChars = [':', '*', '?', '<', '>', '|', ';', '&', '@', '%', '!', '#', '^', ' '];
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

    // Handlers for SSH Username selection
    const handleUsernameDropdownChange = (e: React.ChangeEvent<HTMLSelectElement>) => {
        const value = e.target.value;
        setUsernameDropdownValue(value);
        setShowOtherUsername(value === 'other');

        if (value !== 'other') {
            setSelectedUsername(value);
            setOtherUsernameInput('');
        } else {
            setSelectedUsername(otherUsernameInput); // Initially use current otherUsernameInput
        }
    };

    const handleOtherUsernameInputChange = (e: React.ChangeEvent<HTMLInputElement>) => {
        const value = e.target.value;
        setOtherUsernameInput(value);
        setSelectedUsername(value);
    };


    const handleSubmit = async (e: React.FormEvent) => {
        e.preventDefault();
        setError('');

        const downloadToastId = toast.loading('Initiating download...', {
            position: "top-right",
        });

        // Validate username
        if (!selectedUsername || selectedUsername.trim() === '') {
            setError('Please select or enter a valid SSH username');
            toast.update(downloadToastId, {
                render: 'Please select or enter a valid SSH username',
                type: 'error',
                isLoading: false,
                autoClose: 3000,
            });
            return;
        }

        if (!fileId || !fileName || !selectedServer || !serverPath) {
            setError('Please fill all fields');
            toast.update(downloadToastId, {
                render: 'Please fill all fields',
                type: 'error',
                isLoading: false,
                autoClose: 3000,
            });
            return;
        }

        if (!validatePath(serverPath)) {
            setError('Invalid server path');
            toast.update(downloadToastId, {
                render: 'Invalid server path',
                type: 'error',
                isLoading: false,
                autoClose: 3000,
            });
            return;
        }

        try {
            const response = await axios.post('/api/securedownload', {
                fileId: fileId,
                fileName: fileName,
                server: selectedServer,
                filePath: serverPath,
                sshUser: selectedUsername.trim(),
                type: 'download'
            });

            if (response.status === 200) {
                toast.update(downloadToastId, {
                    render: 'Secure download request submitted successfully',
                    type: 'success',
                    isLoading: false,
                    autoClose: 3000,
                });
                // Clear fields only on successful submission
                setSelectedServer('');
                setServerPath('');
                setUsernameDropdownValue('');
                setOtherUsernameInput('');
                setSelectedUsername('');
                setShowOtherUsername(false);

                setTimeout(() => {
                    navigate('/history');
                }, 3000);
            }
        } catch (error) {
            console.error('Error submitting secure download:', error);
            if (axios.isAxiosError(error) && error.response?.status === 400) {
                setError(error.response.data?.error || 'Bad request. Please check your inputs.');
                toast.update(downloadToastId, {
                    render: error.response.data?.error || 'Bad request. Please check your inputs.',
                    type: 'error',
                    isLoading: false,
                    autoClose: 3000,
                });
            } else if (axios.isAxiosError(error) && error.response?.status === 404) {
                setError(error.response.data?.stderr || 'Failed to connect to server. Please check the username and file path.');
                toast.update(downloadToastId, {
                    render: error.response.data?.errMsg || 'Failed to connect to server. Please check the username and file path.',
                    type: 'error',
                    isLoading: false,
                    autoClose: 3000,
                });
            } else {
                setError('Failed to submit secure download request');
                toast.update(downloadToastId, {
                    render: 'Failed to submit secure download request',
                    type: 'error',
                    isLoading: false,
                    autoClose: 3000,
                });
            }
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
                            Download History
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

                        {/* SSH Username Selection */}
                        <div>
                            <label htmlFor="sshUsername" className="block text-sm font-medium text-gray-700 mb-2">
                                SSH Username
                            </label>
                            <div className="flex items-center space-x-2">
                                <select
                                    id="sshUsername"
                                    value={usernameDropdownValue}
                                    onChange={handleUsernameDropdownChange}
                                    className="w-48 pl-3 pr-10 py-2 text-base border-gray-300 focus:outline-none focus:ring-blue-500 focus:border-blue-500 sm:text-sm rounded-md"
                                    required
                                >
                                    <option value="">Select SSH Username</option>
                                    <option value="octro">octro</option>
                                    <option value="hadoop">hadoop</option>
                                    <option value="other">other</option>
                                </select>

                                {showOtherUsername && (
                                    <input
                                        type="text"
                                        id="otherUsername"
                                        value={otherUsernameInput}
                                        onChange={handleOtherUsernameInputChange}
                                        className="w-48 pl-3 pr-10 py-2 text-base border-gray-300 focus:outline-none focus:ring-blue-500 focus:border-blue-500 sm:text-sm rounded-md"
                                        placeholder="Enter custom username"
                                        required
                                    />
                                )}
                            </div>
                        </div>


                        <div>
                            <label htmlFor="serverPath" className="block text-sm font-medium text-gray-700">
                                Server Path (on remote server)
                            </label>
                            <input
                                type="text"
                                id="serverPath"
                                value={serverPath}
                                onChange={handlePathChange}
                                className={`mt-1 block w-full border ${
                                    pathError ? 'border-red-500' : 'border-gray-300'
                                } rounded-md shadow-sm py-2 px-3 focus:outline-none focus:ring-blue-500 focus:border-blue-500 sm:text-sm`}
                                placeholder="Enter server path (e.g., /path/to/source/file)"
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