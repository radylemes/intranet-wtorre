import { Routes } from '@angular/router';
import { authGuard } from './guards/auth.guard';
import { adminGuard } from './guards/admin.guard';
import { guestGuard } from './guards/guest.guard';
import { moduloGuardFromRoute } from './guards/modulo.guard';
import { superAdminGuard } from './guards/super-admin.guard';

export const routes: Routes = [
  {
    path: 'login',
    canActivate: [guestGuard],
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
      import('./pages/documentos/documentos-index.component').then((m) => m.DocumentosIndexComponent),
  },
  {
    path: 'documentos/:slug',
    canActivate: [authGuard],
    loadComponent: () =>
      import('./pages/documentos/documento-categoria.component').then((m) => m.DocumentoCategoriaComponent),
  },
  {
    path: 'ramais',
    canActivate: [authGuard],
    loadComponent: () =>
      import('./pages/ramais/ramais.component').then((m) => m.RamaisComponent),
  },
  {
    path: 'aniversariantes',
    canActivate: [authGuard],
    loadComponent: () =>
      import('./pages/aniversariantes/aniversariantes.component').then(
        (m) => m.AniversariantesComponent
      ),
  },
  {
    path: 'assinaturas',
    canActivate: [authGuard],
    loadComponent: () =>
      import('./pages/assinaturas/assinaturas.component').then(
        (m) => m.AssinaturasComponent
      ),
  },
  {
    path: 'treinamentos',
    canActivate: [authGuard],
    loadComponent: () =>
      import('./pages/treinamentos/treinamentos.component').then(
        (m) => m.TreinamentosComponent
      ),
  },
  {
    path: 'p/:slug',
    canActivate: [authGuard],
    loadComponent: () =>
      import('./pages/pagina-publica/pagina-publica.component').then(
        (m) => m.PaginaPublicaComponent
      ),
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
        path: '',
        loadComponent: () =>
          import('./pages/admin/admin-redirect/admin-redirect.component').then(
            (m) => m.AdminRedirectComponent
          ),
      },
      {
        path: 'menu',
        canActivate: [moduloGuardFromRoute],
        loadComponent: () =>
          import('./pages/admin/menu/menu-admin.component').then((m) => m.MenuAdminComponent),
        data: { adminTitle: 'Gestão do Menu' },
      },
      {
        path: 'rodape',
        canActivate: [moduloGuardFromRoute],
        loadComponent: () =>
          import('./pages/admin/rodape/rodape-admin.component').then((m) => m.RodapeAdminComponent),
        data: { adminTitle: 'Rodapé' },
      },
      {
        path: 'documentos',
        canActivate: [moduloGuardFromRoute],
        loadComponent: () =>
          import('./pages/admin/documentos/documentos-admin.component').then(
            (m) => m.DocumentosAdminComponent
          ),
        data: { adminTitle: 'Documentos' },
      },
      {
        path: 'tenants',
        canActivate: [moduloGuardFromRoute],
        loadComponent: () =>
          import('./pages/admin/tenants/tenants-admin.component').then(
            (m) => m.TenantsAdminComponent
          ),
        data: { adminTitle: 'Tenants Azure' },
      },
      {
        path: 'treinamentos',
        canActivate: [moduloGuardFromRoute],
        loadComponent: () =>
          import('./pages/admin/treinamentos-admin/treinamentos-admin.component').then(
            (m) => m.TreinamentosAdminComponent
          ),
        data: { adminTitle: 'Treinamentos' },
      },
      {
        path: 'containers',
        canActivate: [moduloGuardFromRoute],
        loadComponent: () =>
          import('./pages/admin/containers-admin/containers-admin.component').then(
            (m) => m.ContainersAdminComponent
          ),
        data: { adminTitle: 'Containers' },
      },
      {
        path: 'paginas',
        canActivate: [moduloGuardFromRoute],
        loadComponent: () =>
          import('./pages/admin/paginas/paginas-lista.component').then((m) => m.PaginasListaComponent),
        data: { adminTitle: 'Páginas' },
      },
      {
        path: 'paginas/nova',
        canActivate: [moduloGuardFromRoute],
        loadComponent: () =>
          import('./pages/admin/paginas/pagina-editor.component').then((m) => m.PaginaEditorComponent),
        data: { adminTitle: 'Nova página' },
      },
      {
        path: 'paginas/:id/editar',
        canActivate: [moduloGuardFromRoute],
        loadComponent: () =>
          import('./pages/admin/paginas/pagina-editor.component').then((m) => m.PaginaEditorComponent),
        data: { adminTitle: 'Editar página' },
      },
      {
        path: 'configuracoes',
        canActivate: [moduloGuardFromRoute],
        loadComponent: () =>
          import('./pages/admin/configuracoes/configuracoes-admin.component').then(
            (m) => m.ConfiguracoesAdminComponent
          ),
        data: { adminTitle: 'Configurações' },
      },
      {
        path: 'camarotes',
        canActivate: [moduloGuardFromRoute],
        loadComponent: () =>
          import('./pages/admin/camarotes/camarotes-admin.component').then(
            (m) => m.CamarotesAdminComponent
          ),
        data: { adminTitle: 'Gestão de Camarotes' },
      },
      {
        path: 'perfis',
        canActivate: [superAdminGuard],
        loadComponent: () =>
          import('./pages/admin/perfis/perfis-admin.component').then(
            (m) => m.PerfisAdminComponent
          ),
        data: { adminTitle: 'Perfis de Acesso' },
      },
      {
        path: 'acessos',
        canActivate: [superAdminGuard],
        loadComponent: () =>
          import('./pages/admin/acessos/acessos-admin.component').then(
            (m) => m.AcessosAdminComponent
          ),
        data: { adminTitle: 'Gestão de Acessos' },
      },
    ],
  },
  { path: '', redirectTo: 'inicio', pathMatch: 'full' },
  { path: '**', redirectTo: 'inicio' },
];
