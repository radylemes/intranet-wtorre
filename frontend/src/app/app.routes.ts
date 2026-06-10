import { Routes } from '@angular/router';
import { authGuard } from './guards/auth.guard';
import { adminGuard } from './guards/admin.guard';

export const routes: Routes = [
  {
    path: 'login',
    loadComponent: () =>
      import('./pages/login/login.component').then((m) => m.LoginComponent),
  },
  {
    path: 'inicio',
    canActivate: [authGuard],
    loadComponent: () =>
      import('./pages/inicio/inicio.component').then((m) => m.InicioComponent),
  },
  {
    path: 'documentos',
    canActivate: [authGuard],
    loadComponent: () =>
      import('./pages/documentos/documentos.component').then((m) => m.DocumentosComponent),
  },
  {
    path: 'documentos/:slug',
    canActivate: [authGuard],
    loadComponent: () =>
      import('./pages/documentos/documentos.component').then((m) => m.DocumentosComponent),
  },
  {
    path: 'admin',
    canActivate: [authGuard, adminGuard],
    loadComponent: () =>
      import('./shared/admin/admin-layout/admin-layout.component').then(
        (m) => m.AdminLayoutComponent
      ),
    children: [
      {
        path: 'menu',
        loadComponent: () =>
          import('./pages/admin/menu/menu-admin.component').then((m) => m.MenuAdminComponent),
        data: { adminTitle: 'Gestão do Menu' },
      },
      {
        path: 'documentos',
        loadComponent: () =>
          import('./pages/admin/documentos/documentos-admin.component').then(
            (m) => m.DocumentosAdminComponent
          ),
        data: { adminTitle: 'Documentos' },
      },
      {
        path: 'tenants',
        loadComponent: () =>
          import('./pages/admin/tenants/tenants-admin.component').then(
            (m) => m.TenantsAdminComponent
          ),
        data: { adminTitle: 'Tenants Azure' },
      },
      { path: '', redirectTo: 'menu', pathMatch: 'full' },
    ],
  },
  { path: '', redirectTo: 'login', pathMatch: 'full' },
  { path: '**', redirectTo: 'login' },
];
