import { User } from '../types/user';
import { getApiUrl } from '../config';

// Interface for user groups
export interface UserGroup {
  name: string;
  description: string;
}

let USER_ROLES: UserGroup[] = [];

// Function to check if a role is valid
export const isValidRole = (role: UserGroup | string | undefined): boolean => {
  if (!role) return false;
  const roleName = typeof role === 'string' ? role : role.name;
  return USER_ROLES.some(r => r.name === roleName);
};

// Function to check if user is admin
export const isAdminRole = (role: UserGroup | string | undefined): boolean => {
  if (!role) return false;
  const roleName = typeof role === 'string' ? role : role.name;
  return roleName === 'admin';
};

// Function to check if user is a regular user
export const isUserRole = (role: UserGroup | string | undefined): boolean => {
  if (!role) return false;
  const roleName = typeof role === 'string' ? role : role.name;
  return roleName === 'user';
};

// Function to get priority based on role
export const getPriority = (role: UserGroup | string | undefined): number => {
  return isAdminRole(role) ? 1 : 2;
};

// Function to check if user can access a specific group
export const canAccessGroup = (user: User | null, groupName: string): boolean => {
  if (!user) return false;
  if (isAdminRole(user.role)) return true;
  const userRoleName = typeof user.role === 'string' ? user.role : user.role.name;
  return userRoleName === groupName;
};

// Function to get available roles from user groups
export const getAvailableRoles = async (): Promise<UserGroup[]> => {
  try {
    // Always use the groups endpoint for admin page
    const response = await fetch(getApiUrl('/api/groups'), {
      credentials: 'include'
    });
    if (!response.ok) {
      throw new Error('Failed to fetch groups');
    }
    const roles = await response.json();
    // Update the USER_ROLES array with the fetched roles
    USER_ROLES = roles;
    return roles;
  } catch (error) {
    console.error('Error fetching groups:', error);
    return [];
  }
};

// Function to validate a role
export const validateRole = async (role: string): Promise<boolean> => {
  try {
    const response = await fetch(getApiUrl(`/api/validate-role/${role}`), {
      credentials: 'include'
    });
    if (!response.ok) {
      return false;
    }
    const data = await response.json();
    return data.isValid;
  } catch (error) {
    console.error('Error validating role:', error);
    return false;
  }
};

export const initializeRoles = async (): Promise<void> => {
  USER_ROLES = await getAvailableRoles();
};

// Initialize roles on module load
initializeRoles().catch(console.error);

// Helper function to convert string role to UserGroup
export const convertToUserGroup = (role: string | UserGroup): UserGroup => {
  if (typeof role === 'string') {
    const foundRole = USER_ROLES.find(r => r.name === role);
    if (foundRole) {
      return foundRole;
    }
    // Return a default role if not found
    return {
      name: role,
      description: role
    };
  }
  return role;
};

export type UserRole = UserGroup; 