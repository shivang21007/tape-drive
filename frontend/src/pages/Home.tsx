import React from 'react';
import { useAuth } from '../contexts/AuthContext';
import octroLogo from '../assets/octro-logo.png';

const Home: React.FC = () => {
  const { user, logout } = useAuth();

  return (
    <div className="app">
      <header className="header">
        <div className="header-right">
          <img src={octroLogo} alt="Octro Logo" />
        </div>
        <div className="header-left">
          <div className="flex items-center space-x-3">
            {user?.picture && (
              <img
                src={user.picture}
                alt="User"
                className="h-10 w-10 rounded-full border-2 border-gray-200"
              />
            )}
            <div className="flex flex-col">
              <div className="text-lg font-medium">{user?.role || 'User'}</div>
              <div className="text-sm text-gray-600">{user?.name || 'User'}</div>
            </div>
          </div>
          <button 
            onClick={logout}
            className="ml-4 rounded-md bg-gray-800 px-4 py-2 text-sm font-medium text-white transition-colors hover:bg-gray-700"
          >
            Logout
          </button>
        </div>
      </header>

      <main className="main-content">
        <h1>TapeX</h1>
        <h4>Tape Management demystified</h4>
        <div className="button-group">
          <button>Upload</button>
          <button>View</button>
          <button>Download</button>
        </div>
        <div className="file-input-container">
          <button>Choose File</button>
        </div>
      </main>

      <footer className="footer">
        Made with <span className="heart">❤</span> by DevOps Team
      </footer>
    </div>
  );
};

export default Home; 