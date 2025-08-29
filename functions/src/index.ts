import * as admin from 'firebase-admin';
import * as xlsx from 'xlsx';

import { onObjectFinalized } from 'firebase-functions/v2/storage';
import { onCall } from 'firebase-functions/v2/https';
import { setGlobalOptions } from 'firebase-functions/v2/options';

admin.initializeApp();
const db = admin.firestore();

// Región recomendada para Bolivia/Brasil
setGlobalOptions({ region: 'southamerica-east1' });

type ListaMeta = {
  proveedor_id: string;
  fecha_corte: number;
  moneda: 'BOB' | 'USD';
  incluye_iva: boolean;
  iva: number;
  archivo_origen: string;
  estado: 'cargado' | 'procesado' | 'publicado';
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

function normalizarHeader(h: string) {
  return h
    .toLowerCase()
    .normalize('NFD')
    .replace(/\p{Diacritic}/gu, '')
    .replace(/\s+/g, '')
    .replace(/[^a-z0-9_]/g, '');
}

function detectarColumnas(headers: string[]) {
  const H = headers.map(normalizarHeader);
  const find = (...keys: string[]) => {
    const i = H.findIndex((h) => keys.includes(h));
    return i >= 0 ? headers[i] : null;
  };
  return {
    sku: find('sku', 'codigo', 'codigoproducto', 'codigoprov', 'codproducto', 'cod'),
    nombre: find('nombre', 'producto', 'descripcion', 'detalle'),
    unidad: find('unidad', 'unid', 'um'),
    precio: find('precio', 'costo', 'costounitario', 'pvp', 'neto'),
    iva: find('iva', 'impuesto'),
    barcode: find('barcode', 'ean', 'ean13', 'codebar', 'codigobarra'),
  };
}

function calcularCostos(costo: number, incluyeIva: boolean, iva: number) {
  if (incluyeIva) {
    const costoBruto = costo;
    const costoNeto = +(costo / (1 + iva)).toFixed(5);
    return { costoNeto, costoBruto };
  } else {
    const costoNeto = costo;
    const costoBruto = +(costo * (1 + iva)).toFixed(5);
    return { costoNeto, costoBruto };
  }
}

/**
 * 1) Trigger al subir archivo a Storage: uploads/listas-precios/...
 *    Crea doc en `listas_precios` y subcolección `items`, estado: 'procesado'
 */
export const onListaPreciosUpload = onObjectFinalized(async (event) => {
  const filePath = event.data.name ?? '';
  if (!filePath.startsWith('uploads/listas-precios/')) return;

  const bucketName = event.data.bucket;
  const bucket = admin.storage().bucket(bucketName);
  const [buffer] = await bucket.file(filePath).download();

  const wb = xlsx.read(buffer, { type: 'buffer' });
  const sheet = wb.Sheets[wb.SheetNames[0]];
  const rows = xlsx.utils.sheet_to_json<any>(sheet, { defval: '' });
  if (!rows.length) return;

  const headers = Object.keys(rows[0]);
  const cols = detectarColumnas(headers);

  // proveedor_YYYYMMDD*.xlsx
  const base = filePath.split('/').pop() ?? 'lista.xlsx';
  const m = base.match(/(.+?)_(\d{4})(\d{2})(\d{2})/);
  const proveedor_id = (m?.[1] || 'proveedor').replace(/[^a-zA-Z0-9_-]/g, '').toLowerCase();
  const fecha_corte = m ? Date.UTC(+m[2], +m[3] - 1, +m[4]) : Date.now();

  const listaRef = db.collection('listas_precios').doc();
  const meta: ListaMeta = {
    proveedor_id,
    fecha_corte,
    moneda: 'BOB',
    incluye_iva: false,    // default; luego puedes ajustarlo en UI si lo necesitas
    iva: 0.13,
    archivo_origen: `gs://${bucketName}/${filePath}`,
    estado: 'cargado',
  };
  await listaRef.set(meta);

  const batch = db.batch();
  const itemsCol = listaRef.collection('items');

  for (const r of rows) {
    const sku = String(r[cols.sku ?? 'SKU'] ?? '').trim();
    const nombre = String(r[cols.nombre ?? 'NOMBRE'] ?? '').trim();
    const unidad = (String(r[cols.unidad ?? 'UNIDAD'] ?? '').trim()) || 'u';
    const precioRaw = parseFloat(String(r[cols.precio ?? 'PRECIO'] ?? '').toString().replace(',', '.')) || 0;
    const ivaRaw = cols.iva ? parseFloat(String(r[cols.iva] ?? '').toString().replace(',', '.')) / 100 : NaN;
    const barcode = cols.barcode ? String(r[cols.barcode] ?? '').trim() : '';

    if (!sku || !nombre || !precioRaw) continue;

    const item: ItemLista = {
      sku_proveedor: sku,
      nombre_proveedor: nombre,
      unidad,
      barcode,
      costo: precioRaw,
      incluye_iva: meta.incluye_iva,
      iva: Number.isFinite(ivaRaw) ? ivaRaw : meta.iva,
    };

    batch.set(itemsCol.doc(), item);
  }

  await batch.commit();
  await listaRef.update({ estado: 'procesado' });
});

/**
 * 2) Callable HTTPS: publicar lista -> crear/actualizar `ofertas_proveedor`
 *    y marcar la lista como 'publicado'
 */
export const publicarLista = onCall(async (request) => {
  const uid = request.auth?.uid;
  if (!uid) {
    throw new Error('UNAUTHENTICATED');
  }

  const listaId: string = request.data?.listaId;
  if (!listaId) throw new Error('Falta listaId');

  const listaRef = db.collection('listas_precios').doc(listaId);
  const listaSnap = await listaRef.get();
  if (!listaSnap.exists) throw new Error('Lista no encontrada');

  const meta = listaSnap.data() as ListaMeta;
  const itemsSnap = await listaRef.collection('items').get();

  const now = Date.now();
  const batch = db.batch();

  for (const d of itemsSnap.docs) {
    const it = d.data() as ItemLista;
    const { costoNeto, costoBruto } = calcularCostos(it.costo, it.incluye_iva, it.iva);

    const ofertaId = `${meta.proveedor_id}_${it.sku_proveedor}`
      .toLowerCase()
      .replace(/[^a-z0-9_-]/g, '');

    const ofertaRef = db.collection('ofertas_proveedor').doc(ofertaId);
    batch.set(
      ofertaRef,
      {
        proveedor_id: meta.proveedor_id,
        sku_proveedor: it.sku_proveedor,
        producto_id: null,
        nombre: it.nombre_proveedor,
        barcode: it.barcode || null,
        unidad: it.unidad || 'u',
        costo_neto: +costoNeto.toFixed(5),
        costo_bruto: +costoBruto.toFixed(5),
        incluye_iva: it.incluye_iva,
        iva: it.iva,
        vigente_desde: meta.fecha_corte,
        activo: true,
        fuente_lista_id: listaId,
        actualizado_en: now,
      },
      { merge: true }
    );
  }

  batch.update(listaRef, { estado: 'publicado' });
  await batch.commit();

  return { ok: true, items: itemsSnap.size };
});
