import { mysqlPool } from '../database/config';

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
  try {
    const [rows] = await mysqlPool.query('SELECT * FROM user_groups_table');
    return rows as UserGroup[];
  } catch (error) {
    console.error('Error fetching user roles:', error);
    throw error;
  }
};

// Initialize the roles
export const initializeRoles = async (): Promise<void> => {
  try {
    console.log('Initializing user roles...');
    userRoles = await fetchUserRoles();
    USER_ROLES = userRoles.map(role => role.name);
  } catch (error) {
    console.error('Failed to initialize roles:', error);
    throw error;
  }
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

// Function to refresh roles
export const refreshRoles = async (): Promise<void> => {
  await initializeRoles();
};

// Initialize roles when the module is imported
initializeRoles().catch(error => {
  console.error('Failed to initialize roles during module import:', error);
  // Don't throw here as it would prevent the module from loading
  // Instead, we'll handle the error when roles are actually needed
});

// Export a function to check if roles are initialized
export const areRolesInitialized = (): boolean => {
  return USER_ROLES.length > 0;
};


