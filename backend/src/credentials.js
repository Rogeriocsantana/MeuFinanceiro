const encode = value => btoa(String.fromCharCode(...value));
const decode = value => Uint8Array.from(atob(value), c => c.charCodeAt(0));
const store = env => env.CREDENTIAL_STORE || env.CREDENTIALS;
export function storageReady(env) { return !!store(env) && /^[A-Za-z0-9+/]{43}=$/.test(env.CREDENTIALS_KEY || ''); }
async function key(env) { return crypto.subtle.importKey('raw', decode(env.CREDENTIALS_KEY), 'AES-GCM', false, ['encrypt','decrypt']); }
export async function saveCredentials(env, userId, value) {
 const iv=crypto.getRandomValues(new Uint8Array(12)),aad=new TextEncoder().encode(userId);
 const encrypted=await crypto.subtle.encrypt({name:'AES-GCM',iv,additionalData:aad},await key(env),new TextEncoder().encode(JSON.stringify(value)));
 await store(env).put('pluggy:'+userId,JSON.stringify({version:1,iv:encode(iv),ciphertext:encode(new Uint8Array(encrypted))}));
}
export async function readCredentials(env,userId) {
 if(!storageReady(env))return null;
 const stored=await store(env).get('pluggy:'+userId);if(!stored)return null;
 const record=JSON.parse(stored);if(record.version!==1)throw new Error('INVALID_RECORD');
 const plain=await crypto.subtle.decrypt({name:'AES-GCM',iv:decode(record.iv),additionalData:new TextEncoder().encode(userId)},await key(env),decode(record.ciphertext));
 return JSON.parse(new TextDecoder().decode(plain));
}
