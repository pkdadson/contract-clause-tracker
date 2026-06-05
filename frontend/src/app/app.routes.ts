import { Routes } from '@angular/router';

export const routes: Routes = [
  {
    path: '',
    loadComponent: () => import('./features/dashboard/dashboard.page').then(m => m.DashboardPage),
    title: 'Contracts · Clause Tracker',
  },
  {
    path: 'documents/:id',
    loadComponent: () => import('./features/viewer/viewer.page').then(m => m.ViewerPage),
    title: 'Review · Clause Tracker',
  },
  {
    path: '**',
    loadComponent: () => import('./not-found.page').then(m => m.NotFoundPage),
    title: 'Not found · Clause Tracker',
  },
];
