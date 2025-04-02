import React, { useState, useEffect } from 'react';
import { useAuth } from '../contexts/AuthContext';
import { useNavigate } from 'react-router-dom';
import { User } from '../types/user';
import { Group } from '../types/group';
import { Process } from '../types/process';
import { UsersTable } from '../components/admin/UsersTable';
import { GroupsTable } from '../components/admin/GroupsTable';
import { ProcessesTable } from '../components/admin/ProcessesTable';
import { AddGroupForm } from '../components/admin/AddGroupForm';
import { AddProcessForm } from '../components/admin/AddProcessForm';

const Admin: React.FC = () => {
  const { user, logout } = useAuth();
  const navigate = useNavigate();
  const [users, setUsers] = useState<User[]>([]);
  const [groups, setGroups] = useState<Group[]>([]);
  const [processes, setProcesses] = useState<Process[]>([]);
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
        const [usersRes, groupsRes, processesRes] = await Promise.all([
          fetch('/api/users', {
            credentials: 'include',
            headers: {
              'Accept': 'application/json'
            }
          }),
          fetch('/api/groups', {
            credentials: 'include',
            headers: {
              'Accept': 'application/json'
            }
          }),
          fetch('/api/processes', {
            credentials: 'include',
            headers: {
              'Accept': 'application/json'
            }
          })
        ]);

        if (!usersRes.ok || !groupsRes.ok || !processesRes.ok) {
          throw new Error('Failed to fetch data');
        }

        const [usersData, groupsData, processesData] = await Promise.all([
          usersRes.json(),
          groupsRes.json(),
          processesRes.json()
        ]);

        setUsers(usersData);
        setGroups(groupsData);
        setProcesses(processesData);
      } catch (err) {
        setError('Failed to load data');
        console.error('Error fetching data:', err);
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
    <div className="min-h-screen bg-gray-100">
      {/* Navigation Header */}
      <nav className="bg-white shadow-sm">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="flex justify-between h-16">
            <div className="flex items-center">
              <button
                onClick={() => navigate('/')}
                className="px-4 py-2 text-sm font-medium text-gray-700 hover:text-gray-900 focus:outline-none"
              >
                Home
              </button>
            </div>
            <div className="flex items-center">
              <span className="mr-4 text-sm text-gray-700">Welcome, {user?.name}</span>
              <button
                onClick={handleLogout}
                className="px-4 py-2 text-sm font-medium text-white bg-red-600 rounded-md hover:bg-red-700 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-red-500"
              >
                Logout
              </button>
            </div>
          </div>
        </div>
      </nav>

      {/* Main Content */}
      <div className="max-w-7xl mx-auto py-6 sm:px-6 lg:px-8">
        <div className="space-y-8">
          <div className="bg-white rounded-lg shadow p-6">
            <h2 className="text-2xl font-bold mb-4">Users</h2>
            <UsersTable users={users} onRoleChange={handleRoleChange} />
          </div>

          <div className="bg-white rounded-lg shadow p-6">
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
          </div>

          <div className="bg-white rounded-lg shadow p-6">
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
          </div>
        </div>
      </div>
    </div>
  );
};

export default Admin;