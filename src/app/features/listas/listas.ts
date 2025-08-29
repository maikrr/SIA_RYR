import { Component, inject, signal } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormBuilder, ReactiveFormsModule, Validators } from '@angular/forms';
import { MatFormFieldModule } from '@angular/material/form-field';
import { MatInputModule } from '@angular/material/input';
import { MatSelectModule } from '@angular/material/select';
import { MatButtonModule } from '@angular/material/button';
import { MatTableModule } from '@angular/material/table';
import { MatSnackBar, MatSnackBarModule } from '@angular/material/snack-bar';
import {
  getFirestore, collection, query, orderBy, collectionData, addDoc,
  doc, writeBatch, getDocs, updateDoc
} from '@angular/fire/firestore';
import * as XLSX from 'xlsx';

type Lista = {
  id: string;
  proveedor_id: string;
  fecha_corte: number;
  moneda: 'BOB'|'USD';
  incluye_iva: boolean;
  iva: number; // 0.13
  archivo_origen?: string;
  estado: 'cargado'|'procesado'|'publicado';
};

type ItemLista = {
  sku_proveedor: string;
  nombre_proveedor: string;
  unidad: string;
  barcode?: string;
  costo: number;
  incluye_iva: boolean;
  iva: number;
  empaque?: { unidad_contenida: number };
  observaciones?: string;
};

@Component({
  selector: 'app-listas',
  standalone: true,
  imports: [
    CommonModule, ReactiveFormsModule,
    MatFormFieldModule, MatInputModule, MatSelectModule,
    MatButtonModule, MatTableModule, MatSnackBarModule
  ],
  templateUrl: './listas.html',
  styleUrls: ['./listas.scss']
})
export class ListasComponent {
  private fb = inject(FormBuilder);
  private snack = inject(MatSnackBar);

  columnas = ['proveedor','fecha','estado','accion'] as const;
  listas = signal<Lista[]>([]);
  archivo: File | null = null;

  form = this.fb.group({
    proveedor_id: ['', Validators.required],
    fecha_corte: ['', Validators.required],     // YYYY-MM-DD
    incluye_iva: ['false', Validators.required],// 'true' | 'false'
    iva: [13, Validators.required]              // %
  });

  constructor() {
    const fs = getFirestore();
    const ql = query(collection(fs,'listas_precios'), orderBy('fecha_corte','desc'));
    collectionData(ql, { idField: 'id' }).subscribe((arr) => {
      this.listas.set(arr as any);
    });
  }

  onFile(e: Event) {
    this.archivo = (e.target as HTMLInputElement).files?.[0] ?? null;
  }

  // ---- helpers
  private normalizarHeader(h: string) {
    return h.toLowerCase().normalize('NFD').replace(/\p{Diacritic}/gu,'').replace(/\s+/g,'').replace(/[^a-z0-9_]/g,'');
  }
  private detectarColumnas(headers: string[]) {
    const H = headers.map(this.normalizarHeader);
    const find = (...keys: string[]) => {
      const i = H.findIndex(h => keys.includes(h));
      return i >= 0 ? headers[i] : null;
    };
    return {
      sku:     find('sku','codigo','codigoproducto','codigoprov','codproducto','cod'),
      nombre:  find('nombre','producto','descripcion','detalle'),
      unidad:  find('unidad','unid','um'),
      precio:  find('precio','costo','costounitario','pvp','neto'),
      iva:     find('iva','impuesto'),
      barcode: find('barcode','ean','ean13','codebar','codigobarra')
    };
  }
  private calcularCostos(costo: number, incluyeIva: boolean, iva: number) {
    if (incluyeIva) return { costoNeto: +(costo/(1+iva)).toFixed(5), costoBruto: costo };
    return { costoNeto: costo, costoBruto: +(costo*(1+iva)).toFixed(5) };
  }
  private sanitizeId(s: string) { return s.toLowerCase().replace(/[^a-z0-9_-]/g,''); }

