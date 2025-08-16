import { Routes } from '@angular/router';

export const routes: Routes = [
  {
    path: '',
    loadComponent: () => import('./shell/shell.component').then(m => m.ShellComponent),
    children: [
      { path: '', redirectTo: 'pos', pathMatch: 'full' },
      { path: 'pos', loadComponent: () => import('./features/pos/pos.component').then(m => m.PosComponent) },
      { path: 'inventario', loadComponent: () => import('./features/inventory/inventory.component').then(m => m.InventoryComponent) },
      { path: 'compras', loadComponent: () => import('./features/purchases/purchases.component').then(m => m.PurchasesComponent) },
      { path: 'ventas', loadComponent: () => import('./features/sales/sales.component').then(m => m.SalesComponent) },
    ]
  },
  { path: '**', redirectTo: '' }
];
