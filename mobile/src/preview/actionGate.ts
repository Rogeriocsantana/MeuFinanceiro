/** A synchronous lock closes the gap before React renders a disabled button. */
export function createActionGate(onChange:(id:string|null)=>void,delayMs:number,sleep=(ms:number)=>new Promise<void>(resolve=>setTimeout(resolve,ms))){
 let locked=false,active=true;
 return {
  activate(){active=true;},
  dispose(){active=false;},
  async run(id:string,work:()=>void|Promise<void>){
   if(locked||!active)return false;
   locked=true;onChange(id);
   try{if(delayMs>0)await sleep(delayMs);if(!active)return false;await work();return true;}
   finally{locked=false;if(active)onChange(null);}
  },
 };
}
