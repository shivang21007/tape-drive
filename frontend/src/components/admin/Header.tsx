import { Shield } from "lucide-react";

interface HeaderProps {
  user: {
    name: string;
    picture?: string;
  } | null;
  onLogout: () => void;
  activeTab: 'users' | 'groups' | 'processes';
  setActiveTab: (tab: 'users' | 'groups' | 'processes') => void;
}

export function Header({ user, onLogout, activeTab, setActiveTab }: HeaderProps) {
  return (
    <header className="bg-slate-800 text-white p-4">
      <div className="container mx-auto flex justify-between items-center">
        <div className="flex items-center space-x-2">
          <Shield className="h-6 w-6" />
          <h1 className="text-xl font-bold">AdminDash</h1>
        </div>

        <div className="hidden md:flex space-x-4">
          <button
            onClick={() => setActiveTab("users")}
            className={`px-3 py-2 rounded transition-colors ${
              activeTab === "users" 
                ? "bg-slate-700 text-white" 
                : "text-gray-300 hover:bg-slate-700 hover:text-white"
            }`}
          >
            Users
          </button>
          <button
            onClick={() => setActiveTab("groups")}
            className={`px-3 py-2 rounded transition-colors ${
              activeTab === "groups" 
                ? "bg-slate-700 text-white" 
                : "text-gray-300 hover:bg-slate-700 hover:text-white"
            }`}
          >
            Groups
          </button>
          <button
            onClick={() => setActiveTab("processes")}
            className={`px-3 py-2 rounded transition-colors ${
              activeTab === "processes" 
                ? "bg-slate-700 text-white" 
                : "text-gray-300 hover:bg-slate-700 hover:text-white"
            }`}
          >
            Processes
          </button>
        </div>

        <div className="flex items-center space-x-4">
          {user?.picture && (
            <img
              src={user.picture}
              alt={user.name}
              className="h-8 w-8 rounded-full border-2 border-white"
            />
          )}
          <span className="text-sm">{user?.name}</span>
          <button
            onClick={onLogout}
            className="px-3 py-2 rounded bg-red-600 hover:bg-red-700 transition-colors"
          >
            Logout
          </button>
        </div>
      </div>
    </header>
  );
} 