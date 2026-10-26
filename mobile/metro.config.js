const {getDefaultConfig}=require('expo/metro-config');
const config=getDefaultConfig(__dirname);
// Optional local dependency cache for emulator development.
if(process.env.FINANCEIRO_NODE_MODULES)config.resolver.nodeModulesPaths=[...(config.resolver.nodeModulesPaths||[]),process.env.FINANCEIRO_NODE_MODULES];
if(!config.resolver.assetExts.includes('wasm'))config.resolver.assetExts.push('wasm');
const previous=config.server.enhanceMiddleware;
config.server.enhanceMiddleware=(middleware,server)=>{const inner=previous?previous(middleware,server):middleware;return(req,res,next)=>{if(process.env.EXPO_PUBLIC_ISOLATED_BANK_VALIDATION==='1'&&['/__validation/snapshot','/__validation/snapshot?phase=first','/__validation/snapshot?phase=extended'].includes(req.url)){if(!['127.0.0.1','::1','::ffff:127.0.0.1'].includes(req.socket.remoteAddress)){res.writeHead(403);res.end();return;}const fs=require('node:fs'),path=require('node:path');res.setHeader('Cache-Control','no-store');res.setHeader('Content-Type','application/json');try{res.end(fs.readFileSync(path.join(__dirname,'.private/real-bank-validation-2026-10-20/'+(req.url.endsWith('phase=extended')?'extended':'first')+'-snapshot.json')));}catch{res.writeHead(503);res.end('{}');}return;}res.setHeader('Cross-Origin-Opener-Policy','same-origin');res.setHeader('Cross-Origin-Embedder-Policy','credentialless');return inner(req,res,next);};};
module.exports=config;
