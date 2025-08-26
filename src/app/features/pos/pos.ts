import { Component, inject, signal, computed } from '@angular/core';
import { CommonModule } from '@angular/common';
import { MatTableModule } from '@angular/material/table';
import { MatButtonModule } from '@angular/material/button';
import { MatIconModule } from '@angular/material/icon';
import { MatDialog, MatDialogModule } from '@angular/material/dialog';
import { FirestoreService } from '../../shared/firestore';
import { aNeto, parteIVA } from '../../shared/tax';
import { ItemVenta, Producto } from '../../shared/models';

@Component({
  selector: 'app-pos',
  standalone: true,
  imports: [CommonModule, MatTableModule, MatButtonModule, MatIconModule, MatDialogModule],
  templateUrl: './pos.html',
  styleUrls: ['./pos.scss']
})
export class PosComponent {
  private dialog = inject(MatDialog);
  cols = ['nombre','qty','precio','total'];
  items = signal<ItemVenta[]>([]);

  subtotalNeto = computed(()=> this.items().reduce((a,i)=> a + i.unitario_neto*i.qty, 0));
  totalBruto  = computed(()=> this.items().reduce((a,i)=> a + i.total_bruto, 0));
  totalIVA    = computed(()=> this.items().reduce((a,i)=> a + i.iva, 0));

  async addProductByBarcode(barcode: string) {
    const { getFirestore, collection, query, where, getDocs } = await import('@angular/fire/firestore');
    const fs = getFirestore();
    // ahora buscamos por array-contains en "codigos_barra"
    const q = query(collection(fs,'productos'), where('codigos_barra','array-contains', barcode));
    const snap = await getDocs(q);
    if (snap.empty) return;

    const doc = snap.docs[0];
    const p = { id: doc.id, ...(doc.data() as any) } as Producto;
    const bruto = +(p.precio_venta_bruto ?? 0);

    const item: ItemVenta = {
      producto_id: p.id, nombre: p.nombre, qty: 1,
      unitario_bruto: bruto,
      unitario_neto: aNeto(bruto),
      iva: parteIVA(bruto),
      total_bruto: bruto
    };

    this.items.update(list => {
      const idx = list.findIndex(x => x.producto_id === p.id);
      if (idx >= 0) {
        const cur = list[idx];
        const updated = {
          ...cur,
          qty: cur.qty + 1,
          iva: +(cur.iva + parteIVA(bruto)).toFixed(2),
          total_bruto: +(cur.total_bruto + bruto).toFixed(2)
        };
        return [...list.slice(0,idx), updated, ...list.slice(idx+1)];
      }
      return [...list, item];
    });
  }

  async openScanner() {
    // import dinámico para evitar SSR
    const { BarcodeScannerComponent } = await import('../../shared/barcode-scanner/barcode-scanner');
    const ref = this.dialog.open(BarcodeScannerComponent, { width:'100%', maxWidth:'100vw' });
    ref.afterClosed().subscribe(code => { if (code) this.addProductByBarcode(code); });
  }
}
