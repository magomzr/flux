export interface User {
  id: string;
  name: string;
  email: string;
  password: string;
  role: string; // un solo rol
  tenantId: string | null; // null = usuario interno tuyo (super_admin, ops)
  isActive: boolean; // para deshabilitar sin borrar
  createdAt: Date;
  lastLoginAt: Date | null;
}
