import { UserRole } from '../utils/roleValidation';

export interface User {
  id: number;
  name: string;
  email: string;
  role: UserRole;
  picture?: string;
  google_id: string;
} 