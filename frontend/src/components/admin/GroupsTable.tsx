import React from 'react';
import { Group } from '../../types/group';

interface GroupsTableProps {
  groups: Group[];
}

export const GroupsTable: React.FC<GroupsTableProps> = ({ groups }) => {
  return (
    <div className="overflow-x-auto">
      <table className="min-w-full divide-y divide-gray-200">
        <thead className="bg-gray-50">
          <tr>
            <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Name</th>
            <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Description</th>
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
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}; 