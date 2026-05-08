import { SetMetadata } from '@nestjs/common';
import { Perm } from '../config/roles.config';

export const PERMISSIONS_KEY = 'permissions';

export const RequirePerms = (...perms: Perm[]) =>
  SetMetadata(PERMISSIONS_KEY, perms);
