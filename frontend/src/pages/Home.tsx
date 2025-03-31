import { useAuth } from '../contexts/AuthContext';

export default function Home() {
  const { user, logout } = useAuth();

  return (
    <div className="min-h-screen bg-gray-100">
      <nav className="bg-white shadow-md">
        <div className="container mx-auto max-w-7xl px-4 sm:px-6 lg:px-8">
          <div className="flex h-16 items-center justify-between">
            <div className="flex items-center">
              <h1 className="text-2xl font-bold text-gray-800">User Dashboard</h1>
            </div>
            <div className="flex items-center space-x-6">
              <div className="flex items-center space-x-3">
                {user?.picture && (
                  <img
                    src={user.picture}
                    className="h-10 w-10 rounded-full border-2 border-gray-200"
                  />
                )}
                <br/>
                <span className="text-lg font-medium text-gray-700">{user?.name}</span>
              </div>
              <button
                onClick={logout}
                className="rounded-md bg-gray-800 px-4 py-2 text-sm font-medium text-white transition-colors hover:bg-gray-700"
              >
                Logout
              </button>
            </div>
          </div>
        </div>
      </nav>

      <main className="container mx-auto max-w-7xl px-4 py-8 sm:px-6 lg:px-8">
        <div className="rounded-xl bg-white p-8 shadow-lg">
          <div className="text-center">
            <h2 className="mb-6 text-3xl font-bold text-green-600">
              🎉 Congratulations!
            </h2>
            <p className="mb-4 text-xl text-gray-700">
              Welcome to your dashboard, {user?.name}
            </p>
            <p className="text-lg text-gray-600">
              You are a member of the <span className="font-medium">{user?.role}</span> group
            </p>
          </div>
        </div>
      </main>
    </div>
  );
} 