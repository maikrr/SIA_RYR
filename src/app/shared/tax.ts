export const IVA = 0.13;

/** Convierte precio bruto (con IVA) a neto (sin IVA) */
export const toNeto = (bruto: number) => +(bruto / (1 + IVA)).toFixed(2);

/** Obtiene la parte de IVA desde un precio bruto (con IVA) */
export const ivaParte = (bruto: number) => +(bruto - toNeto(bruto)).toFixed(2);
