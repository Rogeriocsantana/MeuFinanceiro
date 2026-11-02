/** SVG dashed circles share the same hit area on Android; resolve the visible sector geometrically. */
export function donutHitIndex(values:number[],x:number,y:number,size=220):number|null{
 if(!Number.isFinite(x)||!Number.isFinite(y)||!Number.isFinite(size)||size<=0)return null;
 const cx=x-size/2,cy=y-size/2,r=Math.hypot(cx,cy);if(r<size*.3||r>size/2)return null;
 const weights=values.map(v=>Number.isFinite(v)&&v>0?v:0),total=weights.reduce((a,b)=>a+b,0);if(!total)return null;
 const angle=(Math.atan2(cy,cx)+Math.PI/2+Math.PI*2)%(Math.PI*2),point=angle/(Math.PI*2)*total;let sum=0;
 for(let i=0;i<weights.length;i++){sum+=weights[i]!;if(weights[i]!>0&&point<sum)return i;}
 return null;
}
