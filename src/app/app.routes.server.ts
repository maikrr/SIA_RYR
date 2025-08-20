// src/app/app.routes.server.ts
import { RenderMode, ServerRoute } from '@angular/ssr';

export const serverRoutes: ServerRoute[] = [
  // Evitamos SSR en POS porque usa cámara/ZXing → solo cliente
  { path: 'pos', renderMode: RenderMode.Client },

  // El resto sigue con SSR por defecto (fallback)
  { path: '**', renderMode: RenderMode.Server },
];
