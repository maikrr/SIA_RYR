import { Routes } from '@angular/router';

export const routes: Routes = [
  {
    path: '',
    loadComponent: () => import('./shell/shell').then(m => m.ShellComponent),
    children: [
      { path: '', redirectTo: 'pos', pathMatch: 'full' },
      { path: 'pos',        loadComponent: () => import('./features/pos/pos').then(m => m.PosComponent) },
      { path: 'inventario', loadComponent: () => import('./features/inventory/inventory').then(m => m.InventoryComponent) },
      { path: 'compras',    loadComponent: () => import('./features/purchases/purchases').then(m => m.PurchasesComponent) },
      { path: 'ventas',     loadComponent: () => import('./features/sales/sales').then(m => m.SalesComponent) },
    ]
  },
  { path: '**', redirectTo: '' }
];
