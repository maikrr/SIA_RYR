export interface Producto {
  id: string;
  sku: string;
  nombre: string;
  descripcion?: string;
  unidad_medida: string;        // 'u', 'kg', 'm', 'caja', etc.
  codigos_barra: string[];      // múltiples códigos
  categoria_id?: string;
  marca?: string;
  activo: boolean;

  gestion_stock: boolean;       // si controla existencias
  stock_minimo?: number;

  es_catalogo: boolean;         // lo vendes bajo pedido
  palabras_clave?: string[];

  // Precio de venta con IVA (13%) incluido
  precio_venta_bruto?: number;
  historial_precios_venta?: { precio_bruto: number; fecha: number; }[];

  // cache opcional de la mejor oferta de proveedor
  mejor_oferta?: {
    proveedor_id: string;
    sku_proveedor: string;
    costo_neto: number;
    incluye_iva: boolean;
    iva_proveedor: number;
    vigente_hasta?: number;
  };
}

export interface ItemVenta {
  id?: string;
  producto_id: string;
  nombre: string;
  qty: number;
  unitario_bruto: number;   // con IVA
  unitario_neto: number;    // sin IVA
  iva: number;              // parte IVA de la línea
  total_bruto: number;      // con IVA
}

export interface Venta {
  id?: string;
  sucursal_id: string;
  almacen_id: string;
  estado: 'ABIERTA'|'CERRADA';
  subtotal_neto: number;
  total_iva: number;
  total_bruto: number;
  creado_en: number;
  creado_por: string;
}
