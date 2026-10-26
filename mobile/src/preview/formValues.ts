// Same editing mask as Apps Script maskMoneyValue; this is a display value, not cents.
export function maskMoneyValue(value:string,complete=false){
 let text=String(value??'').replace(/R\$|\s/g,'');if(!text)return '';
 const negative=text.startsWith('-');text=text.replace(/[^\d,]/g,'');const parts=text.split(','),integer=(parts.shift()||'0').replace(/^0+(?=\d)/,''),fraction=parts.join('').slice(0,2);
 return (negative?'-':'')+integer.replace(/\B(?=(\d{3})+(?!\d))/g,'.')+(complete?','+fraction.padEnd(2,'0'):parts.length||text.includes(',')?','+fraction:'');
}
export function parseMoneyCents(value:string){
 const text=value.trim().replace(/R\$|\s/g,'');if(!text)return 0;
 const normalized=/^-?\d{1,3}(\.\d{3})+(,\d{1,2})?$/.test(text)?text.replace(/\./g,'').replace(',','.'):/^-?\d+(?:[.,]\d{1,2})?$/.test(text)?text.replace(',','.'):'';
 return normalized?Math.round(Number(normalized)*100):NaN;
}
