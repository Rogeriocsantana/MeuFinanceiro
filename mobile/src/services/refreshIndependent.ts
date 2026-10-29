/** Bank import and remote sync have independent outcomes; always attempt both. */
export async function refreshIndependent<T,R>(bank:()=>Promise<T>,remote:()=>Promise<R>):Promise<{bank:PromiseSettledResult<T>;remote:PromiseSettledResult<R>}>{
 const [bankResult]=await Promise.allSettled([Promise.resolve().then(bank)]);
 const [remoteResult]=await Promise.allSettled([Promise.resolve().then(remote)]);
 return {bank:bankResult,remote:remoteResult};
}
