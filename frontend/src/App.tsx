import React from 'react'
import './index.css'
import octroLogo from './assets/octro-logo.png'

const App: React.FC = () => {
  return (
    <div className="app">
      <header className="header">
        <div className="header-right">
          <img src={octroLogo} alt="Octro Logo" />
        </div>
        <div className="header-left">
          <div>DevOps Engineer</div>
          <div>John Doe</div>
          <button>Logout</button>
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
  )
}

export default App
