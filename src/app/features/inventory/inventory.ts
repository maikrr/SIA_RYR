import { Component, inject, signal, computed } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FirestoreService } from '../../shared/firestore';
import { Producto } from '../../shared/models';
import { MatTableModule } from '@angular/material/table';
import { MatButtonModule } from '@angular/material/button';
import { MatIconModule } from '@angular/material/icon';
import { MatDialog, MatDialogModule } from '@angular/material/dialog';
import { MatInputModule } from '@angular/material/input';
import { FormsModule } from '@angular/forms';
import { MatSnackBar, MatSnackBarModule } from '@angular/material/snack-bar';
import { ProductoDialogComponent } from './producto-dialog';

@Component({
  selector: 'app-inventory',
  standalone: true,
  imports: [
    CommonModule, FormsModule,
    MatTableModule, MatButtonModule, MatIconModule, MatDialogModule, MatInputModule, MatSnackBarModule
  ],
  templateUrl: './inventory.html',
  styleUrls: ['./inventory.scss']
})
export class InventoryComponent {
  private fs = inject(FirestoreService);
  private dialog = inject(MatDialog);
  private snack = inject(MatSnackBar);

  filtro = signal('');
  columnas = ['sku', 'nombre', 'precio', 'gestion', 'catalogo', 'acciones'] as const;
  productos = signal<Producto[]>([]);

  constructor() {
    this.fs.productos$().subscribe(p => this.productos.set(p));
  }

  filtrados = computed(() => {
    const term = this.filtro().toLowerCase();
    return this.productos().filter(p =>
      (p.sku?.toLowerCase().includes(term)) ||
      (p.nombre?.toLowerCase().includes(term))
    );
  });

  nuevo() {
    const ref = this.dialog.open(ProductoDialogComponent, { data: null, width: '640px' });
    ref.afterClosed().subscribe(ok => { if (ok) this.snack.open('Producto creado', 'OK', { duration: 1500 }); });
  }

  editar(p: Producto) {
    const ref = this.dialog.open(ProductoDialogComponent, { data: p, width: '640px' });
    ref.afterClosed().subscribe(ok => { if (ok) this.snack.open('Producto actualizado', 'OK', { duration: 1500 }); });
  }

  async eliminar(p: Producto) {
    if (!confirm(`¿Eliminar "${p.nombre}"?`)) return;
    await this.fs.eliminarProducto(p.id);
    this.snack.open('Producto eliminado', 'OK', { duration: 1500 });
  }
}
