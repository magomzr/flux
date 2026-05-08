// *_WRITE funciona para insertar y actualizar (update)
export enum Perm {
  // Flags
  FLAG_READ = 'read:flag',
  FLAG_WRITE = 'write:flag',
  FLAG_PUBLISH = 'publish:flag', // activar/desactivar en producción

  // Projects
  PROJECT_READ = 'read:project',
  PROJECT_WRITE = 'write:project',

  // Environments
  ENVIRONMENT_READ = 'read:environment',
  ENVIRONMENT_WRITE = 'write:environment',

  // Assets
  ASSETS_READ = 'read:asset',
  ASSETS_WRITE = 'write:asset',

  // Billing
  BILLING_READ = 'read:billing',
  BILLING_WRITE = 'write:billing',

  // Tenants (sólo admin/internal)
  TENANT_READ = 'read:tenant',
  TENANT_INSERT = 'insert:tenants',
  TENANT_UPDATE = 'update:tenant',
  TENANT_DELETE = 'delete:tenant',

  // Audit
  AUDIT_READ = 'read:audit',
}

export const ROLE_PERMISSIONS: Record<string, Perm[]> = {
  // De nuestro lado, acceso total a todo.
  super_admin: Object.values(Perm),

  // Dueño del tenant. Acceso total dentro de su tenant.
  tenant_admin: [
    Perm.FLAG_READ,
    Perm.FLAG_WRITE,
    Perm.FLAG_PUBLISH,
    Perm.PROJECT_READ,
    Perm.PROJECT_WRITE,
    Perm.ENVIRONMENT_READ,
    Perm.ENVIRONMENT_WRITE,
    Perm.ASSETS_READ,
    Perm.ASSETS_WRITE,
    Perm.BILLING_READ,
    Perm.BILLING_WRITE,
    Perm.AUDIT_READ,
  ],

  // Desarrollador del cliente. Gestión de flags sin billing ni tenants.
  developer: [
    Perm.FLAG_READ,
    Perm.FLAG_WRITE,
    Perm.FLAG_PUBLISH,
    Perm.PROJECT_READ,
    Perm.ENVIRONMENT_READ,
    Perm.ASSETS_READ,
    Perm.ASSETS_WRITE,
    Perm.AUDIT_READ,
  ],

  // Ver y editar flags pero no publicar a producción.
  editor: [
    Perm.FLAG_READ,
    Perm.FLAG_WRITE,
    Perm.PROJECT_READ,
    Perm.ENVIRONMENT_READ,
    Perm.ASSETS_READ,
    Perm.ASSETS_WRITE,
  ],

  // Readonly. Stakeholders que quieran ver el estado.
  viewer: [
    Perm.FLAG_READ,
    Perm.PROJECT_READ,
    Perm.ENVIRONMENT_READ,
    Perm.ASSETS_READ,
    Perm.BILLING_READ,
  ],

  // Rol interno de la empresa.
  ops: [
    Perm.TENANT_READ,
    Perm.BILLING_READ,
    Perm.AUDIT_READ,
    Perm.FLAG_READ,
    Perm.PROJECT_READ,
  ],
};
