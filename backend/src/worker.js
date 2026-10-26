// Cloudflare adapter; the API core is portable and contains no Cloudflare imports.
import {handle} from './api.js';
export {handle,hashToken} from './api.js';
export default {fetch(request,env){
 if(new URL(request.url).protocol!=='https:'&&new URL(request.url).pathname!=='/health')return new Response('{"error":"HTTPS_REQUIRED"}',{status:426,headers:{'Content-Type':'application/json','Cache-Control':'no-store'}});
 return handle(request,env);
}};
