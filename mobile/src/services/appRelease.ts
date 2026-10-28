export const RELEASE_REPO='Rogeriocsantana/MeuFinanceiro';
export type AppRelease={version:string;versionCode:number;size:number;sha256:string;url:string;notes:string};
export function parseRelease(release:any,manifest:any,installed:number):AppRelease|null{
 if(release?.draft||release?.prerelease)return null;
 if(manifest?.packageName!=='com.roger.financeiro'||!Number.isSafeInteger(manifest.versionCode)||manifest.versionCode<=installed)return null;
 if(!/^\d+\.\d+\.\d+$/.test(manifest.version)||!/^\w{64}$/.test(manifest.sha256)||!/^[a-f0-9]{64}$/i.test(manifest.sha256))throw Error('Manifesto de atualização inválido.');
 const asset=release.assets?.find((a:any)=>a.name===manifest.apkAssetName);
 const prefix=`https://github.com/${RELEASE_REPO}/releases/download/`;
 if(!asset||!asset.browser_download_url?.startsWith(prefix)||!asset.name.endsWith('.apk')||asset.size!==manifest.size||asset.size<=0||asset.size>200*1024*1024)throw Error('Arquivo de atualização inválido.');
 return {version:manifest.version,versionCode:manifest.versionCode,size:asset.size,sha256:manifest.sha256,url:asset.browser_download_url,notes:String(release.body||'Melhorias e correções.').slice(0,12000)};
}
export async function latestRelease(installed:number):Promise<AppRelease|null>{
 const get=async(url:string)=>{const response=await fetch(url,{headers:{Accept:'application/json'},signal:AbortSignal.timeout(20000)});if(response.status===404)return null;if(!response.ok)throw Error('Não foi possível consultar as atualizações.');return response.json();};
 const release=await get(`https://api.github.com/repos/${RELEASE_REPO}/releases/latest`);if(!release)return null;
 const manifest=release.assets?.find((a:any)=>a.name==='update.json');if(!manifest)return null;
 if(!manifest.browser_download_url?.startsWith(`https://github.com/${RELEASE_REPO}/releases/download/`))throw Error('Origem de atualização inválida.');
 return parseRelease(release,await get(manifest.browser_download_url),installed);
}
