import { Component, Inject, inject } from '@angular/core';
import { MAT_DIALOG_DATA, MatDialogRef } from '@angular/material/dialog';
import { CommonModule } from '@angular/common';
import { ReactiveFormsModule, FormBuilder, Validators } from '@angular/forms';
import { MatFormFieldModule } from '@angular/material/form-field';
import { MatInputModule } from '@angular/material/input';
import { MatButtonModule } from '@angular/material/button';
import { MatSlideToggleModule } from '@angular/material/slide-toggle';
import { MatSelectModule } from '@angular/material/select';
import { FirestoreService } from '../../shared/firestore';
import { Producto } from '../../shared/models';

@Component({
  selector: 'app-producto-dialog',
  standalone: true,
  imports: [
    CommonModule, ReactiveFormsModule,
    MatFormFieldModule, MatInputModule, MatButtonModule, MatSlideToggleModule, MatSelectModule
  ],
  templateUrl: './producto-dialog.html',
  styleUrls: ['./producto-dialog.scss']
})
export class ProductoDialogComponent {
  private fb = inject(FormBuilder);
  private fs = inject(FirestoreService);

  form = this.fb.group({
    sku: ['', [Validators.required]],
    nombre: ['', [Validators.required]],
    descripcion: [''],
    unidad_medida: ['u', [Validators.required]],
    codigos_barra_txt: [''], // coma-separado → lo convertimos a array
    categoria_id: [''],
    marca: [''],
    activo: [true],
    gestion_stock: [true],
    stock_minimo: [0],
    es_catalogo: [true],
    precio_venta_bruto: [0],
    palabras_clave: ['']
  });

  constructor(
  private ref: MatDialogRef<ProductoDialogComponent>,
  @Inject(MAT_DIALOG_DATA) public data: Producto | null
){
  if (data) {
    this.form.patchValue({
      sku: data.sku,
      nombre: data.nombre,
      descripcion: data.descripcion ?? '',
      unidad_medida: data.unidad_medida,
      codigos_barra_txt: (data.codigos_barra ?? []).join(', '),
      categoria_id: data.categoria_id ?? '',
      marca: data.marca ?? '',
      activo: data.activo,
      gestion_stock: data.gestion_stock,
      stock_minimo: data.stock_minimo ?? 0,
      es_catalogo: data.es_catalogo,
      precio_venta_bruto: data.precio_venta_bruto ?? 0,
      // 👇 convertir array → string para el control
      palabras_clave: (data.palabras_clave ?? []).join(', ')
    });
  }
}


  async guardar() {
    if (this.form.invalid) return;

    const v = this.form.value;
    const codigos_barra = (v.codigos_barra_txt ?? '')
      .split(',')
      .map(s => s.trim())
      .filter(Boolean);

    const payload: Omit<Producto,'id'> = {
      sku: v.sku!, nombre: v.nombre!, descripcion: v.descripcion ?? '',
      unidad_medida: v.unidad_medida!, codigos_barra,
      categoria_id: v.categoria_id ?? '', marca: v.marca ?? '',
      activo: !!v.activo, gestion_stock: !!v.gestion_stock, stock_minimo: +(v.stock_minimo ?? 0),
      es_catalogo: !!v.es_catalogo,
      precio_venta_bruto: +(v.precio_venta_bruto ?? 0),
      palabras_clave: (v.palabras_clave ?? '').split(',').map(x => x.trim()).filter(Boolean)
    };

    if (this.data?.id) {
      await this.fs.actualizarProducto(this.data.id, payload);
    } else {
      await this.fs.crearProducto(payload);
    }
    this.ref.close(true);
  }

  cerrar(){ this.ref.close(false); }
}
