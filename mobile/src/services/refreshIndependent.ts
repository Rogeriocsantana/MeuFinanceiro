/** Bank import and remote sync have independent outcomes; always attempt both. */
export async function refreshIndependent<T>(bank:()=>Promise<T>,remote:()=>Promise<unknown>):Promise<{bank:PromiseSettledResult<T>;remote:PromiseSettledResult<unknown>}>{
 const [bankResult]=await Promise.allSettled([Promise.resolve().then(bank)]);
 const [remoteResult]=await Promise.allSettled([Promise.resolve().then(remote)]);
 return {bank:bankResult,remote:remoteResult};
}
