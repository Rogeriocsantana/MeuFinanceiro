import React from 'react';
import {useTheme} from './Theme';
export default function LoadingVisual({active,placement='top'}:{active:boolean;placement?:'top'|'bottom'}){
 const {dark}=useTheme();
 return <><style>{`
 .preview-loading{position:absolute;left:0;right:0;height:3px;overflow:visible;z-index:2147483647;pointer-events:none;opacity:0;visibility:hidden;background:#2456b8;transition:opacity .16s ease,visibility .16s ease}
 .preview-loading.active{opacity:1;visibility:visible}
 .preview-loading>span{position:absolute;top:0;left:-30vw;width:30vw;min-width:180px;max-width:520px;height:3px;border-radius:999px;background:linear-gradient(90deg,transparent 0%,rgba(56,200,187,.18) 14%,rgba(56,200,187,.62) 34%,#38c8bb 50%,rgba(56,200,187,.62) 66%,rgba(56,200,187,.18) 86%,transparent 100%);box-shadow:0 0 7px rgba(56,200,187,.28);animation:previewLoadingTravel 2.1s cubic-bezier(.42,0,.58,1) infinite}
 .preview-loading>span::after{content:"";position:absolute;left:50%;top:50%;width:54px;height:8px;transform:translate(-50%,-50%);border-radius:999px;background:radial-gradient(ellipse at center,#5fe0d3 0%,#38c8bb 35%,rgba(56,200,187,.72) 58%,transparent 78%);box-shadow:0 0 5px rgba(56,200,187,.62),0 0 12px rgba(56,200,187,.28)}
 .preview-loading.dark>span::after{box-shadow:0 0 6px rgba(56,200,187,.72),0 0 14px rgba(56,200,187,.34)}
 @keyframes previewLoadingTravel{0%{translate:0 0}48%{translate:65vw 0}100%{translate:130vw 0}}
 @media(prefers-reduced-motion:reduce){.preview-loading>span{animation:none;left:35%}}
 `}</style><div style={placement==='bottom'?{bottom:0}:{top:0}} role={active?'progressbar':undefined} aria-label={active?'Carregando':undefined} aria-busy={active} aria-hidden={!active} className={'preview-loading'+(active?' active':'')+(dark?' dark':'')}><span/></div></>;
}
