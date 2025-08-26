export const IVA = 0.13;
export const aNeto = (bruto: number) => +(bruto / (1 + IVA)).toFixed(2);
export const parteIVA = (bruto: number) => +(bruto - aNeto(bruto)).toFixed(2);
