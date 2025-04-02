export interface User {
  id: number;
  name: string;
  email: string;
  role: 'admin' | 'data_team' | 'art_team' | 'user';
  picture?: string;
  google_id: string;
} 