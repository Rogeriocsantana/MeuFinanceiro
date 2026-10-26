import React,{useEffect,useState} from 'react';
import {Text,View} from 'react-native';
import {database} from '../data/database';
import {applyBankSnapshot,loadBankData} from '../data/pluggyRepository';
import {saveControl} from '../data/localControls';
import {savePurchaseSeries,applySavedPurchaseSeries} from '../data/purchaseRepository';
import {defaultAppPreferences,loadAppPreferences,saveAppPreferences,savePersonPhoto,loadPersonPhoto,recordDeviceEvent} from '../data/appPreferences';
import {invoiceDetails} from '../data/invoiceDetails';
import {installmentPurchases} from '../data/purchaseSeries';
import {SYNC_SCHEMA,type BankRecord} from '../data/pluggyModel';

const scope='previsual-native-validation';
function check(value:unknown,message:string){if(!value)throw Error(message);}
const purchase=(n:number):BankRecord=>({id:'native-tx'+n,kind:'transaction',itemId:'item',accountId:'card',name:'MERCADO LIVRE PARCELA '+n+'/3',institution:'Teste isolado',currency:'BRL',amountCents:-10000,date:'2026-'+String(n+8).padStart(2,'0')+'-01',invoiceMonth:'2026-'+String(n+8).padStart(2,'0'),status:'POSTED',metadata:{card:true,installmentNumber:n,totalInstallments:3}});
const bill=(n:number):BankRecord=>({...purchase(n),id:'native-bill'+n,kind:'bill',name:'Fatura',amountCents:10000,date:'2026-'+String(n+8).padStart(2,'0')+'-10',metadata:{}});
const snapshot=(records:BankRecord[])=>({scope,records,syncedAt:'2026-10-20T12:00:00Z',warnings:[]});
let pending:Promise<unknown>|undefined;
async function validate(){
 const db=await database();await db.execAsync(SYNC_SCHEMA);
 const prior=await db.getFirstAsync<{payload:string}>("SELECT payload FROM pluggy_sync WHERE scope=?",scope),checks:string[]=[];
 if(!prior){
  await applyBankSnapshot(snapshot([purchase(1),purchase(2),bill(1),bill(2)]));
  await saveControl(scope,{id:'native-person',type:'people',name:'Pessoa de teste'});
  await savePurchaseSeries(scope,'native-tx2',{label:'Teclado Mecânico',ownerId:'native-person'});
  let data=(await loadBankData())!;check(data.annotations['native-tx1']?.personId==='native-person','Dono não aplicado à primeira parcela');checks.push('owner-previous-parcels');
  await applyBankSnapshot(snapshot([purchase(3),bill(3)]));const applied=await applySavedPurchaseSeries(scope);check(applied.changed===1,'Parcela futura não recebeu decisão');
  checks.push('owner-future-parcel');data=(await loadBankData())!;
  check(data.records.find(r=>r.id==='native-tx1')!.name==='MERCADO LIVRE PARCELA 1/3','Descrição bancária mudou');checks.push('bank-original-preserved');
  const preferences=defaultAppPreferences();preferences.profile.name='Perfil de teste';preferences.refresh.intervalMinutes=15;
  preferences.profile.photo='data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mP8/x8AAwMCAO+aVocAAAAASUVORK5CYII=';
  await saveAppPreferences(scope,preferences);await savePersonPhoto(scope,'native-person',preferences.profile.photo);
  check(await recordDeviceEvent(scope,'native:invoice:2026-10',{status:'delivered'}),'Evento não gravado');checks.push('profile-photo-preferences-saved');
 }else{
  const data=(await loadBankData())!,preferences=await loadAppPreferences(scope);
  check(preferences.profile.name==='Perfil de teste'&&preferences.refresh.intervalMinutes===15,'Preferências não persistiram');
  check(await loadPersonPhoto(scope,'native-person')===preferences.profile.photo,'Foto não persistiu');
  check(data.annotations['native-tx3']?.purchaseLabel==='Teclado Mecânico'&&data.annotations['native-tx3']?.personId==='native-person','Decisão não persistiu');
  check(!(await recordDeviceEvent(scope,'native:invoice:2026-10',{})),'Evento duplicado após reinício');
  checks.push('cold-restart-profile-photo-owner-label','cold-restart-event-deduplicated');
 }
 const data=(await loadBankData())!;check((await applySavedPurchaseSeries(scope)).changed===0,'Reaplicação não idempotente');checks.push('series-idempotent');
 const invoice=invoiceDetails(data,{itemId:'item',accountId:'card',month:'2026-10',person:'native-person'});check(invoice.selectedTotalCents===10000&&invoice.days.length===1,'Consulta da fatura incorreta');checks.push('invoice-person-day-totals');
 const groups=installmentPurchases(data);check(groups.length===1&&groups[0]!.importedInstallments===3,'Consulta de parcelas incorreta');checks.push('installment-list');
 const report={ok:true,phase:prior?'restart':'first',database:'financeiro-previsual-validation.db',checks,records:data.records.length,annotations:Object.keys(data.annotations).length};
 await fetch('http://127.0.0.1:8101/report',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify(report)});return report;
}
export default function PrevisualNative(){
 const [result,setResult]=useState('Validando SQLite Android em banco isolado…');
 useEffect(()=>{(pending??=validate()).then(r=>setResult(JSON.stringify(r,null,2))).catch(async error=>{setResult(String(error));try{await fetch('http://127.0.0.1:8101/report',{method:'POST',body:JSON.stringify({ok:false,error:String(error)})});}catch{}});},[]);
 return <View style={{flex:1,padding:32,paddingTop:80,backgroundColor:'#fff'}}><Text selectable>{result}</Text></View>;
}
