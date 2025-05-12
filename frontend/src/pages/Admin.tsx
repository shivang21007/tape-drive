import React, { useState, useEffect } from 'react';
import { useAuth } from '../contexts/AuthContext';
import axios from 'axios';
import { useNavigate } from 'react-router-dom';
import { User } from '../types/user';
import { Group } from '../types/group';
// import { Process } from '../types/process';
import { UsersTable } from '../components/admin/UsersTable';
import { GroupsTable } from '../components/admin/GroupsTable';
// import { ProcessesTable } from '../components/admin/ProcessesTable';
import { AddGroupForm } from '../components/admin/AddGroupForm';
// import { AddProcessForm } from '../components/admin/AddProcessForm';
import octroLogo from '../assets/octro-logo.png';
import { isAdminRole} from '../utils/roleValidation';
import { ToastContainer, toast } from 'react-toastify';
import 'react-toastify/dist/ReactToastify.css';

interface Server {
  id: number;
  server_name: string;
  server_ip: string;
  group_name: string;
  updated_at: string;
}

const Admin: React.FC = () => {
  const { user, logout } = useAuth();
  const navigate = useNavigate();
  const [users, setUsers] = useState<User[]>([]);
  const [groups, setGroups] = useState<Group[]>([]);
  // const [processes, setProcesses] = useState<Process[]>([]);
  const [activeTab, setActiveTab] = useState<'users' | 'groups' | 'tape' | 'servers'>('users');
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [showAddGroup, setShowAddGroup] = useState(false);
  // const [showAddProcess, setShowAddProcess] = useState(false);
  const [tapes, setTapes] = useState<any[]>([]);
  const [tapesLoading, setTapesLoading] = useState(false);
  const [tapesError, setTapesError] = useState<string | null>(null);
  const [servers, setServers] = useState<Server[]>([]);
  const [serversLoading, setServersLoading] = useState(false);
  const [serversError, setServersError] = useState<string | null>(null);

  useEffect(() => {
    if (!user || !isAdminRole(user.role)) {
      navigate('/');
      return;
    }

    const fetchData = async () => {
      try {
        setLoading(true);
        const [usersRes, groupsRes] = await Promise.all([
          axios.get(`${import.meta.env.VITE_API_URL}/api/users`, { withCredentials: true }),
          axios.get(`${import.meta.env.VITE_API_URL}/api/groups`, { withCredentials: true }),
          // axios.get(`${import.meta.env.VITE_API_URL}/api/processes`, { withCredentials: true }),
        ]);

        setUsers(usersRes.data);
        setGroups(groupsRes.data);
        // setProcesses(processesRes.data);
      } catch (error) {
        setError('Failed to load data');
        console.error('Error fetching data:', error);
      } finally {
        setLoading(false);
      }
    };

    fetchData();
  }, [user, navigate]);

  // Fetch tapes and groups for tape tab
  useEffect(() => {
    if (activeTab === 'tape') {
      setTapesLoading(true);
      Promise.all([
        axios.get('/api/tapes', { withCredentials: true }),
        axios.get('/api/groups', { withCredentials: true })
      ])
        .then(([tapesRes, groupsRes]) => {
          setTapes(tapesRes.data);
          setGroups(groupsRes.data);
          setTapesError(null);
        })
        .catch((err) => {
          console.error('Error fetching tapes or groups:', err);
          setTapesError('Failed to fetch tapes or groups');
        })
        .finally(() => setTapesLoading(false));
    }
  }, [activeTab]);

  // Fetch servers and groups for servers tab
  useEffect(() => {
    if (activeTab === 'servers') {
      setServersLoading(true);
      Promise.all([
        axios.get('/api/serverinfo', { withCredentials: true }),
        axios.get('/api/groups', { withCredentials: true })
      ])
        .then(([serversRes, groupsRes]) => {
          setServers(serversRes.data);
          setGroups(groupsRes.data);
          setServersError(null);
        })
        .catch((err) => {
          console.error('Error fetching servers or groups:', err);
          setServersError('Failed to fetch servers or groups');
        })
        .finally(() => setServersLoading(false));
    }
  }, [activeTab]);

  const handleRoleChange = async (userId: number, newRole: User['role']) => {
    if (!window.confirm('Are you sure you want to change this user\'s role? This is a critical operation.')) {
      return;
    }
    try {
      const roleName = typeof newRole === 'string' ? newRole : newRole.name;
      
      const response = await fetch(`${import.meta.env.VITE_API_URL}/api/users/${userId}/role`, {
        method: 'PUT',
        headers: {
          'Content-Type': 'application/json',
          'Accept': 'application/json'
        },
        credentials: 'include',
        body: JSON.stringify({ role: roleName })
      });

      if (!response.ok) {
        const errorData = await response.json();
        throw new Error(errorData.message || errorData.error || 'Failed to update role');
      }

      // Update the users list with the new role
      setUsers(prevUsers => 
        prevUsers.map(user => 
          user.id === userId ? { ...user, role: { id: -1, name: roleName, description: roleName } } : user
        )
      );

      // Show success message
      setError(null);
    } catch (err) {
      const errorMessage = err instanceof Error ? err.message : 'Failed to update user role';
      setError(errorMessage);
      console.error('Error updating role:', err);
    }
  };

  const handleAddGroup = async (name: string, description: string) => {
    try {
      const response = await fetch('/api/groups', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Accept': 'application/json'
        },
        credentials: 'include',
        body: JSON.stringify({ name, description })
      });

      if (!response.ok) {
        throw new Error('Failed to create group');
      }

      const newGroup = await response.json();
      setGroups([...groups, newGroup]);
      setShowAddGroup(false);
    } catch (err) {
      setError('Failed to create group');
      console.error('Error creating group:', err);
    }
  };

  const handleLogout = async () => {
    try {
      await logout();
      navigate('/login');
    } catch (err) {
      setError('Failed to logout');
      console.error('Error logging out:', err);
    }
  };

  const handleDeleteGroup = async (group: Group) => {
    if (!window.confirm(`Are you sure you want to delete the group "${group.name}"?`)) return;
    try {
      const response = await fetch(`/api/groups/${group.name}`, {
        method: 'DELETE',
        credentials: 'include',
      });
      if (!response.ok) {
        const data = await response.json();
        if (data && data.error && data.error.includes('users')) {
          toast.error('Group has users, reassign them to new group.');
        } else {
          toast.error(data.error || 'Failed to delete group');
        }
        return;
      }
      setGroups(groups.filter(g => g.id !== group.id));
      toast.success('Group deleted successfully');
    } catch (err) {
      toast.error('Failed to delete group');
      console.error('Error deleting group:', err);
    }
  };

  const handleDeleteUser = async (userToDelete: User) => {
    if (!window.confirm(`Are you sure you want to delete user "${userToDelete.name}"?`)) return;
    try {
      const response = await fetch(`/api/users/${userToDelete.id}`, {
        method: 'DELETE',
        credentials: 'include',
      });
      if (!response.ok) {
        const data = await response.json();
        toast.error(data.error || 'Failed to delete user');
        return;
      }
      setUsers(users.filter(u => u.id !== userToDelete.id));
      toast.success('User deleted successfully');
    } catch (err) {
      toast.error('Failed to delete user');
      console.error('Error deleting user:', err);
    }
  };

  const handleTapeGroupChange = async (tapeId: number, newGroup: string) => {
    if (!window.confirm('Are you sure you want to change this tape\'s group? This is a critical operation.')) {
      return;
    }
    try {
      await axios.put(`/api/tapes/${tapeId}/group`, { group_name: newGroup }, { withCredentials: true });
      setTapes((prev) => prev.map(t => t.id === tapeId ? { ...t, group_name: newGroup } : t));
      toast.success('Tape group updated');
    } catch (err) {
      toast.error('Failed to update tape group');
    }
  };

  const handleServerGroupChange = async (serverId: number, newGroup: string) => {
    if (!window.confirm('Are you sure you want to change this server\'s group? This is a critical operation.')) {
      return;
    }
    try {
      await axios.put(`/api/serverinfo/${serverId}/group`, { group_name: newGroup }, { withCredentials: true });
      setServers((prev) => prev.map(s => s.id === serverId ? { ...s, group_name: newGroup } : s));
      toast.success('Server group updated');
    } catch (err) {
      toast.error('Failed to update server group');
    }
  };

  if (loading) {
    return (
      <div className="min-h-screen bg-gray-100 p-8">
        <div className="max-w-7xl mx-auto">
          <div className="text-center">Loading...</div>
        </div>
      </div>
    );
  }

  if (error) {
    return (
      <div className="min-h-screen bg-gray-100 p-8">
        <div className="max-w-7xl mx-auto">
          <div className="bg-red-50 border border-red-200 text-red-700 px-4 py-3 rounded relative" role="alert">
            <span className="block sm:inline">{error}</span>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen flex flex-col">
      <header className="header bg-white shadow-sm py-4 px-6 border-b border-black">
        <div className="header-right">
          <img src={octroLogo} alt="Octro Logo" className="h-8" />
        </div>
        <div className="header-left">
          <div className="flex items-center space-x-4">
            <button
              onClick={() => navigate('/')}
              className="rounded-md bg-gray-800 px-4 py-2 text-sm font-medium text-white transition-colors hover:bg-gray-700"
            >
              Home
            </button>
            <button
              onClick={handleLogout}
              className="rounded-md bg-gray-800 px-4 py-2 text-sm font-medium text-white transition-colors hover:bg-gray-700"
            >
              Logout
            </button>
          </div>
        </div>
      </header>

      <main className="flex-1 bg-gray-50">
        <div className="max-w-7xl mx-auto">
          <div className="flex space-x-8 mb-8">
            <button
              onClick={() => setActiveTab("users")}
              className={`px-6 py-2 rounded-lg transition-all duration-200 font-medium
                ${activeTab === "users" 
                  ? "bg-[#2c455c] text-white shadow-lg transform -translate-y-0.5" 
                  : "text-gray-600 hover:bg-gray-100"}`}
            >
              Users
            </button>
            <button
              onClick={() => setActiveTab("groups")}
              className={`px-6 py-2 rounded-lg transition-all duration-200 font-medium
                ${activeTab === "groups" 
                  ? "bg-[#2c455c] text-white shadow-lg transform -translate-y-0.5" 
                  : "text-gray-600 hover:bg-gray-100"}`}
            >
              Groups
            </button>
            <button
              onClick={() => setActiveTab("tape")}
              className={`px-6 py-2 rounded-lg transition-all duration-200 font-medium
                ${activeTab === "tape" 
                  ? "bg-[#2c455c] text-white shadow-lg transform -translate-y-0.5" 
                  : "text-gray-600 hover:bg-gray-100"}`}
            >
              Tapes
            </button>
            <button
              onClick={() => setActiveTab("servers")}
              className={`px-6 py-2 rounded-lg transition-all duration-200 font-medium
                ${activeTab === "servers" 
                  ? "bg-[#2c455c] text-white shadow-lg transform -translate-y-0.5" 
                  : "text-gray-600 hover:bg-gray-100"}`}
            >
              Servers
            </button>
          </div>

          {activeTab === 'users' && <UsersTable users={users} onRoleChange={handleRoleChange} onDeleteUser={handleDeleteUser} />}
          {activeTab === 'groups' && (
            <div>
              <div className="mb-4">
                <button
                  onClick={() => setShowAddGroup(true)}
                  className="bg-blue-500 text-white px-4 py-2 rounded hover:bg-blue-600"
                >
                  Add Group
                </button>
              </div>
              <GroupsTable groups={groups} onDeleteGroup={handleDeleteGroup} />
              {showAddGroup && (
                <AddGroupForm
                  onAddGroup={handleAddGroup}
                  onCancel={() => setShowAddGroup(false)}
                />
              )}
            </div>
          )}
          {activeTab === 'tape' && (
            <div>
              <h2 className="text-2xl font-semibold text-blue-900 mb-4">Tape Management</h2>
              {tapesLoading ? (
                <div>Loading tapes...</div>
              ) : tapesError ? (
                <div className="text-red-600">{tapesError}</div>
              ) : (
                <div className="overflow-x-auto">
                  <table className="min-w-full divide-y divide-gray-200 bg-white shadow rounded-lg">
                    <thead className="bg-gray-700">
                      <tr>
                        <th className="px-6 py-3 text-left text-xs font-medium text-white uppercase tracking-wider">ID</th>
                        <th className="px-6 py-3 text-left text-xs font-medium text-white uppercase tracking-wider">Tape No</th>
                        <th className="px-6 py-3 text-left text-xs font-medium text-white uppercase tracking-wider">Group</th>
                        <th className="px-6 py-3 text-left text-xs font-medium text-white uppercase tracking-wider">Total Size</th>
                        <th className="px-6 py-3 text-left text-xs font-medium text-white uppercase tracking-wider">Used Size</th>
                        <th className="px-6 py-3 text-left text-xs font-medium text-white uppercase tracking-wider">Available Size</th>
                        <th className="px-6 py-3 text-left text-xs font-medium text-white uppercase tracking-wider">Usage %</th>
                        <th className="px-6 py-3 text-left text-xs font-medium text-white uppercase tracking-wider">Last Updated</th>
                      </tr>
                    </thead>
                    <tbody className="bg-white divide-y divide-gray-200">
                      {tapes.map((tape) => (
                        <tr key={tape.id}>
                          <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-900">{tape.id}</td>
                          <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-900">{tape.tape_no}</td>
                          <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-900">
                            <select
                              value={tape.group_name}
                              onChange={e => handleTapeGroupChange(tape.id, e.target.value)}
                              className="block w-full px-2 py-1 border border-gray-300 rounded-md focus:outline-none focus:ring-blue-500 focus:border-blue-500"
                            >
                              {groups.map(g => (
                                <option key={g.name} value={g.name}>{g.name}</option>
                              ))}
                            </select>
                          </td>
                          <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-900">{tape.total_size}</td>
                          <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-900">{tape.used_size}</td>
                          <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-900">{tape.available_size}</td>
                          <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-900">{tape.usage_percentage}%</td>
                          <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-900">{new Date(tape.updated_at).toLocaleString()}</td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              )}
            </div>
          )}
          {activeTab === 'servers' && (
            <div>
              <h2 className="text-2xl font-semibold text-blue-900 mb-4">Server Management</h2>
              {serversLoading ? (
                <div>Loading servers...</div>
              ) : serversError ? (
                <div className="text-red-600">{serversError}</div>
              ) : (
                <div className="overflow-x-auto">
                  <table className="min-w-full divide-y divide-gray-200 bg-white shadow rounded-lg">
                    <thead className="bg-gray-700">
                      <tr>
                        <th className="px-6 py-3 text-left text-xs font-medium text-white uppercase tracking-wider">ID</th>
                        <th className="px-6 py-3 text-left text-xs font-medium text-white uppercase tracking-wider">Server Name</th>
                        <th className="px-6 py-3 text-left text-xs font-medium text-white uppercase tracking-wider">Server IP</th>
                        <th className="px-6 py-3 text-left text-xs font-medium text-white uppercase tracking-wider">Group</th>
                        <th className="px-6 py-3 text-left text-xs font-medium text-white uppercase tracking-wider">Last Updated</th>
                      </tr>
                    </thead>
                    <tbody className="bg-white divide-y divide-gray-200">
                      {servers.map((server) => (
                        <tr key={server.id}>
                          <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-900">{server.id}</td>
                          <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-900">{server.server_name}</td>
                          <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-900">{server.server_ip}</td>
                          <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-900">
                            <select
                              value={server.group_name}
                              onChange={e => handleServerGroupChange(server.id, e.target.value)}
                              className="block w-full px-2 py-1 border border-gray-300 rounded-md focus:outline-none focus:ring-blue-500 focus:border-blue-500"
                            >
                              {groups.map(g => (
                                <option key={g.name} value={g.name}>{g.name}</option>
                              ))}
                            </select>
                          </td>
                          <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-900">{new Date(server.updated_at).toLocaleString()}</td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              )}
            </div>
          )}
          <ToastContainer position="top-right" autoClose={3000} hideProgressBar={false} newestOnTop closeOnClick rtl={false} pauseOnFocusLoss draggable pauseOnHover />
        </div>
      </main>
    </div>
  );
};

export default Admin;