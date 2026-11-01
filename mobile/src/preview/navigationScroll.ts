/** A new visit starts at zero; returning to an existing stack entry reuses its key. */
export function createRouteScrollKeys(){const keys=new WeakMap<object,string>();let next=0;return(page:{key:string;name?:string})=>{let value=keys.get(page);if(!value){value=page.key+':'+(page.name||'')+':visit-'+(++next);keys.set(page,value);}return value;};}
