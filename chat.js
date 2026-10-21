'use strict';
(() => {
  let mounted=false;
  window.addEventListener('message',event=>{
    if(event.source!==parent||event.origin!=='https://real-portal.pages.dev'||mounted||event.data?.type!=='real-chat-join')return;
    const data=event.data.payload;
    if(data?.room!=='realportal'||typeof data.userData!=='string'||data.userData.length>4096)return;
    mounted=true;
    const chat=document.createElement('u-chat');
    chat.setAttribute('room',data.room);chat.setAttribute('user_data',data.userData);
    document.body.replaceChildren(chat);
    const script=document.createElement('script');script.src='https://client.uchat.io/uchat.js';script.async=true;
    script.onerror=()=>{const p=document.createElement('p');p.textContent='채팅 서버에 연결하지 못했습니다. 창을 닫고 다시 열어 주세요.';document.body.replaceChildren(p);};
    document.head.append(script);
  });
  if(parent!==window)parent.postMessage({type:'real-chat-ready'},'https://real-portal.pages.dev');
})();
