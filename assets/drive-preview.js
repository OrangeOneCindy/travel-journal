(() => {
  'use strict';
  // Only trusted Google Drive URLs are converted; arbitrary iframe HTML remains blocked.
  function parseShare(value) {
    let url;try {url=new URL(value.trim());} catch {return null;}
    if(url.protocol!=='https:'||url.hostname!=='drive.google.com'||url.port||url.username||url.password) return null;
    let id,kind;
    const folder=url.pathname.match(/^\/(?:drive\/(?:u\/\d+\/)?|)folders\/([\w-]+)\/?$/);
    const file=url.pathname.match(/^\/file\/d\/([\w-]+)(?:\/(?:view|preview))?\/?$/);
    if(folder) {id=folder[1];kind='folder';}
    else if(file) {id=file[1];kind='file';}
    else if(['/folderview','/embeddedfolderview'].includes(url.pathname)) {id=url.searchParams.get('id');kind='folder';}
    else if(['/open','/uc','/thumbnail'].includes(url.pathname)) {id=url.searchParams.get('id');kind='file';}
    if(!id||! /^[\w-]{10,200}$/.test(id)) return null;
    const resourceKey=url.searchParams.get('resourcekey');
    if(resourceKey&&!/^[\w-]{1,200}$/.test(resourceKey)) return null;
    const embed=new URL(kind==='folder'?'https://drive.google.com/embeddedfolderview':`https://drive.google.com/file/d/${id}/preview`);
    if(kind==='folder') {embed.searchParams.set('id',id);embed.hash='grid';}
    if(resourceKey) embed.searchParams.set('resourcekey',resourceKey);
    const thumbnail=new URL('https://drive.google.com/thumbnail');
    thumbnail.searchParams.set('id',id);thumbnail.searchParams.set('sz','w1600');
    if(resourceKey) thumbnail.searchParams.set('resourcekey',resourceKey);
    return {kind,id,src:embed.href,share:url.href,thumbnail:kind==='file'?thumbnail.href:null};
  }
  window.TravelDrivePreview={parseShare};
})();
