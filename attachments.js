'use strict';
window.RealImages=(()=>{
 const views=new WeakMap(),urls=new Set();
 const objectUrl=blob=>{const url=URL.createObjectURL(blob);urls.add(url);return url;};
 const revoke=url=>{URL.revokeObjectURL(url);urls.delete(url);};
 const fromBase64=(data,mime)=>new Blob([Uint8Array.from(atob(data),c=>c.charCodeAt(0))],{type:mime});
 const base64=blob=>new Promise((resolve,reject)=>{const r=new FileReader();r.onload=()=>resolve(r.result.split(',')[1]);r.onerror=reject;r.readAsDataURL(blob);});
 async function compress(file){
  if(!['image/jpeg','image/png','image/webp'].includes(file.type)||file.size>8*1024*1024)throw Error('JPG·PNG·WebP 파일을 선택해 주세요. 원본은 장당 8MB까지 가능합니다.');
  const bitmap=await createImageBitmap(file);
  try{
   if(bitmap.width*bitmap.height>25000000)throw Error('이미지 해상도가 너무 큽니다. 2,500만 화소 이하로 줄여 주세요.');
   const ratio=Math.min(1,2048/Math.max(bitmap.width,bitmap.height)),canvas=document.createElement('canvas');canvas.width=Math.max(1,Math.round(bitmap.width*ratio));canvas.height=Math.max(1,Math.round(bitmap.height*ratio));canvas.getContext('2d').drawImage(bitmap,0,0,canvas.width,canvas.height);
   for(const quality of [.86,.72,.56]){const blob=await new Promise(resolve=>canvas.toBlob(resolve,'image/webp',quality));if(blob&&blob.size<=768*1024)return {blob,width:canvas.width,height:canvas.height};}
   throw Error('이미지 용량이 큽니다. 크기를 줄여 다시 첨부해 주세요.');
  }finally{bitmap.close();}
 }
 function clearView(root){const state=views.get(root);if(state){state.cancelled=true;state.urls.forEach(revoke);}views.delete(root);root.replaceChildren();}
 function show(root,items,request){
  clearView(root);const state={cancelled:false,urls:[]};views.set(root,state);root.classList.add('image-gallery');
  for(const [index,item] of (items||[]).entries()){
   const link=document.createElement('a'),image=document.createElement('img'),caption=document.createElement('span');image.alt='첨부 이미지 '+(index+1);image.width=item.width;image.height=item.height;image.loading='lazy';caption.textContent='이미지를 불러오고 있습니다.';link.target='_blank';link.rel='noopener';link.append(image,caption);root.append(link);
   request('/api/image-read',{id:item.id}).then(data=>{if(state.cancelled)return;const url=objectUrl(fromBase64(data.data,data.mime));state.urls.push(url);image.src=url;link.href=url;caption.textContent='크게 보기';}).catch(()=>{if(!state.cancelled){image.remove();caption.textContent='이미지를 불러오지 못했습니다. 글을 다시 열어 주세요.';}});
  }
 }
 function picker(root,{request,onChange=()=>{}}){
  const label=document.createElement('label'),input=document.createElement('input'),guide=document.createElement('p'),status=document.createElement('p'),grid=document.createElement('div');let items=[],generation=0,pending=Promise.resolve();
  label.textContent='이미지 첨부';input.type='file';input.accept='image/jpeg,image/png,image/webp';input.multiple=true;input.setAttribute('aria-label','이미지 첨부');label.append(input);guide.className='form-note';guide.textContent='최대 5장 · JPG, PNG, WebP · 원본 장당 8MB. 큰 이미지는 자동으로 줄어듭니다.';status.className='image-status';status.setAttribute('role','status');grid.className='image-preview-grid';root.append(label,guide,status,grid);
  function render(){clearView(grid);for(const [index,item] of items.entries()){const card=document.createElement('div'),image=document.createElement('img'),remove=document.createElement('button');image.alt='첨부 이미지 '+(index+1);if(item.url)image.src=item.url;else{const token=generation;request('/api/image-read',{id:item.id}).then(data=>{if(token!==generation||!card.isConnected)return;item.url=objectUrl(fromBase64(data.data,data.mime));image.src=item.url;}).catch(()=>{image.alt='기존 첨부 이미지';});}remove.type='button';remove.textContent='삭제';remove.setAttribute('aria-label','첨부 이미지 '+(index+1)+' 삭제');remove.onclick=()=>{items.splice(index,1);if(item.url)revoke(item.url);render();onChange();};card.append(image,remove);grid.append(card);}}
  input.addEventListener('change',()=>{const files=Array.from(input.files),token=generation;input.value='';pending=pending.then(async()=>{if(token!==generation)return;status.textContent='이미지를 준비하고 있습니다.';try{if(items.length+files.length>5)throw Error('이미지는 최대 5장까지 첨부할 수 있습니다.');for(const file of files){const result=await compress(file);if(token!==generation)return;const data=await base64(result.blob);if(token!==generation)return;items.push({data,url:objectUrl(result.blob)});}render();onChange();status.textContent=items.length+'장 첨부했습니다.';}catch(e){if(token===generation){render();onChange();status.textContent=e.message;}}});});
  return {reset(existing=[]){generation++;for(const i of items)if(i.url)revoke(i.url);items=existing.map(i=>({id:i.id}));status.textContent='';input.value='';render();},async payload(){await pending;return items.map(i=>i.id?{id:i.id}:{data:i.data});}};
 }
 return {picker,show,clearView};
})();
