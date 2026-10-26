export function validDay(value:string){return /^\d{4}-\d{2}-\d{2}$/.test(value)&&Number.isFinite(Date.parse(value))&&new Date(value+'T12:00:00Z').toISOString().slice(0,10)===value;}
export function validateImportStart(value:string,today:string){if(!validDay(value)||value>today)throw Error('Informe uma data inicial válida, até hoje.');return value;}
export function defaultImportStart(today:string){const date=new Date(today+'T12:00:00Z');date.setUTCDate(1);date.setUTCMonth(date.getUTCMonth()-2);return date.toISOString().slice(0,10);}
