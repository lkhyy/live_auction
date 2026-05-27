import type { UserRole } from '../schemas/auth';

export interface MeProfile {
  id: string;
  email: string;
  role: UserRole;
  displayName: string;
  createdAt: string;
}
