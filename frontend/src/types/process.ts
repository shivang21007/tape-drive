export interface Process {
  id: number;
  name: string;
  description: string;
  status: 'active' | 'inactive' | 'completed';
} 