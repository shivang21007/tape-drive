import { UserRole } from '../middleware/auth';

export interface User {
  id: number;
  google_id: string;
  email: string;
  name: string;
  picture?: string;
  role: UserRole;
  created_at: Date;
  updated_at: Date;
} 

export default User;