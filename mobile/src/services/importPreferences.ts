import * as Storage from './workerStorage';
import {loadWorkerConfig} from './worker';
import {defaultImportStart,validateImportStart} from '../data/importPeriod';
import {providerDay} from '../data/pluggyModel';
async function key(){const config=await loadWorkerConfig();return 'financeiro.import-start.'+(config?.url||'local').replace(/[^A-Za-z0-9._-]/g,'_');}
export async function loadImportStart(){const today=providerDay(new Date().toISOString()),saved=await Storage.getItemAsync(await key());return validateImportStart(saved||defaultImportStart(today),today);}
export async function saveImportStart(value:string){validateImportStart(value,providerDay(new Date().toISOString()));await Storage.setItemAsync(await key(),value);}
