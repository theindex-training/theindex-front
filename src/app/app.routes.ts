import { Routes } from '@angular/router';
import { authGuard } from './guards/auth.guard';
import { loginGuard } from './guards/login.guard';
import { roleGuard } from './guards/role.guard';

export const routes: Routes = [
  {
    path: '',
    pathMatch: 'full',
    redirectTo: 'login'
  },
  {
    path: 'login',
    loadComponent: () => import('./pages/login/login.component').then(m => m.LoginComponent),
    canActivate: [loginGuard]
  },
  {
    path: 'unauthorized',
    loadComponent: () =>
      import('./pages/unauthorized/unauthorized.component').then(m => m.UnauthorizedComponent)
  },
  {
    path: '',
    loadComponent: () =>
      import('./components/main-layout/main-layout.component').then(m => m.MainLayoutComponent),
    canActivate: [authGuard],
    children: [
      {
        path: '',
        pathMatch: 'full',
        redirectTo: 'home'
      },
      {
        path: 'home',
        loadComponent: () => import('./pages/home/home.component').then(m => m.HomeComponent),
        canActivate: [roleGuard],
        data: { roles: ['ADMIN', 'TRAINER'] }
      },
      {
        path: 'plans',
        loadComponent: () => import('./pages/plans/plans.component').then(m => m.PlansComponent),
        canActivate: [roleGuard],
        data: { roles: ['ADMIN', 'TRAINER'] }
      },
      {
        path: 'gyms',
        loadComponent: () => import('./pages/gyms/gyms.component').then(m => m.GymsComponent),
        canActivate: [roleGuard],
        data: { roles: ['ADMIN', 'TRAINER'] }
      },
      {
        path: 'trainers',
        loadComponent: () =>
          import('./pages/trainers/trainers.component').then(m => m.TrainersComponent),
        canActivate: [roleGuard],
        data: { roles: ['ADMIN', 'TRAINER'] }
      },
      {
        path: 'trainees',
        loadComponent: () =>
          import('./pages/trainees/trainees.component').then(m => m.TraineesComponent),
        canActivate: [roleGuard],
        data: { roles: ['ADMIN', 'TRAINER'] }
      }
    ]
  },
  {
    path: '**',
    loadComponent: () => import('./pages/not-found/not-found.component').then(m => m.NotFoundComponent)
  }
];
