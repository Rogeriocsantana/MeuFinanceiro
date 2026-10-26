module.exports=({config})=>{
 const value=process.env.EXPO_PUBLIC_WORKER_URL;
 if(value){const url=new URL(value);if(url.protocol!=='https:'||url.pathname!=='/'||url.search||url.hash||url.username||url.password)throw new Error('EXPO_PUBLIC_WORKER_URL deve conter apenas a origem HTTPS.');}
 return config;
};
