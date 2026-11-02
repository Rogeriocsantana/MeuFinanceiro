import type {Control} from './localControls';
const snapshots=new Map<string,Control[]>();
/** Last local read, scoped to the signed-in dataset; never persisted or synchronized. */
export function rememberControls(scope:string,controls:Control[]){snapshots.set(scope,controls);}
export function cachedControls(scope:string):Control[]{return snapshots.get(scope)||[];}

export function hasControlSnapshot(scope:string){return snapshots.has(scope);}
