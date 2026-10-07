(() => {
  'use strict';
  const editor=document.querySelector('.journal-editor');
  if(!editor) return;
  const slug=editor.dataset.journal;
  const page=document.querySelector('.trip-page');
  const places={uk:'UNITED KINGDOM',barcelona:'BARCELONA',milan:'MILAN',venice:'VENICE',rome:'ROME',prague:'PRAGUE',vienna:'VIENNA',budapest:'BUDAPEST'};
  if(page) {
    const label=document.createElement('div');label.className='notebook-label';
    const category=document.createElement('span');category.textContent='旅行手账';
    const place=document.createElement('span');place.textContent=places[slug]||'';
    label.append(category,place);page.querySelector('.page-title').before(label);
  }
  const input=editor.querySelector('#journal-markdown');
  const preview=editor.querySelector('.journal-preview');
  const panes=editor.querySelector('.journal-panes');
  const source=editor.querySelector('.journal-source');
  const toolbar=editor.querySelector('.journal-toolbar');
  const tools=editor.querySelector('.journal-writing-tools');
  const help=editor.querySelector('.journal-help');
  const saveButton=editor.querySelector('.journal-save');
  const status=editor.querySelector('.journal-status');
  const notice=editor.querySelector('.journal-notice');
  const driveForm=editor.querySelector('.journal-drive-tools');
  const driveInput=editor.querySelector('#journal-drive-link');
  const driveError=editor.querySelector('.journal-drive-error');
  const editToggle=editor.querySelector('.journal-edit-toggle');
  const controls=editor.querySelector('.journal-controls');
  const photoToggle=editor.querySelector('.journal-photo-toggle');
  const photoForm=editor.querySelector('.journal-photo-tools');
  const photoLinks=editor.querySelector('#journal-photo-links');
  const photoCaption=editor.querySelector('#journal-photo-caption');
  const photoWidth=editor.querySelector('#journal-photo-width');
  const photoAlign=editor.querySelector('#journal-photo-align');
  const photoArrangement=editor.querySelector('#journal-photo-arrangement');
  const photoError=editor.querySelector('.journal-photo-error');
  let photoSelection={start:0,end:0};
  const notebook=document.createElement('div');notebook.className='notebook-layout';
  const directory=document.createElement('nav');directory.className='journal-directory';directory.hidden=true;
  directory.setAttribute('aria-label','游记地点目录');
  if(page) {page.before(notebook);notebook.append(page,directory);}
  let directoryEntries=[],directoryFrame;
  function updateDirectoryPosition() {
    if(directory.hidden||!directoryEntries.length) return;
    const boundary=panes.dataset.mode==='split'?preview.getBoundingClientRect().top+65:110;
    let active=directoryEntries[0];
    for(const entry of directoryEntries) {
      if(entry.heading.getBoundingClientRect().top<=boundary) active=entry;
      else break;
    }
    directoryEntries.forEach(entry=>{
      if(entry===active) entry.link.setAttribute('aria-current','location');
      else entry.link.removeAttribute('aria-current');
    });
  }
  function scheduleDirectoryPosition() {
    cancelAnimationFrame(directoryFrame);directoryFrame=requestAnimationFrame(updateDirectoryPosition);
  }
  function buildDirectory() {
    directory.replaceChildren();directoryEntries=[];
    const headings=[...preview.querySelectorAll('h1,h2,h3')].filter(heading=>heading.textContent.trim());
    directory.hidden=!headings.length||panes.dataset.mode==='edit';
    notebook.classList.toggle('has-directory',!directory.hidden);
    if(!headings.length) return;
    const title=document.createElement('p');title.className='journal-directory-title';title.textContent='地点目录';
    const list=document.createElement('ol');list.className='journal-directory-tabs';
    const used=new Map();
    headings.forEach((heading,index)=>{
      const text=heading.textContent.trim();
      const base='journal-section-'+(text.normalize('NFKC').toLowerCase().replace(/[^\p{L}\p{N}]+/gu,'-').replace(/^-|-$/g,'')||'heading');
      const count=(used.get(base)||0)+1;used.set(base,count);
      heading.id=count===1?base:base+'-'+count;
      const item=document.createElement('li'),link=document.createElement('a');
      link.href='#'+encodeURIComponent(heading.id);link.textContent=text;link.title=text;
      link.dataset.level=heading.tagName.toLowerCase();
      link.style.setProperty('--note-color',['#e2e7c9','#e9d7b8','#ccdfdf','#e4ced0'][index%4]);
      item.append(link);list.append(item);directoryEntries.push({heading,link});
      link.addEventListener('click',event=>{
        if(event.button!==0||event.ctrlKey||event.metaKey||event.shiftKey||event.altKey) return;
        event.preventDefault();
        history.replaceState(null,'',link.getAttribute('href'));
        heading.scrollIntoView({block:'start',behavior:matchMedia('(prefers-reduced-motion: reduce)').matches?'instant':'smooth'});
        heading.setAttribute('tabindex','-1');heading.focus({preventScroll:true});
        scheduleDirectoryPosition();
      });
    });
    directory.append(title,list);scheduleDirectoryPosition();
  }
  window.addEventListener('scroll',scheduleDirectoryPosition,{passive:true});
  window.addEventListener('resize',scheduleDirectoryPosition,{passive:true});
  preview.addEventListener('scroll',scheduleDirectoryPosition,{passive:true});
  if(window.ResizeObserver) new ResizeObserver(scheduleDirectoryPosition).observe(preview);
  let editable=false,editing=false,saved='',revision='',timer,renderTimer,pending,conflict=false;
  const dirty=()=>editable&&input.value!==saved;
  const safeURL=value=>{try{return new URL(value,location.href);}catch{return null;}};
  function mode(value) {
    panes.dataset.mode=value;
    source.hidden=value==='preview';
    driveForm.hidden=!editable||!editing||value==='preview';
    preview.hidden=value==='edit';
    tools.querySelectorAll('button').forEach(button=>button.disabled=value==='preview');
    if(value==='preview') {photoForm.hidden=true;photoToggle.setAttribute('aria-expanded','false');}
    toolbar.querySelectorAll('[data-mode]').forEach(button=>button.setAttribute('aria-pressed',String(button.dataset.mode===value)));
    if(value!=='edit') render();
    else {directory.hidden=true;notebook.classList.remove('has-directory');}
  }
  async function toggleEditing() {
    if(!editable) return;
    if(editing) {
      editToggle.disabled=true;
      const success=await window.saveTravelJournal();
      editToggle.disabled=false;
      if(!success) {editToggle.focus();return;}
    }
    editing=!editing;
    controls.hidden=!editing;
    help.hidden=!editing;
    editToggle.textContent=editing?'完成编辑':'编辑';
    editToggle.setAttribute('aria-expanded',String(editing));
    mode(editing?'edit':'preview');
    if(editing) input.focus();
    else editToggle.focus();
  }
  function createDrivePreview(media,label) {
    const figure=document.createElement('figure');figure.className=`drive-embed drive-embed-${media.kind}`;
    figure.dataset.mediaKey=media.src;figure.dataset.hasLabel=String(Boolean(label));
    const makeFrame=()=>{
      const frame=document.createElement('iframe');frame.src=media.src;
      frame.title=label|| (media.kind==='folder'?'Google Drive 文件夹预览':'Google Drive 文件预览');
      frame.loading='lazy';frame.allowFullscreen=true;frame.allow='fullscreen; encrypted-media';
      frame.referrerPolicy='strict-origin-when-cross-origin';
      frame.setAttribute('sandbox','allow-scripts allow-same-origin allow-popups allow-popups-to-escape-sandbox allow-forms');
      return frame;
    };
    if(media.kind==='file') {
      const mount=document.createElement('div');mount.className='drive-photo-mount';mount.dataset.state='loading';
      const image=document.createElement('img');image.className='drive-thumbnail';image.alt=label||'云盘文件缩略图';
      image.loading='lazy';image.referrerPolicy='no-referrer';
      const hint=document.createElement('span');hint.className='drive-photo-placeholder';hint.textContent='正在加载影像…';
      image.addEventListener('load',()=>{mount.dataset.state='ready';hint.remove();},{once:true});
      image.addEventListener('error',()=>{mount.dataset.state='error';image.remove();hint.textContent='缩略图暂时无法显示，可在下方展开原文件预览。';},{once:true});
      image.src=media.thumbnail;mount.append(image,hint);figure.append(mount);
      const viewer=document.createElement('details');viewer.className='drive-file-viewer';
      const summary=document.createElement('summary');summary.textContent='展开原文件 / 播放视频';viewer.append(summary);
      viewer.addEventListener('toggle',()=>{
        if(viewer.open&&!viewer.querySelector('iframe')) viewer.append(makeFrame());
        else if(!viewer.open) viewer.querySelector('iframe')?.remove();
      });
      figure.append(viewer);
    } else figure.append(makeFrame());
    const caption=document.createElement('figcaption');
    if(label) {const title=document.createElement('span');title.textContent=label;caption.append(title);}
    if(media.kind==='folder') {const hint=document.createElement('span');hint.textContent='云盘相册';caption.append(hint);}
    const details=document.createElement('details');details.className='drive-preview-help';
    const summary=document.createElement('summary');summary.textContent='预览有问题？';details.append(summary);
    const p=document.createElement('p');p.textContent='若出现登录或权限提示，请检查云盘分享权限；若无法连接，请检查当前网络是否能访问 Google Drive。';
    const original=document.createElement('a');original.href=media.share;original.target='_blank';original.rel='noopener noreferrer';original.textContent='打开原始云盘页面';
    details.append(p,original);caption.append(details);figure.append(caption);return figure;
  }
  function createPicture(image) {
    const media=window.TravelDrivePreview?.parseShare(image.getAttribute('src')||'');
    const options=window.TravelPhotoLayout?.optionsFrom(image);
    if(media) return TravelPhotoLayout.apply(createDrivePreview(media,image.alt),options);
    const url=safeURL(image.getAttribute('src')||'');
    if(!url||!['https:','http:'].includes(url.protocol)||!image.getAttribute('src')) {image.remove();return null;}
    const mount=document.createElement('span');mount.className='journal-photo';
    image.loading='lazy';image.referrerPolicy='no-referrer';mount.append(image);
    if(image.alt) {const caption=document.createElement('span');caption.className='journal-photo-caption';caption.textContent=image.alt;mount.append(caption);}
    image.addEventListener('error',()=>{
      const hint=document.createElement('span');hint.className='journal-image-error';
      hint.append(document.createTextNode('图片暂时无法显示。请确认链接公开可访问，且指向图片文件。 '));
      const link=document.createElement('a');link.href=url.href;link.textContent='打开图片链接';link.target='_blank';link.rel='noopener noreferrer';hint.append(link);image.replaceWith(hint);
    },{once:true});
    return window.TravelPhotoLayout?TravelPhotoLayout.apply(mount,options):mount;
  }
  function embedDriveLinks() {
    if(!window.TravelDrivePreview) return;
    // Embed only standalone paragraphs, never links inside sentences or code examples.
    preview.querySelectorAll('p').forEach(paragraph=>{
      const nodes=[...paragraph.childNodes].filter(node=>!(node.nodeType===3&&!node.textContent.trim())&&!(node.nodeType===1&&node.tagName==='BR'));
      if(!nodes.length) return;
      const factories=[];
      for(const node of nodes) {
        let href,label;
        if(node.nodeType===1&&node.tagName==='IMG') {
          factories.push(()=>createPicture(node));continue;
        }
        if(node.nodeType===3) {href=node.textContent.trim();label='';}
        else if(node.nodeType===1&&node.tagName==='A') {href=node.getAttribute('href')||'';label=node.textContent;}
        else return;
        const media=TravelDrivePreview.parseShare(href);
        if(!media) return;
        if(label===href) label='';
        factories.push(()=>createDrivePreview(media,label));
      }
      const embeds=factories.map(create=>create()).filter(Boolean);
      if(embeds.length) paragraph.replaceWith(TravelPhotoLayout.gallery(embeds));
    });
    // Split prose around images; adjacent images stay in the same gallery.
    preview.querySelectorAll('p').forEach(paragraph=>{
      if(!paragraph.querySelector(':scope > img')) return;
      const replacements=[];let prose=document.createElement('p'),pictures=[];
      const flushProse=()=>{if(prose.textContent.trim()||prose.querySelector('*')) replacements.push(prose);prose=document.createElement('p');};
      const flushPictures=()=>{if(pictures.length) replacements.push(TravelPhotoLayout.gallery(pictures));pictures=[];};
      [...paragraph.childNodes].forEach(node=>{
        if(node.nodeType===1&&node.tagName==='IMG') {
          flushProse();const picture=createPicture(node);if(picture) pictures.push(picture);
        } else if(pictures.length&&((node.nodeType===3&&!node.textContent.trim())||(node.nodeType===1&&node.tagName==='BR'))) {
          // Whitespace between photos does not start a prose paragraph.
        } else {flushPictures();prose.append(node);}
      });
      flushPictures();flushProse();paragraph.replaceWith(...replacements);
    });
    // A labelled photo followed immediately by its bare source link is one photo,
    // not two pasted prints. Keep the Markdown itself untouched.
    preview.querySelectorAll('.drive-embed-file').forEach(figure=>{
      const previous=figure.previousElementSibling;
      if(previous?.matches('.drive-embed-file')&&previous.dataset.mediaKey===figure.dataset.mediaKey&&previous.dataset.hasLabel==='true'&&figure.dataset.hasLabel==='false') figure.remove();
    });
  }
  function render() {
    if(!input.value.trim()) {preview.replaceChildren();const p=document.createElement('p');p.className='empty-entry';p.textContent='游记待补充。';preview.append(p);buildDirectory();return;}
    if(!window.marked||!window.DOMPurify) {preview.textContent=input.value;notice.textContent='预览组件未加载，暂时显示 Markdown 原文。';buildDirectory();return;}
    preview.innerHTML=DOMPurify.sanitize(marked.parse(input.value,{gfm:true}),{
      ALLOWED_TAGS:['p','br','h1','h2','h3','h4','h5','h6','strong','em','del','blockquote','ul','ol','li','hr','pre','code','a','img','table','thead','tbody','tr','th','td'],
      ALLOWED_ATTR:['href','src','alt','title','start','align'],ALLOW_DATA_ATTR:false
    });
    preview.querySelectorAll('a').forEach(link=>{
      const url=safeURL(link.getAttribute('href')||'');
      if(!url||!['https:','http:','mailto:'].includes(url.protocol)) link.removeAttribute('href');
      else if(url.origin!==location.origin&&['http:','https:'].includes(url.protocol)) {link.target='_blank';link.rel='noopener noreferrer';}
    });
    window.TravelPhotoLayout?.prepare(preview);
    embedDriveLinks();
    preview.querySelectorAll('img:not(.drive-thumbnail)').forEach(image=>{
      if(image.closest('.journal-photo')) return;
      const placeholder=document.createTextNode('');image.before(placeholder);
      const picture=createPicture(image);if(picture) placeholder.replaceWith(picture);else placeholder.remove();
    });
    window.TravelPhotoLayout?.finish(preview);
    buildDirectory();
  }
  async function save() {
    clearTimeout(timer);
    if(pending) {await pending;return dirty()&&!conflict?save():!dirty();}
    if(!editable||conflict) return false;
    if(!dirty()) {status.textContent='已保存到本地';return true;}
    const markdown=input.value;
    saveButton.disabled=true;status.textContent='保存中…';
    pending=(async()=>{
      try {
        const response=await fetch(`/api/journals/${slug}`,{method:'PUT',headers:{'Content-Type':'application/json'},body:JSON.stringify({markdown,revision})});
        if(response.status===409) {conflict=true;throw new Error('这篇游记已在其他页面修改。请先下载当前草稿，再刷新页面，避免覆盖内容。');}
        if(!response.ok) throw new Error('保存失败，草稿仍留在编辑区。请重试或下载 .md 备份。');
        const result=await response.json();revision=result.revision;saved=markdown;
        notice.textContent='';status.textContent=dirty()?'有新修改，等待保存…':'已保存到本地';return true;
      } catch(error) {status.textContent='未保存';notice.textContent=error.message;return false;}
    })();
    const success=await pending;pending=undefined;saveButton.disabled=false;
    if(success&&dirty()) timer=setTimeout(save,900);
    return success;
  }
  function changed() {
    clearTimeout(timer);clearTimeout(renderTimer);
    status.textContent=dirty()?'有修改，等待保存…':'已保存到本地';
    if(dirty()&&!conflict) timer=setTimeout(save,900);
    if(panes.dataset.mode!=='edit') renderTimer=setTimeout(render,150);
  }
  toolbar.querySelectorAll('[data-mode]').forEach(button=>button.addEventListener('click',()=>mode(button.dataset.mode)));
  editToggle.addEventListener('click',toggleEditing);
  input.addEventListener('input',changed);
  input.addEventListener('select',()=>{if(!photoForm.hidden) photoSelection={start:input.selectionStart,end:input.selectionEnd};});
  saveButton.addEventListener('click',save);
  tools.querySelectorAll('[data-insert]').forEach(button=>button.addEventListener('click',()=>{
    if(button.dataset.insert==='image') {openPhotoTools();return;}
    const start=input.selectionStart,end=input.selectionEnd;
    const label=input.value.slice(start,end)||(button.dataset.insert==='image'?'照片说明':'链接文字');
    const text=`${button.dataset.insert==='image'?'!':''}[${label}](https://)`;
    input.setRangeText(text,start,end,'end');input.focus();
    const offset=start+text.indexOf('https://');input.setSelectionRange(offset,offset+8);changed();
  }));
  function openPhotoTools() {
    photoSelection={start:input.selectionStart,end:input.selectionEnd};
    const selection=input.value.slice(photoSelection.start,photoSelection.end);
    const images=[...selection.matchAll(/!\[([^\]]*)\]\((?:<([^>]+)>|([^\s]+?))\)(\{width=\d{1,3}%\s+align=[\w-]+(?:\s+layout=(?:auto|grid))?\})?/g)];
    if(images.length) {
      photoLinks.value=images.map(match=>(match[1]?match[1]+' | ':'')+(match[2]||match[3])).join('\n');
      photoCaption.value='';
      const options=TravelPhotoLayout.parseOptions(images[0][4]||'');
      if(options) {
        if(![...photoWidth.options].some(option=>option.value===String(options.width))) {
          const option=document.createElement('option');option.value=String(options.width);option.textContent=options.width+'%';photoWidth.append(option);
        }
        photoWidth.value=String(options.width);photoAlign.value=options.align;photoArrangement.value=options.layout;
      } else {photoWidth.value='100';photoAlign.value='center';photoArrangement.value='auto';}
    } else if(/^https?:\/\//.test(selection.trim())) photoLinks.value=selection.trim();
    photoError.textContent='';photoForm.hidden=false;photoToggle.setAttribute('aria-expanded','true');photoLinks.focus();
  }
  photoToggle.addEventListener('click',()=>{
    if(photoForm.hidden) openPhotoTools();
    else {photoForm.hidden=true;photoToggle.setAttribute('aria-expanded','false');input.focus();}
  });
  editor.querySelector('.journal-photo-close').addEventListener('click',()=>{photoForm.hidden=true;photoToggle.setAttribute('aria-expanded','false');photoToggle.focus();});
  photoForm.addEventListener('submit',event=>{
    event.preventDefault();
    try {
      const markdown=TravelPhotoLayout.makeMarkdown(photoLinks.value,photoCaption.value,photoWidth.value,photoAlign.value,photoArrangement.value);
      const start=Math.min(photoSelection.start,input.value.length),end=Math.min(photoSelection.end,input.value.length);
      if(input.value.length-(end-start)+markdown.length+4>input.maxLength) throw new Error('插入后超出游记长度限制，请先精简正文或下载备份。');
      input.setRangeText('\n\n'+markdown+'\n\n',start,end,'end');changed();
      photoForm.hidden=true;photoToggle.setAttribute('aria-expanded','false');mode('split');photoToggle.focus();
    } catch(error) {photoError.textContent=error.message;}
  });
  driveForm.addEventListener('submit',event=>{
    event.preventDefault();
    const media=window.TravelDrivePreview?.parseShare(driveInput.value);
    if(!media) {driveError.textContent='请粘贴有效的 Google Drive 文件或文件夹共享链接（https://drive.google.com/…）。';driveInput.focus();return;}
    driveError.textContent='';
    const start=input.selectionStart,end=input.selectionEnd;
    input.setRangeText(`\n\n${media.share}\n\n`,start,end,'end');driveInput.value='';changed();mode('split');
    if(driveForm.querySelector('button')) driveForm.querySelector('button').focus();
  });
  editor.querySelector('.journal-download').addEventListener('click',()=>{
    const url=URL.createObjectURL(new Blob([input.value],{type:'text/markdown;charset=utf-8'}));
    const link=document.createElement('a');link.href=url;link.download=slug+'.md';link.hidden=true;document.body.append(link);link.click();link.remove();setTimeout(()=>URL.revokeObjectURL(url),30000);
  });
  document.addEventListener('keydown',event=>{
    if(editable&&(event.ctrlKey||event.metaKey)&&event.key.toLowerCase()==='s') {event.preventDefault();save();}
  });
  window.addEventListener('beforeunload',event=>{if(dirty()) {event.preventDefault();event.returnValue='';}});
  window.saveTravelJournal=async()=>{
    while(dirty()) {if(!await save()) return false;}
    return true;
  };
  document.addEventListener('click',async event=>{
    const link=event.target.closest('a[href]');
    if(!link||!dirty()||event.defaultPrevented||event.button!==0||event.ctrlKey||event.metaKey||event.shiftKey||event.altKey||link.target==='_blank'||link.hasAttribute('download')||link.getAttribute('href').startsWith('#')) return;
    event.preventDefault();
    if(await window.saveTravelJournal()) location.assign(link.href);
  });
  async function load() {
    try {
      const local=['127.0.0.1','localhost'].includes(location.hostname);
      if(local) {
        try {
          const response=await fetch(`/api/journals/${slug}`,{cache:'no-store'});
          if(!response.ok) throw new Error('Local editor unavailable');
          const data=await response.json();
          if(typeof data.markdown!=='string'||typeof data.revision!=='string') throw new Error('Invalid journal');
          input.value=saved=data.markdown;revision=data.revision;editable=true;
        } catch {notice.textContent='本地编辑服务未连接。请运行 node preview-server.mjs 后再编辑；当前仅显示已保存的游记。';}
      }
      if(!editable) {
        const response=await fetch(`journals/${slug}.md`,{cache:'no-store'});
        if(!response.ok) throw new Error('游记读取失败，请刷新重试。');
        input.value=saved=await response.text();
      }
      if(editable) {
        input.disabled=false;saveButton.disabled=false;toolbar.hidden=tools.hidden=false;
        help.hidden=true;editToggle.hidden=false;
        status.textContent='已保存到本地';mode('preview');
      } else render();
      const entry=directoryEntries.find(item=>item.link.hash===location.hash);
      if(entry) requestAnimationFrame(()=>entry.heading.scrollIntoView({block:'start'}));
    } catch(error) {notice.textContent=error.message;preview.textContent='暂时无法读取游记。';}
  }
  load();
})();
