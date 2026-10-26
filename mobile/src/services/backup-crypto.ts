import { gcm } from '@noble/ciphers/aes';
import { pbkdf2Async } from '@noble/hashes/pbkdf2';
import { sha256 } from '@noble/hashes/sha256';
import { fromByteArray, toByteArray } from 'base64-js';
import * as Crypto from 'expo-crypto';
const iterations = 210000;
export async function encryptBackup(bytes: Uint8Array, password: string, revision: number) {
  if (password.length < 12) throw new Error('Use uma senha de backup com pelo menos 12 caracteres.');
  const salt = Crypto.getRandomBytes(16), nonce = Crypto.getRandomBytes(12);
  const key = await pbkdf2Async(sha256,new TextEncoder().encode(password),salt,{c:iterations,dkLen:32});
  try {
    const ciphertext = gcm(key,nonce).encrypt(bytes);
    return JSON.stringify({format:'financeiro-backup',version:1,kdf:'pbkdf2-sha256',iterations,revision,salt:fromByteArray(salt),nonce:fromByteArray(nonce),ciphertext:fromByteArray(ciphertext)});
  } finally { key.fill(0); }
}
export async function decryptBackup(text: string, password: string) {
  const data = JSON.parse(text);
  if (data.format !== 'financeiro-backup' || data.version !== 1 || data.kdf !== 'pbkdf2-sha256' || data.iterations !== iterations) throw new Error('Formato de backup incompatível.');
  const salt = toByteArray(data.salt), nonce = toByteArray(data.nonce);
  if (salt.length !== 16 || nonce.length !== 12) throw new Error('Backup inválido.');
  const key = await pbkdf2Async(sha256,new TextEncoder().encode(password),salt,{c:iterations,dkLen:32});
  try { return gcm(key,nonce).decrypt(toByteArray(data.ciphertext)); }
  finally { key.fill(0); }
}
