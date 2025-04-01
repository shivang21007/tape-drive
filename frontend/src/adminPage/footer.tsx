export function Footer() {
  return (
    <footer className="bg-slate-800 text-white p-4">
      <div className="container mx-auto flex flex-col md:flex-row justify-between items-center">
        <div>
          <h2 className="text-lg font-bold">AdminDash</h2>
          <p className="text-sm text-gray-300">Your all-in-one admin management tool.</p>
        </div>
        <div className="flex space-x-4 mt-4 md:mt-0">
          <a href="#" className="text-sm text-gray-300 hover:text-white">
            Privacy Policy
          </a>
          <a href="#" className="text-sm text-gray-300 hover:text-white">
            Terms of Service
          </a>
          <a href="#" className="text-sm text-gray-300 hover:text-white">
            Help Center
          </a>
        </div>
      </div>
    </footer>
  )
}

