import React, { useState, useEffect } from 'react';
import { User } from '../../types/user';
import { UserGroup, getAvailableRoles } from '../../utils/roleValidation';
import { MdDeleteForever } from 'react-icons/md';

interface UsersTableProps {
  users: User[];
  onRoleChange: (userId: number, newRole: UserGroup) => void;
  onDeleteUser?: (user: User) => void;
}

export const UsersTable: React.FC<UsersTableProps> = ({ users, onRoleChange, onDeleteUser }) => {
  const [availableRoles, setAvailableRoles] = useState<UserGroup[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    const fetchRoles = async () => {
      try {
        setLoading(true);
        const roles = await getAvailableRoles();
        setAvailableRoles(roles);
        setError(null);
      } catch (err) {
        setError('Failed to load available roles');
        console.error('Error loading roles:', err);
      } finally {
        setLoading(false);
      }
    };
    fetchRoles();
  }, []);

  const handleRoleChange = (userId: number, roleName: string) => {
    const selectedRole = availableRoles.find(role => role.name === roleName);
    if (selectedRole) {
      onRoleChange(userId, selectedRole);
    }
  };

  if (loading) {
    return <div className="text-center py-4">Loading roles...</div>;
  }

  if (error) {
    return <div className="text-center text-red-600 py-4">{error}</div>;
  }

  return (
    <div className="overflow-x-auto">
      <table className="min-w-full divide-y divide-gray-200">
        <thead className="bg-gray-50">
          <tr>
            <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Name</th>
            <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Email</th>
            <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Role</th>
            <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Remove</th>
          </tr>
        </thead>
        <tbody className="bg-white divide-y divide-gray-200">
          {users.map((user) => {
            const currentRoleName = typeof user.role === 'string' ? user.role : user.role.name;
            const currentRole = availableRoles.find(r => r.name === currentRoleName);

            return (
              <tr key={user.id}>
                <td className="px-6 py-4 whitespace-nowrap">
                  <div className="flex items-center">
                    <div className="ml-4">
                      <div className="text-sm font-medium text-gray-900">{user.name}</div>
                    </div>
                  </div>
                </td>
                <td className="px-6 py-4 whitespace-nowrap">
                  <div className="text-sm text-gray-900">{user.email}</div>
                </td>
                <td className="px-6 py-4 whitespace-nowrap text-sm font-medium">
                  <select
                    value={currentRole?.name || ''}
                    onChange={(e) => handleRoleChange(user.id, e.target.value)}
                    className="mt-1 block w-full pl-3 pr-10 py-2 text-base border-gray-300 focus:outline-none focus:ring-blue-500 focus:border-blue-500 sm:text-sm rounded-md"
                  >
                    {availableRoles.map((role) => (
                      <option key={role.name} value={role.name}>
                        {role.name}
                      </option>
                    ))}
                  </select>
                </td>
                <td className="px-6 py-4 whitespace-nowrap text-sm font-medium">
                  {onDeleteUser && (
                    <button
                      className="ml-6 rounded-md px-3 py-2 bg-gradient-to-br from-red-500 to-red-600 hover:from-red-600 hover:to-red-700 flex items-center justify-center transition-all duration-200 shadow-sm hover:shadow-md min-w-[44px]"
                      title="Delete user"
                      onClick={() => onDeleteUser(user)}
                    >
                      <MdDeleteForever size={24} className="text-red-50" />
                    </button>
                  )}
                </td>
              </tr>
            );
          })}
        </tbody>
      </table>
    </div>
  );
}; 