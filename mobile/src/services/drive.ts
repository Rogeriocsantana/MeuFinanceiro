import { GoogleSignin } from '@react-native-google-signin/google-signin';
import { backupState, snapshot, markBackedUp } from '../data/database';
import { encryptBackup } from './backup-crypto';
import * as SecureStore from 'expo-secure-store';
let running: Promise<void> | undefined;
let configured = false;
export async function connectDrive(silent = false) {
  const clientId = process.env.EXPO_PUBLIC_GOOGLE_WEB_CLIENT_ID;
  if (!clientId || clientId.startsWith('CONFIGURAR')) throw new Error('Configure o OAuth Google antes de conectar o Drive.');
  if (!configured) {
    GoogleSignin.configure({webClientId:clientId,scopes:['https://www.googleapis.com/auth/drive.appdata']});
    configured = true;
  }
  await GoogleSignin.hasPlayServices();
  if (silent) await GoogleSignin.signInSilently();
  else await GoogleSignin.signIn();
  const current = GoogleSignin.getCurrentUser();
  if (!current) throw new Error('Login Google não concluído.');
  const owner = await SecureStore.getItemAsync('drive-owner');
  if (owner && owner !== current.user.id) throw new Error('Este banco pertence a outra conta Google. Use a conta originalmente conectada.');
  await SecureStore.setItemAsync('drive-owner',current.user.id);
}
export function backupToDrive(password: string) {
  return running ??= performBackup(password).finally(() => { running = undefined; });
}
async function performBackup(password: string) {
  const owner = await SecureStore.getItemAsync('drive-owner');
  if (!owner || GoogleSignin.getCurrentUser()?.user.id !== owner) throw new Error('Reconecte a conta Google vinculada a este banco.');
  const state = await backupState();
  if ((state.revision ?? 0) <= (state.backed_up_revision ?? 0)) return;
  const { accessToken } = await GoogleSignin.getTokens();
  const { bytes, revision } = await snapshot();
  const encrypted = await encryptBackup(bytes,password,revision);
  const boundary = `financeiro_${Date.now()}`;
  const metadata = {name:`financeiro-r${revision}-${new Date().toISOString().replace(/:/g,'-')}.json.enc`,parents:['appDataFolder'],appProperties:{format:'financeiro-backup-v1',revision:String(revision)}};
  const body = `--${boundary}\r\nContent-Type: application/json; charset=UTF-8\r\n\r\n${JSON.stringify(metadata)}\r\n--${boundary}\r\nContent-Type: application/octet-stream\r\n\r\n${encrypted}\r\n--${boundary}--`;
  const response = await fetch('https://www.googleapis.com/upload/drive/v3/files?uploadType=multipart&fields=id', {method:'POST',headers:{Authorization:`Bearer ${accessToken}`,'Content-Type':`multipart/related; boundary=${boundary}`},body});
  if (!response.ok) throw new Error('Backup pendente: não foi possível enviar ao Drive.');
  const uploaded = await response.json();
  if (!uploaded.id) throw new Error('Drive não confirmou o backup.');
  // Não marcar revisões criadas durante o envio como já protegidas.
  await markBackedUp(revision);
}
