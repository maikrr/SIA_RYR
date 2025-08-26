import { Injectable, inject } from '@angular/core';
import {
  Firestore, collection, addDoc, doc, setDoc, updateDoc, deleteDoc,
  query, orderBy
} from '@angular/fire/firestore';
import { collectionData, docData } from 'rxfire/firestore';
import { Producto, Venta, ItemVenta } from './models';
import { Observable, map } from 'rxjs';

@Injectable({ providedIn: 'root' })
export class FirestoreService {
  private fs = inject(Firestore);

  // Colecciones base
  private productosRef = collection(this.fs, 'productos');
  private ventasRef     = collection(this.fs, 'ventas');
  private existenciasRef= collection(this.fs, 'existencias');

  // ---- Productos
  productos$(): Observable<Producto[]> {
    const q = query(this.productosRef, orderBy('nombre'));
    // collectionData necesita idField para mapear el id del doc
    return collectionData(q, { idField: 'id' }) as Observable<Producto[]>;
  }

  crearProducto(p: Omit<Producto,'id'>) {
    return addDoc(this.productosRef, p);
  }

  actualizarProducto(id: string, parcial: Partial<Producto>) {
    return updateDoc(doc(this.fs, 'productos', id), parcial as any);
  }

  eliminarProducto(id: string) {
    return deleteDoc(doc(this.fs, 'productos', id));
  }

  // ---- Ventas (borrador)
  async nuevaVenta(v: Omit<Venta,'id'>) {
    const ref = await addDoc(this.ventasRef, v);
    return ref.id;
  }

  agregarItemVenta(ventaId: string, item: ItemVenta) {
    return addDoc(collection(this.fs, `ventas/${ventaId}/items`), item);
  }

  actualizarTotalesVenta(ventaId: string, parcial: Partial<Venta>) {
    return updateDoc(doc(this.fs, 'ventas', ventaId), parcial as any);
  }

  // ---- Existencias (id = `${almacenId}_${productoId}`)
  actualizarExistencia(existenciaId: string, cantidad: number) {
    return setDoc(doc(this.fs, 'existencias', existenciaId), { cantidad }, { merge: true });
  }
}
