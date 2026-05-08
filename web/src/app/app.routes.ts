import { Routes } from '@angular/router';
import { authGuard, guestGuard } from './core/auth/auth.guard';

export const routes: Routes = [
  {
    path: 'login',
    canActivate: [guestGuard],
    loadComponent: () =>
      import('./features/login/login').then((m) => m.Login),
  },
  {
    path: '',
    canActivate: [authGuard],
    loadComponent: () =>
      import('./features/shell/shell').then((m) => m.Shell),
    children: [
      {
        path: '',
        pathMatch: 'full',
        redirectTo: 'projects',
      },
      {
        path: 'projects',
        loadComponent: () =>
          import('./features/projects/project-list').then((m) => m.ProjectList),
      },
      {
        path: 'projects/:projectId',
        loadComponent: () =>
          import('./features/projects/project-detail').then((m) => m.ProjectDetail),
        children: [
          {
            path: '',
            pathMatch: 'full',
            redirectTo: 'flags',
          },
          {
            path: 'flags',
            loadComponent: () =>
              import('./features/flags/flag-list').then((m) => m.FlagList),
          },
          {
            path: 'environments',
            loadComponent: () =>
              import('./features/environments/environment-list').then((m) => m.EnvironmentList),
          },
          {
            path: 'sdk-keys',
            loadComponent: () =>
              import('./features/sdk-keys/sdk-key-list').then((m) => m.SdkKeyList),
          },
        ],
      },
      {
        path: 'billing',
        loadComponent: () =>
          import('./features/billing/billing').then((m) => m.Billing),
      },
      {
        path: 'audit',
        loadComponent: () =>
          import('./features/audit/audit-log').then((m) => m.AuditLog),
      },
      {
        path: 'tenants',
        loadComponent: () =>
          import('./features/tenants/tenant-list').then((m) => m.TenantList),
      },
    ],
  },
  {
    path: '**',
    redirectTo: '',
  },
];
