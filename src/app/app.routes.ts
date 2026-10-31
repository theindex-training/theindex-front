import { Routes } from '@angular/router';
import { authGuard } from './guards/auth.guard';
import { loginGuard } from './guards/login.guard';
import { roleGuard } from './guards/role.guard';

// Route titles are translation keys; TranslatedTitleStrategy turns them into "<page> · The Index".
export const routes: Routes = [
  {
    path: '',
    pathMatch: 'full',
    redirectTo: 'login'
  },
  {
    path: 'login',
    title: 'auth.login.title',
    loadComponent: () => import('./pages/login/login.component').then(m => m.LoginComponent),
    canActivate: [loginGuard]
  },
  {
    path: 'unauthorized',
    title: 'system.unauthorized.title',
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
        title: 'nav.dashboard',
        loadComponent: () => import('./pages/home/home.component').then(m => m.HomeComponent),
        canActivate: [roleGuard],
        data: { roles: ['ADMIN', 'TRAINER'] }
      },

      {
        path: 'my-profile',
        title: 'traineeDashboard.title',
        loadComponent: () =>
          import('./pages/trainee-dashboard/trainee-dashboard.component').then(
            m => m.TraineeDashboardComponent
          ),
        canActivate: [roleGuard],
        data: { roles: ['TRAINEE'] }
      },
      {
        path: 'stats',
        title: 'nav.stats',
        loadComponent: () => import('./pages/stats/stats.component').then(m => m.StatsComponent),
        canActivate: [roleGuard],
        data: { roles: ['TRAINEE'] }
      },
      {
        path: 'records',
        title: 'nav.records',
        loadComponent: () => import('./pages/records/records.component').then(m => m.RecordsComponent),
        canActivate: [roleGuard],
        data: { roles: ['TRAINEE'] }
      },
      {
        path: 'change-password',
        title: 'auth.changePassword.title',
        loadComponent: () =>
          import('./pages/change-password/change-password.component').then(
            m => m.ChangePasswordComponent
          )
      },
      {
        path: 'plans/new',
        title: 'plans.create.title',
        loadComponent: () =>
          import('./pages/plans/plan-create.component').then(m => m.PlanCreateComponent),
        canActivate: [roleGuard],
        data: { roles: ['ADMIN', 'TRAINER'] }
      },
      {
        path: 'plans/:id/edit',
        title: 'plans.edit.title',
        loadComponent: () =>
          import('./pages/plans/plan-edit.component').then(m => m.PlanEditComponent),
        canActivate: [roleGuard],
        data: { roles: ['ADMIN', 'TRAINER'] }
      },
      {
        path: 'plans/:id/delete',
        title: 'plans.delete.title',
        loadComponent: () =>
          import('./pages/plans/plan-delete.component').then(m => m.PlanDeleteComponent),
        canActivate: [roleGuard],
        data: { roles: ['ADMIN', 'TRAINER'] }
      },
      {
        path: 'plans/:id',
        title: 'plans.details.title',
        loadComponent: () =>
          import('./pages/plans/plan-details.component').then(m => m.PlanDetailsComponent),
        canActivate: [roleGuard],
        data: { roles: ['ADMIN', 'TRAINER'] }
      },
      {
        path: 'plans',
        title: 'nav.plans',
        loadComponent: () => import('./pages/plans/plans.component').then(m => m.PlansComponent),
        canActivate: [roleGuard],
        data: { roles: ['ADMIN', 'TRAINER'] }
      },
      {
        path: 'gyms/new',
        title: 'gyms.create.title',
        loadComponent: () => import('./pages/gyms/gym-create.component').then(m => m.GymCreateComponent),
        canActivate: [roleGuard],
        data: { roles: ['ADMIN', 'TRAINER'] }
      },
      {
        path: 'gyms/:id/edit',
        title: 'gyms.edit.title',
        loadComponent: () => import('./pages/gyms/gym-edit.component').then(m => m.GymEditComponent),
        canActivate: [roleGuard],
        data: { roles: ['ADMIN', 'TRAINER'] }
      },
      {
        path: 'gyms/:id/delete',
        title: 'gyms.delete.title',
        loadComponent: () =>
          import('./pages/gyms/gym-delete.component').then(m => m.GymDeleteComponent),
        canActivate: [roleGuard],
        data: { roles: ['ADMIN', 'TRAINER'] }
      },
      {
        path: 'gyms/:id',
        title: 'gyms.details.title',
        loadComponent: () =>
          import('./pages/gyms/gym-details.component').then(m => m.GymDetailsComponent),
        canActivate: [roleGuard],
        data: { roles: ['ADMIN', 'TRAINER'] }
      },
      {
        path: 'gyms',
        title: 'nav.gyms',
        loadComponent: () => import('./pages/gyms/gyms.component').then(m => m.GymsComponent),
        canActivate: [roleGuard],
        data: { roles: ['ADMIN', 'TRAINER'] }
      },
      {
        path: 'gym-subscriptions/new',
        title: 'gymSubscriptions.create.title',
        loadComponent: () =>
          import('./pages/gym-subscriptions/gym-subscription-create.component').then(
            m => m.GymSubscriptionCreateComponent
          ),
        canActivate: [roleGuard],
        data: { roles: ['ADMIN', 'TRAINER'] }
      },
      {
        path: 'gym-subscriptions/:id/edit',
        title: 'gymSubscriptions.edit.title',
        loadComponent: () =>
          import('./pages/gym-subscriptions/gym-subscription-edit.component').then(
            m => m.GymSubscriptionEditComponent
          ),
        canActivate: [roleGuard],
        data: { roles: ['ADMIN', 'TRAINER'] }
      },
      {
        path: 'gym-subscriptions/:id/delete',
        title: 'gymSubscriptions.delete.title',
        loadComponent: () =>
          import('./pages/gym-subscriptions/gym-subscription-delete.component').then(
            m => m.GymSubscriptionDeleteComponent
          ),
        canActivate: [roleGuard],
        data: { roles: ['ADMIN', 'TRAINER'] }
      },
      {
        path: 'gym-subscriptions/:id',
        title: 'gymSubscriptions.details.title',
        loadComponent: () =>
          import('./pages/gym-subscriptions/gym-subscription-details.component').then(
            m => m.GymSubscriptionDetailsComponent
          ),
        canActivate: [roleGuard],
        data: { roles: ['ADMIN', 'TRAINER'] }
      },
      {
        path: 'gym-subscriptions',
        title: 'nav.gymSubscriptions',
        loadComponent: () =>
          import('./pages/gym-subscriptions/gym-subscriptions.component').then(
            m => m.GymSubscriptionsComponent
          ),
        canActivate: [roleGuard],
        data: { roles: ['ADMIN', 'TRAINER'] }
      },
      {
        path: 'trainers/new',
        title: 'trainers.create.title',
        loadComponent: () =>
          import('./pages/trainers/trainer-create.component').then(m => m.TrainerCreateComponent),
        canActivate: [roleGuard],
        data: { roles: ['ADMIN'] }
      },
      {
        path: 'trainers/:id/edit',
        title: 'trainers.edit.title',
        loadComponent: () =>
          import('./pages/trainers/trainer-edit.component').then(m => m.TrainerEditComponent),
        canActivate: [roleGuard],
        data: { roles: ['ADMIN'] }
      },
      {
        path: 'trainers/:id/delete',
        title: 'trainers.delete.title',
        loadComponent: () =>
          import('./pages/trainers/trainer-delete.component').then(m => m.TrainerDeleteComponent),
        canActivate: [roleGuard],
        data: { roles: ['ADMIN'] }
      },
      {
        path: 'trainers/:id/account',
        title: 'trainers.account.pageTitle',
        loadComponent: () =>
          import('./pages/trainers/trainer-account.component').then(m => m.TrainerAccountComponent),
        canActivate: [roleGuard],
        data: { roles: ['ADMIN'] }
      },
      {
        path: 'trainers/:id',
        title: 'trainers.details.title',
        loadComponent: () =>
          import('./pages/trainers/trainer-details.component').then(m => m.TrainerDetailsComponent),
        canActivate: [roleGuard],
        data: { roles: ['ADMIN'] }
      },
      {
        path: 'trainers',
        title: 'nav.trainers',
        loadComponent: () =>
          import('./pages/trainers/trainers.component').then(m => m.TrainersComponent),
        canActivate: [roleGuard],
        data: { roles: ['ADMIN'] }
      },
      {
        path: 'training-times/new',
        title: 'trainingTimes.create.title',
        loadComponent: () =>
          import('./pages/training-times/training-time-create.component').then(
            m => m.TrainingTimeCreateComponent
          ),
        canActivate: [roleGuard],
        data: { roles: ['ADMIN', 'TRAINER'] }
      },
      {
        path: 'training-times/:id/edit',
        title: 'trainingTimes.edit.title',
        loadComponent: () =>
          import('./pages/training-times/training-time-edit.component').then(
            m => m.TrainingTimeEditComponent
          ),
        canActivate: [roleGuard],
        data: { roles: ['ADMIN', 'TRAINER'] }
      },
      {
        path: 'training-times/:id/delete',
        title: 'trainingTimes.delete.title',
        loadComponent: () =>
          import('./pages/training-times/training-time-delete.component').then(
            m => m.TrainingTimeDeleteComponent
          ),
        canActivate: [roleGuard],
        data: { roles: ['ADMIN', 'TRAINER'] }
      },
      {
        path: 'training-times/:id',
        title: 'trainingTimes.details.title',
        loadComponent: () =>
          import('./pages/training-times/training-time-details.component').then(
            m => m.TrainingTimeDetailsComponent
          ),
        canActivate: [roleGuard],
        data: { roles: ['ADMIN', 'TRAINER'] }
      },
      {
        path: 'training-times',
        title: 'nav.trainingTimes',
        loadComponent: () =>
          import('./pages/training-times/training-times.component').then(
            m => m.TrainingTimesComponent
          ),
        canActivate: [roleGuard],
        data: { roles: ['ADMIN', 'TRAINER'] }
      },
      {
        path: 'attendance/new',
        title: 'nav.registerAttendance',
        loadComponent: () =>
          import('./pages/attendance/attendance-register.component').then(
            m => m.AttendanceRegisterComponent
          ),
        canActivate: [roleGuard],
        data: { roles: ['ADMIN', 'TRAINER'] }
      },
      {
        path: 'attendance',
        title: 'nav.attendanceHistory',
        loadComponent: () =>
          import('./pages/attendance/attendance-sessions.component').then(
            m => m.AttendanceSessionsComponent
          ),
        canActivate: [roleGuard],
        data: { roles: ['ADMIN', 'TRAINER'] }
      },

      {
        path: 'settlements/new',
        title: 'settlements.generate.title',
        loadComponent: () =>
          import('./pages/settlements/settlement-generate.component').then(
            m => m.SettlementGenerateComponent
          ),
        canActivate: [roleGuard],
        data: { roles: ['ADMIN'] }
      },
      {
        path: 'settlements/:id',
        title: 'settlements.details.title',
        loadComponent: () =>
          import('./pages/settlements/settlement-details.component').then(
            m => m.SettlementDetailsComponent
          ),
        canActivate: [roleGuard],
        data: { roles: ['ADMIN', 'TRAINER'] }
      },
      {
        path: 'settlements',
        title: 'nav.settlements',
        loadComponent: () =>
          import('./pages/settlements/settlements.component').then(m => m.SettlementsComponent),
        canActivate: [roleGuard],
        data: { roles: ['ADMIN', 'TRAINER'] }
      },
      {
        path: 'cash-register',
        title: 'nav.cashRegister',
        loadComponent: () =>
          import('./pages/cash-register/cash-register.component').then(m => m.CashRegisterComponent),
        canActivate: [roleGuard],
        data: { roles: ['ADMIN'] }
      },
      {
        path: 'trainees/new',
        title: 'trainees.create.title',
        loadComponent: () =>
          import('./pages/trainees/trainee-create.component').then(
            m => m.TraineeCreateComponent
          ),
        canActivate: [roleGuard],
        data: { roles: ['ADMIN', 'TRAINER'] }
      },
      {
        path: 'trainees/:id/edit',
        title: 'trainees.edit.title',
        loadComponent: () =>
          import('./pages/trainees/trainee-edit.component').then(m => m.TraineeEditComponent),
        canActivate: [roleGuard],
        data: { roles: ['ADMIN', 'TRAINER'] }
      },
      {
        path: 'trainees/:id/delete',
        title: 'trainees.delete.title',
        loadComponent: () =>
          import('./pages/trainees/trainee-delete.component').then(
            m => m.TraineeDeleteComponent
          ),
        canActivate: [roleGuard],
        data: { roles: ['ADMIN', 'TRAINER'] }
      },
      {
        path: 'trainees/:id/account',
        title: 'trainees.account.pageTitle',
        loadComponent: () =>
          import('./pages/trainees/trainee-account.component').then(
            m => m.TraineeAccountComponent
          ),
        canActivate: [roleGuard],
        data: { roles: ['ADMIN', 'TRAINER'] }
      },
      {
        path: 'trainees/:id',
        title: 'trainees.details.title',
        loadComponent: () =>
          import('./pages/trainees/trainee-details.component').then(
            m => m.TraineeDetailsComponent
          ),
        canActivate: [roleGuard],
        data: { roles: ['ADMIN', 'TRAINER'] }
      },
      {
        path: 'trainees',
        title: 'nav.trainees',
        loadComponent: () =>
          import('./pages/trainees/trainees.component').then(m => m.TraineesComponent),
        canActivate: [roleGuard],
        data: { roles: ['ADMIN', 'TRAINER'] }
      }
    ]
  },
  {
    path: '**',
    title: 'system.notFound.title',
    loadComponent: () => import('./pages/not-found/not-found.component').then(m => m.NotFoundComponent)
  }
];
