'use strict';
(async()=>{
  const query=new URLSearchParams(location.search);
  history.replaceState(null,'',location.pathname);
  const output=document.getElementById('discord-result'),open=document.getElementById('discord-open');
  const home=document.getElementById('discord-home');
  const failure=message=>{output.textContent=message;output.setAttribute('role','alert');output.focus();home.textContent='홈페이지에서 다시 연결하기';};
  try{
    const state=query.get('state');
    const saved=sessionStorage.getItem('real-discord-oauth-state');
    sessionStorage.removeItem('real-discord-oauth-state');
    if(!state||state!==saved||!/^[a-f0-9]{64}$/.test(state)||['state','code','error','iss'].some(k=>query.getAll(k).length>1))throw Error('인증 요청을 확인하지 못했습니다. 홈페이지에서 다시 시작해 주세요.');
    const base=new URL(window.REAL_API_BASE);
    if(base.protocol!=='https:'||base.username||base.password||base.pathname!=='/'||base.search||base.hash)throw Error('연결 설정을 확인하지 못했습니다.');
    const body={state};
    for(const name of ['code','error','iss'])if(query.has(name))body[name]=query.get(name);
    const response=await fetch(base.origin+'/api/discord-finish',{method:'POST',credentials:'include',cache:'no-store',headers:{'Content-Type':'application/json','X-Requested-With':'REAL-Portal'},body:JSON.stringify(body)});
    const result=await response.json();
    if(!response.ok)throw Error(result.message||'연결을 완료하지 못했습니다. 다시 시도해 주세요.');
    const url=new URL(result.guildUrl);
    if(url.origin!=='https://discord.com'||!/^\/channels\/[0-9]{17,20}$/.test(url.pathname))throw Error('디스코드 주소를 확인하지 못했습니다.');
    open.href=url.href;open.hidden=false;
    if(result.connected===true){output.textContent='인증이 완료되었습니다. 디스코드 채널을 이용하실 수 있습니다.';home.textContent='홈페이지로 돌아가기';}
    else if(result.pendingScreening===true){output.textContent='디스코드에 입장했습니다. 서버 규칙에 동의한 뒤 홈페이지에서 한 번 더 연결해 주세요.';home.textContent='규칙 동의 후 다시 연결하기';}
    else throw Error('인증 상태를 확인하지 못했습니다.');
    output.focus();
  }catch(error){failure(error.message||'연결을 완료하지 못했습니다. 홈페이지에서 다시 시작해 주세요.');}
})();
