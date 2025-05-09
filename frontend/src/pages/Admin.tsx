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

const Admin: React.FC = () => {
  const { user, logout } = useAuth();
  const navigate = useNavigate();
  const [users, setUsers] = useState<User[]>([]);
  const [groups, setGroups] = useState<Group[]>([]);
  // const [processes, setProcesses] = useState<Process[]>([]);
  const [activeTab, setActiveTab] = useState<'users' | 'groups' | 'processes'>('users');
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [showAddGroup, setShowAddGroup] = useState(false);
  // const [showAddProcess, setShowAddProcess] = useState(false);

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

  const handleRoleChange = async (userId: number, newRole: User['role']) => {
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
            {/* <button
              onClick={() => setActiveTab("processes")}
              className={`px-6 py-2 rounded-lg transition-all duration-200 font-medium
                ${activeTab === "processes" 
                  ? "bg-[#2c455c] text-white shadow-lg transform -translate-y-0.5" 
                  : "text-gray-600 hover:bg-gray-100"}`}
            >
              Processes
            </button> */}
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
          {/* {activeTab === 'processes' && (
            <div>
              <div className="mb-4">
                <button
                  onClick={() => setShowAddProcess(true)}
                  className="bg-blue-500 text-white px-4 py-2 rounded hover:bg-blue-600"
                >
                  Add Process
                </button>
              </div>
              <ProcessesTable processes={processes} />
              {showAddProcess && (
                <AddProcessForm
                  onAdd={handleAddProcess}
                  onCancel={() => setShowAddProcess(false)}
                />
              )}
            </div>
          )} */}
          <ToastContainer position="top-right" autoClose={3000} hideProgressBar={false} newestOnTop closeOnClick rtl={false} pauseOnFocusLoss draggable pauseOnHover />
        </div>
      </main>
    </div>
  );
};

export default Admin;