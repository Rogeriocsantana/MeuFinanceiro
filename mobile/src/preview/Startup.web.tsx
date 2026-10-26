import React from 'react';
// The browser preview has no native launch splash.
const ready=()=>{};
export const useStartupReady=()=>ready;
export default function Startup({children}:{children:React.ReactNode}){return <>{children}</>;}
