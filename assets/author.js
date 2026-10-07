(() => {
  const control=document.querySelector('.author-control');
  if (!control) return;
  const toggle=control.querySelector('.author-toggle');
  const panel=control.querySelector('.author-panel');
  const nameInput=control.querySelector('.author-name');
  const signatureInput=control.querySelector('.author-signature');
  const fileInput=control.querySelector('#avatar-file');
  const avatarEdit=control.querySelector('.avatar-edit');
  const status=control.querySelector('.author-status');
  const defaultAvatar='assets/avatar-default.svg';
  let profile={name:'',avatar:'',signature:''}, timer, pending=Promise.resolve(), editable=false;
  const safeAvatar=value=>typeof value==='string' && /^data:image\/(png|jpeg|webp);base64,[A-Za-z0-9+/=]+$/.test(value) ? value : '';
  function render() {
    control.querySelectorAll('.author-image').forEach(img=>{img.src=safeAvatar(profile.avatar)||defaultAvatar;});
    if (document.activeElement!==nameInput) nameInput.value=profile.name;
    if (document.activeElement!==signatureInput) signatureInput.value=profile.signature;
    toggle.title=profile.name||'作者菜单';
  }
  function open(value, focus=false) {
    panel.hidden=!value;
    toggle.setAttribute('aria-expanded',String(value));
    if (value && focus) avatarEdit.focus();
  }
  toggle.addEventListener('click',()=>open(panel.hidden));
  toggle.addEventListener('keydown',event=>{
    if (event.key==='ArrowDown') {event.preventDefault();open(true,true);}
  });
  document.addEventListener('click',event=>{if (!control.contains(event.target)) open(false);});
  document.addEventListener('keydown',event=>{
    if (event.key==='Escape'&&!panel.hidden) {open(false);toggle.focus();}
  });
  control.addEventListener('focusout',()=>setTimeout(()=>{if(!control.contains(document.activeElement))open(false);},0));
  function save() {
    clearTimeout(timer);
    if (!editable) return Promise.resolve(false);
    const snapshot={...profile};
    pending=pending.catch(()=>{}).then(async()=>{
      status.textContent='保存中…';
      const response=await fetch('/api/author',{method:'PUT',headers:{'Content-Type':'application/json'},body:JSON.stringify(snapshot)});
      if (!response.ok) throw new Error('save');
      status.textContent='已保存';
      return true;
    }).catch(()=>{status.textContent='保存失败，请重新修改后重试。';return false;});
    return pending;
  }
  const scheduleSave=()=>{clearTimeout(timer);timer=setTimeout(save,450);};
  nameInput.addEventListener('input',()=>{profile.name=nameInput.value.trim().slice(0,40);scheduleSave();});
  nameInput.addEventListener('blur',save);
  nameInput.addEventListener('keydown',event=>{if(event.key==='Enter'){event.preventDefault();save();nameInput.blur();}});
  signatureInput.addEventListener('input',()=>{profile.signature=signatureInput.value.slice(0,120);scheduleSave();});
  signatureInput.addEventListener('blur',save);
  signatureInput.addEventListener('keydown',event=>{if((event.ctrlKey||event.metaKey)&&event.key==='Enter'){event.preventDefault();save();signatureInput.blur();}});
  control.querySelector('.about-button').addEventListener('click',async event=>{
    if (!editable) return;
    event.preventDefault();
    const destination=event.currentTarget.href;
    if (await save()&&(!window.saveTravelJournal||await window.saveTravelJournal())) location.href=destination;
  });
  avatarEdit.addEventListener('click',()=>fileInput.click());
  fileInput.addEventListener('change',async()=>{
    const file=fileInput.files?.[0];
    if (!file) return;
    if (!['image/png','image/jpeg','image/webp','image/gif'].includes(file.type)||file.size>12*1024*1024) {
      status.textContent='请选择不超过 12 MB 的 PNG、JPG、WebP 或 GIF 图片。';fileInput.value='';return;
    }
    const url=URL.createObjectURL(file);
    avatarEdit.disabled=true;
    try {
      const img=new Image();img.src=url;await img.decode();
      const canvas=document.createElement('canvas');canvas.width=canvas.height=320;
      const size=Math.min(img.naturalWidth,img.naturalHeight);
      canvas.getContext('2d').drawImage(img,(img.naturalWidth-size)/2,(img.naturalHeight-size)/2,size,size,0,0,320,320);
      profile.avatar=canvas.toDataURL('image/png');render();await save();
    } catch {status.textContent='图片无法读取，请换一张图片重试。';}
    finally {URL.revokeObjectURL(url);fileInput.value='';avatarEdit.disabled=!editable;}
  });
  // Published static pages read the same saved author file; editing is available only in the local authoring preview.
  async function load() {
    try {
      const local=['127.0.0.1','localhost'].includes(location.hostname);
      let response=local?await fetch('/api/author',{cache:'no-store'}):null;
      if (response?.ok) editable=true;
      else response=await fetch('assets/author-profile.json',{cache:'no-store'});
      if (!response.ok) throw new Error('load');
      const data=await response.json();
      profile={name:typeof data.name==='string'?data.name.slice(0,40):'',avatar:safeAvatar(data.avatar),signature:typeof data.signature==='string'?data.signature.slice(0,120):''};
      render();
      nameInput.readOnly=!editable;
      signatureInput.readOnly=!editable;
      avatarEdit.disabled=!editable;
      if (!editable) status.textContent='请在本地编辑预览中修改作者资料。';
    } catch {
      nameInput.readOnly=true;signatureInput.readOnly=true;avatarEdit.disabled=true;status.textContent='作者资料暂时无法读取，请刷新重试。';
    }
  }
  nameInput.readOnly=true;signatureInput.readOnly=true;avatarEdit.disabled=true;
  load();
})();
