import {loadBankData,applyBankSnapshot} from '../data/pluggyRepository';
import {loadImportStart} from '../services/importPreferences';
// Dev-only replay of the real collector result. No credentials in the bundle/device.
let pending:Promise<void>|undefined;
export function prepareRealBankValidation(){
 if(!__DEV__||process.env.EXPO_PUBLIC_ISOLATED_BANK_VALIDATION!=='1')return Promise.resolve();
 return pending??=(async()=>{if(await loadBankData())return;const response=await fetch('http://127.0.0.1:8099/__validation/snapshot');if(!response.ok)throw Error('A cópia isolada dos bancos ainda não está disponível.');const data=await response.json();if(!data.scope||!Array.isArray(data.records))throw Error('Cópia de validação inválida.');await applyBankSnapshot(data);})();
}
export async function refreshRealBankValidation(){
 if(!__DEV__||process.env.EXPO_PUBLIC_ISOLATED_BANK_VALIDATION!=='1')return null;
 const from=await loadImportStart(),phase=from<'2026-08-01'?'extended':'first';
 const response=await fetch('http://127.0.0.1:8099/__validation/snapshot?phase='+phase);if(!response.ok)throw Error('Cópia isolada indisponível.');
 const data=await response.json();data.records=data.records.filter((r:any)=>r.kind!=='transaction'||r.date>=from).map((r:any)=>r.kind==='account'||r.kind==='card'?{...r,metadata:{...r.metadata,historyFrom:from}}:r);return applyBankSnapshot(data);
}
