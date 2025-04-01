import { useState, useEffect } from 'react';
import { useAuth } from '../contexts/AuthContext';
import axios from 'axios';
import { UsersTable } from '../adminPage/users-table';
import { GroupsTable } from '../adminPage/groups-table';
import { ProcessesTable } from '../adminPage/processes-table';
import { Header } from '../adminPage/header';
import { Footer } from '../adminPage/footer';

interface User {
  id: number;
  name: string;
  email: string;
  role: 'admin' | 'data_team' | 'art_team' | 'user';
  picture?: string;
}

interface Group {
  id: number;
  name: string;
  description: string;
}

interface Process {
  id: number;
  name: string;
  description: string;
  status: 'active' | 'inactive' | 'completed';
}

export default function Admin() {
  const { user, logout } = useAuth();
  const [users, setUsers] = useState<User[]>([]);
  const [groups, setGroups] = useState<Group[]>([]);
  const [processes, setProcesses] = useState<Process[]>([]);
  const [activeTab, setActiveTab] = useState<'users' | 'groups' | 'processes'>('users');

  useEffect(() => {
    fetchData();
  }, []);

  const fetchData = async () => {
    try {
      const [usersRes, groupsRes, processesRes] = await Promise.all([
        axios.get(`${import.meta.env.VITE_API_URL}/api/users`, { withCredentials: true }),
        axios.get(`${import.meta.env.VITE_API_URL}/api/groups`, { withCredentials: true }),
        axios.get(`${import.meta.env.VITE_API_URL}/api/processes`, { withCredentials: true }),
      ]);

      setUsers(usersRes.data);
      setGroups(groupsRes.data);
      setProcesses(processesRes.data);
    } catch (error) {
      console.error('Error fetching data:', error);
    }
  };

  return (
    <div className="min-h-screen bg-gray-50">
      <Header 
        user={user} 
        onLogout={logout}
        activeTab={activeTab}
        setActiveTab={setActiveTab}
      />
      
      <main className="mx-auto max-w-7xl py-6 sm:px-6 lg:px-8">
        <div className="px-4 sm:px-0">
          {activeTab === 'users' && <UsersTable users={users} />}
          {activeTab === 'groups' && <GroupsTable groups={groups} />}
          {activeTab === 'processes' && <ProcessesTable processes={processes} />}
        </div>
      </main>

      <Footer />
    </div>
  );
} 