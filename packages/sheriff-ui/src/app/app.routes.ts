import type { Route } from '@angular/router';

export const appRoutes: Route[] = [
  { path: '', redirectTo: 'approach-manual', pathMatch: 'full' },
  {
    path: 'approach-manual',
    loadComponent: () =>
      import('./approach-manual/approach-manual.component').then(
        (m) => m.ApproachManualComponent,
      ),
  },
  {
    path: 'create-tag',
    outlet: 'popup',
    loadComponent: () =>
      import('./approach-manual/create-tag-modal.component').then(
        (m) => m.CreateTagModalComponent,
      ),
  },
  { path: '**', redirectTo: 'approach-manual' },
];

