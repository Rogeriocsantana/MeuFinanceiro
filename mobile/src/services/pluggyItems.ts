export function parsePluggyItems(value:string):string[]{
 const text=value.trim();if(!text)return [];
 let items:unknown;
 if(text.startsWith('[')){try{items=JSON.parse(text);}catch{throw new Error('Confira a lista de IDs das conexões.');}}
 else items=text.split(/[\s,]+/).filter(Boolean).map(id=>id.replace(/^(["'])(.*)\1$/,'$2'));
 if(!Array.isArray(items)||items.length>50||items.some(id=>typeof id!=='string'||!/^[a-zA-Z0-9-]{1,100}$/.test(id)))throw new Error('Informe IDs válidos, separados por linha ou vírgula.');
 return [...new Set(items as string[])];
}
