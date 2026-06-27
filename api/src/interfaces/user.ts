export interface User {
  id: string;
  name: string;
  email: string;
  password: string;
  role: string;
  tenantId: string | null;
  isActive: boolean;
  createdAt: Date;
  lastLoginAt: Date | null;
}
