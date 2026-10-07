(() => {
  'use strict';
  const alignments=['center','left','right','wrap-left','wrap-right'];
  function parseOptions(value) {
    const match=value.match(/^\{width=(\d{1,3})%\s+align=(center|left|right|wrap-left|wrap-right)(?:\s+layout=(auto|grid))?\}/);
    if(!match) return null;
    const width=Number(match[1]);
    return width>=25&&width<=100?{width,align:match[2],layout:match[3]||'auto',length:match[0].length}:null;
  }
  function apply(card,options) {
    if(!options) return card;
    card.dataset.photoWidth=String(options.width);card.dataset.photoAlign=options.align;
    card.dataset.photoLayout=options.layout||'auto';
    card.style.setProperty('--photo-width',options.width+'%');
    card.classList.add('photo-layout','photo-align-'+options.align);
    return card;
  }
  function prepare(preview) {
    preview.querySelectorAll('img').forEach(image=>{
      const next=image.nextSibling;
      if(next?.nodeType!==3) return;
      const options=parseOptions(next.textContent);
      if(!options) return;
      image.dataset.photoWidth=String(options.width);image.dataset.photoAlign=options.align;
      image.dataset.photoLayout=options.layout;
      next.textContent=next.textContent.slice(options.length);
      if(!next.textContent) next.remove();
    });
  }
  function optionsFrom(element) {
    const width=Number(element.dataset.photoWidth),align=element.dataset.photoAlign;
    return width>=25&&width<=100&&alignments.includes(align)?{width,align,layout:element.dataset.photoLayout==='grid'?'grid':'auto'}:null;
  }
  function chooseArrangement(ratios,width=800) {
    if(width<380) return {kind:'single',columns:1};
    if(ratios.some(ratio=>!Number.isFinite(ratio)||ratio<=0)) return {kind:'grid',columns:ratios.length===3?3:2};
    const portraits=ratios.map((ratio,index)=>ratio<.85?index:-1).filter(index=>index>=0);
    const landscapes=ratios.map((ratio,index)=>ratio>1.2?index:-1).filter(index=>index>=0);
    if(ratios.length===2) {
      if(landscapes.length===2) return {kind:'landscape-stack',columns:1};
      if(portraits.length===1&&landscapes.length===1) return {kind:'mixed-pair',columns:2,weights:ratios.map(ratio=>Math.max(.5,Math.min(2,ratio)))};
      return {kind:'grid',columns:2};
    }
    if(ratios.length===3&&portraits.length===1&&landscapes.length===2&&width>=540) return {kind:'portrait-stack',columns:2,portrait:portraits[0]};
    if(ratios.length===3&&portraits.length===3&&width>=620) return {kind:'grid',columns:3};
    return {kind:'masonry',columns:2};
  }
  function decorateSingle(card) {
    const image=card.querySelector('img');if(!image) return;
    const classify=()=>{
      const ratio=image.naturalWidth/image.naturalHeight;
      if(!Number.isFinite(ratio)) return;
      card.dataset.orientation=ratio<.85?'portrait':ratio>1.2?'landscape':'square';
      if(!card.classList.contains('photo-layout')&&!card.closest('.journal-gallery')) card.classList.toggle('photo-auto-portrait',ratio<.85);
    };
    image.addEventListener('load',classify,{once:true});if(image.complete) classify();
  }
  function arrangeGallery(group) {
    const cards=[...group.children];let pending;
    const update=()=>{
      if(!group.isConnected) {observer?.disconnect();return;}
      const width=group.getBoundingClientRect().width;
      const ratios=cards.map(card=>{const image=card.querySelector('img');return image?.naturalWidth/image?.naturalHeight;});
      const plan=group.dataset.photoLayout==='grid'?{kind:'grid',columns:cards.length===3?3:2}:chooseArrangement(ratios,width);
      group.dataset.arrangement=plan.kind;group.dataset.columns=String(plan.columns);
      group.style.setProperty('--gallery-columns',String(plan.columns));
      group.style.removeProperty('grid-template-columns');
      cards.forEach(card=>{card.style.removeProperty('grid-column');card.style.removeProperty('grid-row');});
      if(plan.kind==='mixed-pair') group.style.gridTemplateColumns=plan.weights.map(weight=>'minmax(0,'+weight+'fr)').join(' ');
      if(plan.kind==='portrait-stack') {
        const portraitColumn=plan.portrait===0?1:2;let row=1;
        cards.forEach((card,index)=>{
          card.style.gridColumn=String(index===plan.portrait?portraitColumn:3-portraitColumn);
          card.style.gridRow=index===plan.portrait?'1 / span 2':String(row++);
        });
      }
      if(plan.kind==='masonry') {
        const next=[1,1];
        cards.forEach(card=>{
          const column=next[0]<=next[1]?0:1;
          const span=Math.max(1,Math.ceil(card.getBoundingClientRect().height/8));
          card.style.gridColumn=String(column+1);card.style.gridRow=next[column]+' / span '+span;
          next[column]+=span+2;
        });
      }
    };
    const schedule=()=>{cancelAnimationFrame(pending);pending=requestAnimationFrame(update);};
    let lastWidth=0;
    const observer=window.ResizeObserver?new ResizeObserver(entries=>{
      let changed=false;
      for(const entry of entries) {
        if(entry.target!==group) changed=true;
        else if(Math.abs(entry.contentRect.width-lastWidth)>.5) {lastWidth=entry.contentRect.width;changed=true;}
      }
      if(changed) schedule();
    }):null;
    observer?.observe(group);
    cards.forEach(card=>{
      observer?.observe(card);card.classList.remove('photo-auto-portrait');
      const image=card.querySelector('img');
      image?.addEventListener('load',schedule,{once:true});image?.addEventListener('error',schedule,{once:true});
    });
    schedule();
  }
  function gallery(cards) {
    if(cards.length===1) return cards[0];
    const group=document.createElement('div');group.className='journal-gallery';
    group.setAttribute('role','group');group.setAttribute('aria-label','并排照片');
    group.dataset.columns=String(cards.length===3?3:2);
    apply(group,optionsFrom(cards[0]));
    cards.forEach(card=>{
      card.classList.remove('photo-layout',...alignments.map(align=>'photo-align-'+align));
      card.style.removeProperty('--photo-width');group.append(card);
    });
    arrangeGallery(group);
    return group;
  }
  function finish(preview) {
    // Only neighbouring, unformatted prints are grouped; prose and explicit
    // sizing are boundaries. Never move a photograph past a text paragraph.
    let adjacent=[];
    const flush=()=>{
      if(adjacent.length>1) {const group=gallery(adjacent);preview.insertBefore(group,adjacentBoundary);}
      adjacent=[];
    };
    let adjacentBoundary;
    [...preview.children].forEach(node=>{
      const eligible=node.matches('.drive-embed-file,.journal-photo')&&!node.classList.contains('photo-layout');
      if(eligible) {adjacent.push(node);adjacentBoundary=node.nextSibling;}
      else flush();
    });flush();
    preview.querySelectorAll('.drive-embed-file,.journal-photo').forEach(decorateSingle);
  }
  function photoURL(value) {
    try {
      const url=new URL(value);
      if(!['https:','http:'].includes(url.protocol)||url.username||url.password) return null;
      const drive=url.hostname==='drive.google.com'?window.TravelDrivePreview?.parseShare(url.href):null;
      if(url.hostname==='drive.google.com'&&drive?.kind!=='file') return null;
      return url.href;
    } catch {return null;}
  }
  function makeMarkdown(lines,caption,width,align,layout='auto') {
    width=Number(width);
    if(width<25||width>100||!Number.isInteger(width)||!alignments.includes(align)||!['auto','grid'].includes(layout)) throw new Error('请选择有效的图片宽度、位置和布局。');
    const entries=lines.split(/\r?\n/).map(line=>line.trim()).filter(Boolean);
    if(!entries.length||entries.length>4) throw new Error('请填写 1–4 个图片链接，每行一个。');
    const escapeLabel=text=>text.replace(/[\\\[\]]/g,'\\$&').replace(/[\r\n]+/g,' ');
    return entries.map((line,index)=>{
      const separator=line.lastIndexOf('|');
      const href=photoURL(separator<0?line:line.slice(separator+1).trim());
      if(!href) throw new Error('第 '+(index+1)+' 行不是有效的图片直链或 Google Drive 单个文件链接。');
      const label=separator<0?caption:line.slice(0,separator).trim();
      return '!['+escapeLabel(label||'')+'](<'+href.replace(/</g,'%3C').replace(/>/g,'%3E')+'>){width='+width+'% align='+align+' layout='+layout+'}';
    }).join('\n');
  }
  window.TravelPhotoLayout={parseOptions,apply,prepare,optionsFrom,gallery,makeMarkdown,chooseArrangement,finish};
})();
