// Tokens da prévia duram somente nesta sessão em memória: nunca localStorage/backup.
const values=new Map<string,string>();
export async function getItemAsync(key:string){return values.get(key)||null;}
export async function setItemAsync(key:string,value:string){values.set(key,value);}
