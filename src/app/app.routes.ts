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
        path: 'plans/new',
        loadComponent: () =>
          import('./pages/plans/plan-create.component').then(m => m.PlanCreateComponent),
        canActivate: [roleGuard],
        data: { roles: ['ADMIN', 'TRAINER'] }
      },
      {
        path: 'plans/:id/edit',
        loadComponent: () =>
          import('./pages/plans/plan-edit.component').then(m => m.PlanEditComponent),
        canActivate: [roleGuard],
        data: { roles: ['ADMIN', 'TRAINER'] }
      },
      {
        path: 'plans/:id/delete',
        loadComponent: () =>
          import('./pages/plans/plan-delete.component').then(m => m.PlanDeleteComponent),
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
        path: 'gyms/new',
        loadComponent: () => import('./pages/gyms/gym-create.component').then(m => m.GymCreateComponent),
        canActivate: [roleGuard],
        data: { roles: ['ADMIN', 'TRAINER'] }
      },
      {
        path: 'gyms/:id/edit',
        loadComponent: () => import('./pages/gyms/gym-edit.component').then(m => m.GymEditComponent),
        canActivate: [roleGuard],
        data: { roles: ['ADMIN', 'TRAINER'] }
      },
      {
        path: 'gyms/:id/delete',
        loadComponent: () =>
          import('./pages/gyms/gym-delete.component').then(m => m.GymDeleteComponent),
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
        path: 'trainers/new',
        loadComponent: () =>
          import('./pages/trainers/trainer-create.component').then(m => m.TrainerCreateComponent),
        canActivate: [roleGuard],
        data: { roles: ['ADMIN', 'TRAINER'] }
      },
      {
        path: 'trainers/:id/edit',
        loadComponent: () =>
          import('./pages/trainers/trainer-edit.component').then(m => m.TrainerEditComponent),
        canActivate: [roleGuard],
        data: { roles: ['ADMIN', 'TRAINER'] }
      },
      {
        path: 'trainers/:id/delete',
        loadComponent: () =>
          import('./pages/trainers/trainer-delete.component').then(m => m.TrainerDeleteComponent),
        canActivate: [roleGuard],
        data: { roles: ['ADMIN', 'TRAINER'] }
      },
      {
        path: 'trainers/:id/account',
        loadComponent: () =>
          import('./pages/trainers/trainer-account.component').then(m => m.TrainerAccountComponent),
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
        path: 'trainees/new',
        loadComponent: () =>
          import('./pages/trainees/trainee-create.component').then(
            m => m.TraineeCreateComponent
          ),
        canActivate: [roleGuard],
        data: { roles: ['ADMIN', 'TRAINER'] }
      },
      {
        path: 'trainees/:id/edit',
        loadComponent: () =>
          import('./pages/trainees/trainee-edit.component').then(m => m.TraineeEditComponent),
        canActivate: [roleGuard],
        data: { roles: ['ADMIN', 'TRAINER'] }
      },
      {
        path: 'trainees/:id/delete',
        loadComponent: () =>
          import('./pages/trainees/trainee-delete.component').then(
            m => m.TraineeDeleteComponent
          ),
        canActivate: [roleGuard],
        data: { roles: ['ADMIN', 'TRAINER'] }
      },
      {
        path: 'trainees/:id/account',
        loadComponent: () =>
          import('./pages/trainees/trainee-account.component').then(
            m => m.TraineeAccountComponent
          ),
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
