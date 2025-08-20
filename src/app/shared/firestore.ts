import { Injectable, inject } from '@angular/core';
import { Firestore, collection, addDoc, doc, setDoc, updateDoc } from '@angular/fire/firestore';
import { Sale, SaleItem } from './models';

@Injectable({ providedIn: 'root' })
export class FirestoreService {
  private fs = inject(Firestore);

  productsCol = collection(this.fs, 'products');
  salesCol = collection(this.fs, 'sales');
  stockCol = collection(this.fs, 'warehouseStock');

  addProduct(p: any) { return addDoc(this.productsCol, p); }

  updateStock(stockId: string, qty: number) {
    return setDoc(doc(this.fs, 'warehouseStock', stockId), { qty }, { merge: true });
  }

  async newSale(sale: Omit<Sale,'id'>) {
    const ref = await addDoc(this.salesCol, sale);
    return ref.id;
  }

  addSaleItem(saleId: string, item: SaleItem) {
    return addDoc(collection(this.fs, `sales/${saleId}/items`), item);
  }

  updateSaleTotals(saleId: string, totals: Partial<Sale>) {
    return updateDoc(doc(this.fs, 'sales', saleId), totals as any);
  }
}
