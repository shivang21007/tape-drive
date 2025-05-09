import React from 'react';
import { Group } from '../../types/group';

interface GroupsTableProps {
  groups: Group[];
  onDeleteGroup?: (group: Group) => void;
}

export const GroupsTable: React.FC<GroupsTableProps> = ({ groups, onDeleteGroup }) => {
  return (
    <div className="overflow-x-auto">
      <table className="min-w-full divide-y divide-gray-200">
        <thead className="bg-gray-50">
          <tr>
            <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Name</th>
            <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Description</th>
            <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Actions</th>
          </tr>
        </thead>
        <tbody className="bg-white divide-y divide-gray-200">
          {groups.map((group) => (
            <tr key={group.id}>
              <td className="px-6 py-4 whitespace-nowrap">
                <div className="text-sm font-medium text-gray-900">{group.name}</div>
              </td>
              <td className="px-6 py-4">
                <div className="text-sm text-gray-900">{group.description}</div>
              </td>
              <td className="px-6 py-4">
                {onDeleteGroup && (
                  <button
                    className="rounded-md px-4 py-2 font-extrabold"
                    style={{
                      background: 'linear-gradient(135deg, #ef4444, #dc2626)',
                      marginLeft: '0.25rem',
                      display: 'flex',
                      alignItems: 'center',
                      justifyContent: 'center',
                      color: '#fff',
                    }}
                    title="Delete group"
                    onClick={() => onDeleteGroup(group)}
                  >
                    Delete
                  </button>
                )}
              </td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}; 