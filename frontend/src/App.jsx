import React from 'react'
import './index.css'

function App() {
  return (
    <div className="app">
      <header className="header">
        
        <div className="header-right">
          <img src="/assets/octro-logo.png" alt="Logo" />
        </div>
        <div className="header-left">
          <div>DevOps Engineer</div>
          <div>John Doe</div>
          <button>Logout</button>
        </div>
      </header>

      <main className="main-content">
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