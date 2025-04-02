interface FooterProps {
  onLogout: () => void;
}

export function Footer({ onLogout }: FooterProps) {
  return (
    <footer className="bg-white border-t border-gray-200 py-4">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 flex justify-between items-center">
        <p className="text-sm text-gray-500">
          © {new Date().getFullYear()} Tape. All rights reserved.
        </p>
        <button
          onClick={onLogout}
          className="text-sm text-gray-500 hover:text-gray-700"
        >
          Logout
        </button>
      </div>
    </footer>
  );
} 