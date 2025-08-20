import { Component, inject, signal, computed } from '@angular/core';
import { CommonModule } from '@angular/common';
import { MatTableModule } from '@angular/material/table';
import { MatButtonModule } from '@angular/material/button';
import { MatIconModule } from '@angular/material/icon';
import { MatDialog, MatDialogModule } from '@angular/material/dialog';
import { toNeto, ivaParte } from '../../shared/tax';
import { FirestoreService } from '../../shared/firestore';
//import { BarcodeScannerComponent } from '../../shared/barcode-scanner/barcode-scanner';
import { SaleItem, Product } from '../../shared/models';

@Component({
  selector: 'app-pos',
  standalone: true,
  imports: [CommonModule, MatTableModule, MatButtonModule, MatIconModule, MatDialogModule],
  templateUrl: './pos.html',
  styleUrls: ['./pos.scss']
})

export class PosComponent {
  private fs = inject(FirestoreService);
  private dialog = inject(MatDialog);

  cols = ['name','qty','price','total'];
  items = signal<SaleItem[]>([]);

  subtotalNeto = computed(()=> this.items().reduce((a,i)=> a + i.unitPriceNeto*i.qty, 0));
  totalBruto  = computed(()=> this.items().reduce((a,i)=> a + i.lineTotal, 0));
  totalIVA    = computed(()=> this.items().reduce((a,i)=> a + i.lineIVA, 0));
  
  
  async addProductByBarcode(barcode: string) {
    const { getFirestore, collection, query, where, getDocs } = await import('@angular/fire/firestore');
    const fs = getFirestore();
    const q = query(collection(fs,'products'), where('barcode','==', barcode));
    const snap = await getDocs(q);
    if (snap.empty) return;
    const doc = snap.docs[0];
    const p = { id: doc.id, ...(doc.data() as any) } as Product;

    const item: SaleItem = {
      productId: p.id, name: p.name, qty: 1,
      unitPriceInclIVA: p.priceInclIVA,
      unitPriceNeto: toNeto(p.priceInclIVA),
      lineIVA: ivaParte(p.priceInclIVA),
      lineTotal: p.priceInclIVA
    };
    this.items.update(list => {
      const idx = list.findIndex(x => x.productId === p.id);
      if (idx >= 0) {
        const cur = list[idx];
        const updated = {
          ...cur,
          qty: cur.qty + 1,
          lineIVA: +(cur.lineIVA + ivaParte(p.priceInclIVA)).toFixed(2),
          lineTotal: +(cur.lineTotal + p.priceInclIVA).toFixed(2)
        };
        return [...list.slice(0,idx), updated, ...list.slice(idx+1)];
      }
      return [...list, item];
    });
  }

  async openScanner() {
    const { BarcodeScannerComponent } = await import('../../shared/barcode-scanner/barcode-scanner');
    const ref = this.dialog.open(BarcodeScannerComponent, { width:'100%', maxWidth:'100vw' });
    ref.afterClosed().subscribe(code => { if (code) this.addProductByBarcode(code); });
  }
}
