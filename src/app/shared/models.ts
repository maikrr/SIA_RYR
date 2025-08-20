export type Role = 'admin' | 'vendedor';

export interface Product {
  id: string;
  sku: string;
  name: string;
  unit: string;        // p.ej. 'u', 'kg', 'm'
  barcode?: string;
  priceInclIVA: number; // precio de venta con IVA incluido
  active: boolean;
}

export interface SaleItem {
  id?: string;
  productId: string;
  name: string;
  qty: number;
  unitPriceInclIVA: number;
  unitPriceNeto: number;
  lineIVA: number;
  lineTotal: number;
}

export interface Sale {
  id?: string;
  branchId: string;
  warehouseId: string;
  status: 'OPEN' | 'CLOSED';
  subtotalNeto: number;
  totalIVA: number;
  totalBruto: number;
  createdAt: number;   // Date.now()
  createdBy: string;   // uid
}
