'use strict';
(() => {
  const key='real-discord-oauth-state';
  window.RealDiscord={
    init({request}){
      const button=document.getElementById('discord-connect'),message=document.getElementById('discord-feedback');
      let generation=0,connected=false,guildUrl='',busy=false;
      const clear=()=>{generation++;connected=false;guildUrl='';busy=false;button.disabled=true;button.textContent='디스코드 연결';button.removeAttribute('aria-busy');message.textContent='';};
      const show=async()=>{
        const attempt=++generation;button.disabled=true;
        try{
          const result=await request('/api/discord-status');
          if(attempt!==generation)return;
          connected=result.connected===true;guildUrl=result.guildUrl||'';
          button.textContent=connected?'디스코드 열기':'디스코드 연결';
          button.disabled=result.enabled!==true||result.reviewRequired===true;
          message.textContent=result.reviewRequired?'이용 권한은 운영자 확인이 필요합니다.':!result.enabled?'연결 준비 중입니다.':connected?'게임 계정 연결 완료':'게임 계정으로 인증하고 참여하세요.';
        }catch(error){if(attempt===generation)message.textContent=error.message;}
      };
      button.addEventListener('click',async()=>{
        if(button.disabled||busy)return;
        if(connected){
          try{const url=new URL(guildUrl);if(url.origin!=='https://discord.com'||!/^\/channels\/[0-9]{17,20}$/.test(url.pathname))throw Error();window.open(url.href,'_blank','noopener,noreferrer');}catch{message.textContent='디스코드 주소를 확인하지 못했습니다.';}
          return;
        }
        const attempt=generation;busy=true;button.disabled=true;button.setAttribute('aria-busy','true');message.textContent='디스코드 인증 화면으로 이동합니다.';
        try{
          const result=await request('/api/discord-start',{});
          if(attempt!==generation)return;
          const url=new URL(result.authorizationUrl);
          if(url.origin!=='https://discord.com'||url.pathname!=='/oauth2/authorize'||!/^[a-f0-9]{64}$/.test(result.state)||url.searchParams.get('state')!==result.state)throw Error('인증 주소를 확인하지 못했습니다.');
          sessionStorage.setItem(key,result.state);
          location.assign(url.href);
        }catch(error){if(attempt===generation){message.textContent=error.message;button.disabled=false;}}
        finally{if(attempt===generation){busy=false;button.removeAttribute('aria-busy');}}
      });
      return {enable:show,clear};
    }
  };
})();
