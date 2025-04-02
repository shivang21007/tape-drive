import React, { useState, useEffect } from 'react';
import { useAuth } from '../contexts/AuthContext';
import axios from 'axios';
import { useNavigate } from 'react-router-dom';
import { User } from '../types/user';
import { Group } from '../types/group';
import { Process } from '../types/process';
import { UsersTable } from '../components/admin/UsersTable';
import { GroupsTable } from '../components/admin/GroupsTable';
import { ProcessesTable } from '../components/admin/ProcessesTable';
import { AddGroupForm } from '../components/admin/AddGroupForm';
import { AddProcessForm } from '../components/admin/AddProcessForm';
import octroLogo from '../assets/octro-logo.png';

const Admin: React.FC = () => {
  const { user, logout } = useAuth();
  const navigate = useNavigate();
  const [users, setUsers] = useState<User[]>([]);
  const [groups, setGroups] = useState<Group[]>([]);
  const [processes, setProcesses] = useState<Process[]>([]);
  const [activeTab, setActiveTab] = useState<'users' | 'groups' | 'processes'>('users');
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [showAddGroup, setShowAddGroup] = useState(false);
  const [showAddProcess, setShowAddProcess] = useState(false);

  useEffect(() => {
    if (!user || user.role !== 'admin') {
      navigate('/');
      return;
    }

    const fetchData = async () => {
      try {
        setLoading(true);
        const [usersRes, groupsRes, processesRes] = await Promise.all([
          axios.get(`${import.meta.env.VITE_API_URL}/api/users`, { withCredentials: true }),
          axios.get(`${import.meta.env.VITE_API_URL}/api/groups`, { withCredentials: true }),
          axios.get(`${import.meta.env.VITE_API_URL}/api/processes`, { withCredentials: true }),
        ]);

        setUsers(usersRes.data);
        setGroups(groupsRes.data);
        setProcesses(processesRes.data);
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
      const response = await fetch(`/api/users/${userId}/role`, {
        method: 'PUT',
        headers: {
          'Content-Type': 'application/json',
          'Accept': 'application/json'
        },
        credentials: 'include',
        body: JSON.stringify({ role: newRole })
      });

      if (!response.ok) {
        throw new Error('Failed to update role');
      }

      setUsers(users.map(user => 
        user.id === userId ? { ...user, role: newRole } : user
      ));
    } catch (err) {
      setError('Failed to update user role');
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

  const handleAddProcess = async (name: string, description: string) => {
    try {
      const response = await fetch('/api/processes', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Accept': 'application/json'
        },
        credentials: 'include',
        body: JSON.stringify({ name, description })
      });

      if (!response.ok) {
        throw new Error('Failed to create process');
      }

      const newProcess = await response.json();
      setProcesses([...processes, newProcess]);
      setShowAddProcess(false);
    } catch (err) {
      setError('Failed to create process');
      console.error('Error creating process:', err);
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
      <header className="header bg-white shadow-sm py-4 px-6">
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
              onClick={() => setActiveTab("processes")}
              className={`px-6 py-2 rounded-lg transition-all duration-200 font-medium
                ${activeTab === "processes" 
                  ? "bg-[#2c455c] text-white shadow-lg transform -translate-y-0.5" 
                  : "text-gray-600 hover:bg-gray-100"}`}
            >
              Processes
            </button>
          </div>

          {loading ? (
            <div className="flex items-center justify-center h-64">
              <div className="text-lg font-medium text-gray-600">Loading...</div>
            </div>
          ) : (
            <>
              {activeTab === 'users' && <UsersTable users={users} onRoleChange={handleRoleChange} />}
              {activeTab === 'groups' && (
                <>
                  <div className="flex justify-between items-center mb-4">
                    <h2 className="text-2xl font-bold">Groups</h2>
                    <button
                      onClick={() => setShowAddGroup(true)}
                      className="bg-blue-500 text-white px-4 py-2 rounded hover:bg-blue-600"
                    >
                      Add New Group
                    </button>
                  </div>
                  {showAddGroup && (
                    <div className="mb-4">
                      <AddGroupForm
                        onAddGroup={handleAddGroup}
                        onCancel={() => setShowAddGroup(false)}
                      />
                    </div>
                  )}
                  <GroupsTable groups={groups} />
                </>
              )}
              {activeTab === 'processes' && (
                <>
                  <div className="flex justify-between items-center mb-4">
                    <h2 className="text-2xl font-bold">Processes</h2>
                    <button
                      onClick={() => setShowAddProcess(true)}
                      className="bg-blue-500 text-white px-4 py-2 rounded hover:bg-blue-600"
                    >
                      Add New Process
                    </button>
                  </div>
                  {showAddProcess && (
                    <div className="mb-4">
                      <AddProcessForm
                        onAddProcess={handleAddProcess}
                        onCancel={() => setShowAddProcess(false)}
                      />
                    </div>
                  )}
                  <ProcessesTable processes={processes} />
                </>
              )}
            </>
          )}
        </div>
      </main>
    </div>
  );
};

export default Admin;