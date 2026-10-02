declare const __ARPA_ASSETS__:Record<string,{body:string;type:string}>;
export function assetResponse(request:Request):Response|null {
  if(typeof __ARPA_ASSETS__==='undefined')return null;
  const path=new URL(request.url).pathname;
  const asset=__ARPA_ASSETS__[path]??(!path.includes('.')?__ARPA_ASSETS__['/index.html']:undefined);
  if(!asset)return null;
  const bytes=Uint8Array.from(atob(asset.body),c=>c.charCodeAt(0));
  return new Response(request.method==='HEAD'?null:bytes,{headers:{'content-type':asset.type,'cache-control':path.startsWith('/assets/')?'public,max-age=31536000,immutable':'private,no-cache','x-content-type-options':'nosniff'}});
}