  // ---- SUBIR Y PROCESAR EN CLIENTE ----
  async subir() {
    if (this.form.invalid || !this.archivo) return;

    const proveedor_id = this.form.value.proveedor_id!;
    const fecha_corte = new Date(this.form.value.fecha_corte!).getTime();
    const incluye_iva = this.form.value.incluye_iva === 'true';
    const iva = (Number(this.form.value.iva) || 13) / 100;

    // 1) leer archivo
    const buf = await this.archivo.arrayBuffer();
    const wb = XLSX.read(buf, { type: 'array' });
    const sheet = wb.Sheets[wb.SheetNames[0]];
    const rows = XLSX.utils.sheet_to_json<any>(sheet, { defval: '' });
    if (!rows.length) { this.snack.open('Archivo vacío', 'OK', { duration: 1500 }); return; }

    // 2) crear doc de lista
    const fs = getFirestore();
    const listaRef = await addDoc(collection(fs,'listas_precios'), {
      proveedor_id, fecha_corte, moneda: 'BOB', incluye_iva, iva, estado: 'cargado'
    } as Omit<Lista,'id'|'estado'> & { estado: Lista['estado'] });

    // 3) detectar columnas y escribir items (lotes de 500)
    const headers = Object.keys(rows[0]);
    const cols = this.detectarColumnas(headers);
    const itemsCol = collection(fs, `listas_precios/${listaRef.id}/items`);

    let batch = writeBatch(fs);
    let count = 0;

    for (const r of rows) {
      const sku = String(r[cols.sku ?? 'SKU'] ?? '').trim();
      const nombre = String(r[cols.nombre ?? 'NOMBRE'] ?? '').trim();
      const unidad = (String(r[cols.unidad ?? 'UNIDAD'] ?? '').trim()) || 'u';
      const precioRaw = parseFloat(String(r[cols.precio ?? 'PRECIO'] ?? '').toString().replace(',','.')) || 0;
      const ivaRaw = cols.iva ? parseFloat(String(r[cols.iva] ?? '').toString().replace(',','.'))/100 : NaN;
      const barcode = cols.barcode ? String(r[cols.barcode] ?? '').trim() : '';

      if (!sku || !nombre || !precioRaw) continue;

      const item: ItemLista = {
        sku_proveedor: sku,
        nombre_proveedor: nombre,
        unidad,
        barcode,
        costo: precioRaw,
        incluye_iva,
        iva: Number.isFinite(ivaRaw) ? ivaRaw : iva
      };

      batch.set(doc(itemsCol), item);
      count++;
      if (count % 500 === 0) { await batch.commit(); batch = writeBatch(fs); }
    }

    await batch.commit();
    await updateDoc(doc(fs, `listas_precios/${listaRef.id}`), { estado: 'procesado' } as Partial<Lista>);

    this.snack.open(`Lista procesada: ${count} ítems`, 'OK', { duration: 2000 });
  }

  // ---- PUBLICAR OFERTAS (cliente) ----
  async publicar(lista: Lista) {
    const fs = getFirestore();
    const itemsSnap = await getDocs(collection(fs, `listas_precios/${lista.id}/items`));
    if (itemsSnap.empty) { this.snack.open('No hay ítems para publicar', 'OK', { duration: 1500 }); return; }

    let batch = writeBatch(fs);
    let count = 0;

    itemsSnap.forEach((d) => {
      const it = d.data() as ItemLista;
      const { costoNeto, costoBruto } = this.calcularCostos(it.costo, it.incluye_iva, it.iva);
      const ofertaId = this.sanitizeId(`${lista.proveedor_id}_${it.sku_proveedor}`);
      const ofertaRef = doc(fs, `ofertas_proveedor/${ofertaId}`);
      batch.set(ofertaRef, {
        proveedor_id: lista.proveedor_id,
        sku_proveedor: it.sku_proveedor,
        producto_id: null,
        nombre: it.nombre_proveedor,
        barcode: it.barcode || null,
        unidad: it.unidad || 'u',
        costo_neto: +costoNeto.toFixed(5),
        costo_bruto: +costoBruto.toFixed(5),
        incluye_iva: it.incluye_iva,
        iva: it.iva,
        vigente_desde: lista.fecha_corte,
        activo: true,
        fuente_lista_id: lista.id,
        actualizado_en: Date.now()
      }, { merge: true });
      count++;
      if (count % 500 === 0) { batch.commit(); batch = writeBatch(fs); }
    });

    await batch.commit();
    await updateDoc(doc(fs, `listas_precios/${lista.id}`), { estado: 'publicado' } as Partial<Lista>);
    this.snack.open(`Ofertas publicadas (${count})`, 'OK', { duration: 2000 });
  }
}
