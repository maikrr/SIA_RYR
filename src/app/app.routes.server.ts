import { RenderMode, ServerRoute } from '@angular/ssr';

export const serverRoutes: ServerRoute[] = [
  { path: 'listas-precios', renderMode: RenderMode.Client },
  { path: 'pos',        renderMode: RenderMode.Client },
  { path: 'inventario', renderMode: RenderMode.Client }, // <— Asegúrate que sea 'inventario'
  { path: '**',         renderMode: RenderMode.Server },
];
