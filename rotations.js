'use strict';
window.RealRotations={init({request}){
  const list=document.getElementById('rotations-list'),status=document.getElementById('rotations-status');
  let enabled=false,generation=0,pending=null,timer=null;
  const date=value=>new Intl.DateTimeFormat('ko-KR',{dateStyle:'medium',timeStyle:'short',timeZone:'Asia/Seoul'}).format(new Date(value));
  function text(parent,tag,value,className){const el=document.createElement(tag);el.textContent=value;if(className)el.className=className;parent.append(el);return el;}
  function section(title){const el=document.createElement('section');el.className='rotation-section';text(el,'h3',title);list.append(el);return el;}
  function render(value){list.replaceChildren();const box=section('카츄아박스 · 일일 변경 품목');
    if(!value.kachua.available)text(box,'p','현재 구성을 확인할 수 없습니다. 잠시 후 다시 확인해 주세요.','form-note');
    else{const k=value.kachua;text(box,'p',date(k.appliedAt)+' 적용 · 매일 자정 변경','form-note');
      if(k.retained)text(box,'p','최근 구성 변경이 취소되어 아래의 이전 적용 구성을 유지하고 있습니다. 전 품목이 포함되는 것은 아닙니다.','form-note rotation-warning');
      text(box,'p','매일 바뀌는 추첨 품목만 표시합니다. 고정 품목은 이 목록에서 제외됩니다.','form-note');
      for(const group of k.groups){if(['상시 포함 품목','확정 지급'].includes(group.title))continue;text(box,'h4',group.title);const ul=document.createElement('ul');for(const name of group.items)text(ul,'li',name);box.append(ul);}}
    const sale=section('주간 한정 의상');list.prepend(sale);
    if(!value.weekly.available)text(sale,'p','현재 적용된 판매 구성을 확인하고 있습니다. 잠시 후 다시 확인해 주세요.','form-note');
    else{text(sale,'p',date(value.weekly.startsAt)+' ~ '+date(value.weekly.endsAt)+' · 월요일 자정 교체','form-note');const ul=document.createElement('ul');for(const item of value.weekly.items)text(ul,'li',item.name+' · '+item.part);sale.append(ul);}
    status.textContent=date(value.checkedAt)+' 확인 · 1분마다 자동 갱신';
  }
  async function refresh(){if(!enabled||document.hidden||pending!==null)return;const token=generation;pending=token;try{const value=await request('/api/rotations');if(token===generation)render(value);}catch(e){if(token!==generation)return;list.replaceChildren();status.textContent='구성을 불러오지 못했습니다. 잠시 후 자동으로 다시 확인합니다.';if(e.status===401){clear();location.replace('./index.html');}}finally{if(pending===token)pending=null;}}
  function clear(){generation++;enabled=false;pending=null;clearInterval(timer);timer=null;list.replaceChildren();status.textContent='구성을 확인하고 있습니다.';}
  document.addEventListener('visibilitychange',()=>{if(!document.hidden)refresh();});
  return {clear,enable(){clear();enabled=true;refresh();timer=setInterval(refresh,60000);}};
}};
