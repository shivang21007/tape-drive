import { UserRole } from '../utils/roleValidation';

export interface User {
  id: number;
  name: string;
  email: string;
  role: UserRole;
  google_id: string;
} 