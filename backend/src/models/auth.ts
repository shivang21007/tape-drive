import { mysqlPool } from '../database';

// Define the interface for user group
interface UserGroup {
  id: number;
  name: string;
  description: string;
  created_at: Date;
  updated_at: Date;
}

// Initialize roles array
let USER_ROLES: string[] = [];
let userRoles: UserGroup[] = [];

// Fetch user roles from database
const fetchUserRoles = async (): Promise<UserGroup[]> => {
  const [rows] = await mysqlPool.query('SELECT * FROM user_groups_table');
  return rows as UserGroup[];
};

// Initialize the roles
export const initializeRoles = async (): Promise<void> => {
  userRoles = await fetchUserRoles();
  USER_ROLES = userRoles.map( role => role.name);
};

// Export the roles array for runtime use
export const getAvailableRoles = (): string[] => [...USER_ROLES];

// Export a function to check if a role is valid
export const isValidRole = (role: string): boolean => {
  // if (role === 'user') return false;
  return USER_ROLES.includes(role) ;
};

// Export a function to get role description
export const getRoleDescription = (role: string): string => {
  const foundRole = userRoles.find(r => r.name === role);
  return foundRole?.description || '';
};

// Create a type-safe UserRole type
export type UserRole = typeof USER_ROLES[number];

// Initialize roles when the module is imported
initializeRoles().catch(console.error);


