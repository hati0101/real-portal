'use strict';

(() => {
  const termsVersion = '2026-10-21';
  const page = document.body.dataset.page;
  const apiStatus = document.getElementById('api-status');
  const apiBase = resolveApiBase(window.REAL_API_BASE);
  const errorMessages = {
    IP_ALREADY_REGISTERED: '이 IP에서는 이미 계정을 생성했습니다. 기존 계정으로 로그인해 주세요.',
    USERID_TAKEN: '이미 사용 중인 아이디입니다.',
    PASSWORD_MISMATCH: '비밀번호 확인이 일치하지 않습니다.',
    TERMS_REQUIRED: '약관에 동의해 주세요.',
    INVALID_CREDENTIALS: '아이디 또는 비밀번호를 확인해 주세요.',
    REGISTRATION_CLOSED: '현재 신규 가입을 받지 않습니다.'
  };

  function resolveApiBase(value) {
    if (typeof value !== 'string' || !value.trim()) return null;
    try {
      const url = new URL(value);
      if (url.protocol !== 'https:' || url.username || url.password || url.search || url.hash || !['', '/'].includes(url.pathname)) return null;
      return url.origin;
    } catch {
      return null;
    }
  }

  async function request(path, data) {
    if (!apiBase) throw new Error('계정 연결을 준비하고 있습니다. 연결이 완료되면 이용하실 수 있습니다.');
    const options = {
      method: data === undefined ? 'GET' : 'POST',
      credentials: 'include',
      cache: 'no-store',
      headers: { 'Accept': 'application/json', 'X-Requested-With': 'REAL-Portal' }
    };
    if (data !== undefined) {
      options.headers['Content-Type'] = 'application/json';
      options.body = JSON.stringify(data);
    }
    let response;
    try {
      response = await fetch(apiBase + path, options);
    } catch {
      throw new Error('서버에 연결하지 못했습니다. 연결 상태를 확인하고 다시 시도해 주세요.');
    }
    let payload;
    try {
      payload = await response.json();
    } catch {
      throw new Error('요청을 처리하지 못했습니다. 잠시 후 다시 시도해 주세요.');
    }
    if (!payload || typeof payload !== 'object') throw new Error('요청을 처리하지 못했습니다. 잠시 후 다시 시도해 주세요.');
    if (!response.ok) {
      const message = typeof payload.message === 'string' && payload.message.trim() ? payload.message : errorMessages[payload.error] || '요청을 처리하지 못했습니다. 잠시 후 다시 시도해 주세요.';
      const error = new Error(message);
      error.status = response.status;
      error.code = payload.error;
      throw error;
    }
    return payload;
  }

  function feedback(element, message, success = false) {
    element.textContent = message;
    element.hidden = !message;
    element.classList.toggle('is-success', success);
    if (message) element.focus();
  }

  function setBusy(form, busy, label) {
    form.setAttribute('aria-busy', String(busy));
    for (const element of form.elements) element.disabled = busy;
    const button = form.querySelector('[type="submit"]');
    button.querySelector('span').textContent = label;
    for (const tab of document.querySelectorAll('[role="tab"]')) tab.disabled = busy;
  }

  function clearFieldErrors(form) {
    for (const input of form.querySelectorAll('input')) {
      input.removeAttribute('aria-invalid');
      input.removeAttribute('aria-describedby');
    }
  }

  function validationError(form, input, message) {
    const output = form.querySelector('.form-feedback');
    output.textContent = message;
    output.hidden = false;
    input.setAttribute('aria-invalid', 'true');
    input.setAttribute('aria-describedby', output.id);
    input.focus();
  }

  if (!apiBase) {
    apiStatus.textContent = '계정 연결 준비 중입니다. 연결이 완료되면 로그인과 회원가입을 이용하실 수 있습니다.';
    apiStatus.hidden = false;
  }

  if (page === 'login') {
    const tabs = Array.from(document.querySelectorAll('[role="tab"]'));
    let registrationOpen = false;
    function selectTab(tab) {
      if (tab.id === 'register-tab' && !registrationOpen) return;
      for (const item of tabs) {
        const selected = item === tab;
        item.setAttribute('aria-selected', String(selected));
        item.tabIndex = selected ? 0 : -1;
        document.getElementById(item.getAttribute('aria-controls')).hidden = !selected;
      }
      const registering = tab.id === 'register-tab';
      const recovering = tab.id === 'recover-tab';
      document.getElementById('panel-title').textContent = recovering ? '계정 복구' : registering ? 'REAL을 시작하세요.' : '반갑습니다.';
      document.getElementById('panel-description').textContent = recovering ? '기존 게임 계정의 잠금 상태를 확인합니다.' : registering ? '홈페이지와 게임에서 사용할 계정을 만드세요.' : '기존 게임 아이디로 바로 로그인하세요.';
      for (const output of document.querySelectorAll('.form-feedback')) feedback(output, '');
      for (const form of document.querySelectorAll('form')) clearFieldErrors(form);
    }
    tabs.forEach(tab => {
      tab.addEventListener('click', () => selectTab(tab));
      tab.addEventListener('keydown', event => {
        if (!['ArrowLeft', 'ArrowRight', 'Home', 'End'].includes(event.key)) return;
        event.preventDefault();
        const visibleTabs = tabs.filter(item => !item.hidden && !item.disabled);
        const index = visibleTabs.indexOf(tab);
        const nextIndex = event.key === 'Home' ? 0 : event.key === 'End' ? visibleTabs.length - 1 : (index + (event.key === 'ArrowRight' ? 1 : -1) + visibleTabs.length) % visibleTabs.length;
        visibleTabs[nextIndex].focus();
        selectTab(visibleTabs[nextIndex]);
      });
    });

    function updateRegistration(open) {
      registrationOpen = open === true && Boolean(apiBase);
      const registerTab = document.getElementById('register-tab');
      registerTab.hidden = !registrationOpen;
      document.querySelector('.auth-tabs').classList.toggle('registration-closed', !registrationOpen);
      document.getElementById('registration-status').hidden = registrationOpen;
      for (const input of document.querySelectorAll('#register-form input, #register-form [type="submit"], #register-form .password-toggle')) input.disabled = !registrationOpen;
      if (!registrationOpen && registerTab.getAttribute('aria-selected') === 'true') selectTab(document.getElementById('login-tab'));
    }

    updateRegistration(false);
    if (apiBase) {
      request('/api/config').then(config => updateRegistration(config.registrationOpen)).catch(() => {
        updateRegistration(false);
        document.getElementById('registration-status').textContent = '현재 가입 접수 상태를 확인하지 못했습니다. 잠시 후 다시 시도해 주세요.';
      });
    }

    for (const toggle of document.querySelectorAll('[data-password-target]')) {
      toggle.addEventListener('click', () => {
        const input = document.getElementById(toggle.dataset.passwordTarget);
        const visible = input.type === 'password';
        input.type = visible ? 'text' : 'password';
        toggle.setAttribute('aria-pressed', String(visible));
        toggle.setAttribute('aria-label', visible ? '비밀번호 숨기기' : '비밀번호 표시');
      });
    }

    const dialog = document.getElementById('terms-dialog');
    document.querySelector('.terms-open').addEventListener('click', () => dialog.showModal());
    document.getElementById('terms-close').addEventListener('click', () => dialog.close());
    document.getElementById('terms-confirm').addEventListener('click', () => dialog.close());

    for (const form of document.querySelectorAll('form')) {
      if (!apiBase) {
        for (const input of form.querySelectorAll('input, [type="submit"], .password-toggle')) input.disabled = true;
      } else if (form.id !== 'register-form') {
        form.querySelector('[type="submit"]').disabled = false;
      }
      form.addEventListener('submit', async event => {
        event.preventDefault();
        if (!apiBase) {
          feedback(form.querySelector('.form-feedback'), '계정 연결 준비 중입니다. 잠시 후 다시 방문해 주세요.');
          return;
        }
        if (form.getAttribute('aria-busy') === 'true') return;
        const registering = form.id === 'register-form';
        const recovering = form.id === 'recover-form';
        const output = form.querySelector('.form-feedback');
        if (registering && !registrationOpen) {
          feedback(output, errorMessages.REGISTRATION_CLOSED);
          return;
        }
        feedback(output, '');
        clearFieldErrors(form);
        const useridInput = form.elements.namedItem('userid');
        const passwordInput = form.elements.namedItem('password');
        const userid = useridInput.value.trim();
        const password = passwordInput.value;
        if (!userid) return validationError(form, useridInput, '계정을 입력해 주세요.');
        if (!password) return validationError(form, passwordInput, '비밀번호를 입력해 주세요.');
        const body = { userid, password };
        if (registering) {
          const confirmInput = form.elements.namedItem('passwordConfirm');
          const termsInput = form.elements.namedItem('termsAccepted');
          if (!confirmInput.value) return validationError(form, confirmInput, '비밀번호 확인을 입력해 주세요.');
          if (password !== confirmInput.value) return validationError(form, confirmInput, errorMessages.PASSWORD_MISMATCH);
          if (!termsInput.checked) return validationError(form, termsInput, errorMessages.TERMS_REQUIRED);
          body.passwordConfirm = confirmInput.value;
          body.termsAccepted = true;
          body.termsVersion = termsVersion;
        }
        const readyLabel = recovering ? '복구 요청' : registering ? '계정 만들기' : '로그인';
        setBusy(form, true, recovering ? '잠금 상태를 확인하는 중…' : registering ? '계정을 만드는 중…' : '로그인 중…');
        try {
          const result = await request(recovering ? '/api/recover' : registering ? '/api/register' : '/api/login', body);
          if (recovering) {
            setBusy(form, false, readyLabel);
            form.reset();
            selectTab(document.getElementById('login-tab'));
            document.getElementById('login-userid').value = userid;
            feedback(document.getElementById('login-feedback'), typeof result.message === 'string' && result.message.trim() ? result.message : '계정 복구가 완료되었습니다. 다시 로그인해 주세요.', true);
          } else {
            location.assign('./home.html');
          }
        } catch (error) {
          setBusy(form, false, readyLabel);
          if (registering && error.code === 'REGISTRATION_CLOSED') {
            updateRegistration(false);
            feedback(document.getElementById('login-feedback'), error.message);
          } else {
            feedback(output, error.message);
          }
        }
      });
    }
  }

  if (page === 'development') location.replace('./home.html#development');

  if (page === 'home') {
    const output = document.getElementById('home-feedback');
    const logout = document.getElementById('logout-button');
    const content = document.getElementById('portal-content');
    const notices = document.getElementById('notice-list');
    const patchNotes = document.getElementById('patchnotes');
    const writeButton = document.getElementById('post-write-button');
    const editor = document.getElementById('post-editor');
    const editorForm = document.getElementById('post-editor-form');
    const categoryInput = document.getElementById('post-category');
    const choiceInput = document.getElementById('post-choice');
    const editorFeedback = document.getElementById('post-feedback');
    let selectedBoard = 'notices', editorState = null, editorBusy = false;
    const downloadLink = document.getElementById('download-link');
    const adminControls = document.getElementById('admin-controls');
    const registrationSwitch = document.getElementById('registration-switch');
    const adminFeedback = document.getElementById('admin-feedback');
    let isAdmin = false;
    let registrationOpen = false;
    const support=window.RealSupport.init({request});
    const serverInfo=window.RealPortalInfo.init({request});
    const community=window.RealCommunity.init({request,navigate:category=>selectBoard(category)});
    const development=window.RealPortalInfo.initDevelopment({request});
    logout.disabled = true;

    function clearPortal() {
      content.hidden = true;
      notices.replaceChildren();
      document.getElementById('community-pinned').replaceChildren();
      patchNotes.replaceChildren();
      writeButton.hidden = true;
      downloadLink.removeAttribute('href');
      document.getElementById('download-filename').textContent = '';
      document.getElementById('download-size').textContent = '';
    }

    function renderPosts(list, posts, category, unavailable=false) {
      list.replaceChildren();
      const ordered = [...posts].sort((a,b) => Number(b.pinned)-Number(a.pinned)||b.date.localeCompare(a.date)||b.title.localeCompare(a.title,'ko',{numeric:true}));
      for (const [index, notice] of ordered.entries()) {
        if (!notice || typeof notice.title !== 'string' || typeof notice.body !== 'string' || !/^\d{4}-\d{2}-\d{2}$/.test(notice.date)) continue;
        const article = document.createElement('details');
        article.className = 'notice';
        article.open = false;
        const summary = document.createElement('summary');
        const meta = document.createElement('div');
        meta.className = 'notice-meta';
        const tag = document.createElement('span');
        tag.className = 'notice-tag';
        tag.textContent = notice.pinned ? '고정' : category === 'patchnotes' ? '패치노트' : '안내';
        const time = document.createElement('time');
        time.dateTime = notice.date;
        time.textContent = notice.date.replaceAll('-', '.');
        meta.append(tag, time);
        const title = document.createElement('h3');
        title.textContent = notice.title;
        const body = document.createElement('div');
        body.className = 'notice-body';
        for (const paragraph of notice.body.split(/\n\s*\n/)) {
          const text = document.createElement('p');
          text.textContent = paragraph;
          body.append(text);
        }
        summary.append(meta,title);
        article.append(summary,body);
        if(isAdmin && notice.id){const edit=document.createElement('button');edit.type='button';edit.className='text-button post-edit';edit.textContent='수정';edit.addEventListener('click',()=>openEditor(category,notice.id));article.append(edit);}
        list.append(article);
      }
      if (!list.childElementCount) {
        const empty = document.createElement('p');
        empty.className = 'notice-body';
        empty.textContent = unavailable ? '공지 서버에 연결하지 못했습니다. 잠시 후 다시 확인해 주세요.' : category === 'patchnotes' ? '등록된 패치노트가 없습니다.' : '등록된 공지가 없습니다.';
        list.append(empty);
      }
    }

    function renderPortal(portal) {
      if (!Array.isArray(portal.notices) || !portal.download || typeof portal.download.url !== 'string') throw new Error('홈페이지 정보를 불러오지 못했습니다. 잠시 후 다시 시도해 주세요.');
      const downloadUrl = new URL(portal.download.url);
      if (downloadUrl.protocol !== 'https:' || downloadUrl.username || downloadUrl.password) throw new Error('다운로드 정보를 확인하지 못했습니다. 잠시 후 다시 시도해 주세요.');
      clearPortal();
      renderPosts(notices,portal.notices,'notices',portal.noticesUnavailable);
      const pinned=document.getElementById('community-pinned');pinned.replaceChildren();
      for(const notice of portal.notices.filter(p=>p.pinned).slice(0,3)){const row=document.createElement('button');row.type='button';row.className='forum-pinned-row';const label=document.createElement('span');label.textContent='공지';const title=document.createElement('span');title.textContent=notice.title;row.append(label,title);row.addEventListener('click',()=>{selectBoard('notices');const item=[...notices.querySelectorAll('details')].find(el=>el.querySelector('h3')?.textContent===notice.title);if(item){item.open=true;item.scrollIntoView({block:'nearest'});}});pinned.append(row);}pinned.hidden=!pinned.childElementCount;
      renderPosts(patchNotes,Array.isArray(portal.patchNotes)?portal.patchNotes:[],'patchnotes',portal.noticesUnavailable);
      document.getElementById('account-name').textContent = typeof portal.profile?.nickname === 'string' ? portal.profile.nickname : '회원';
      writeButton.hidden = !isAdmin || !['notices','patchnotes'].includes(selectedBoard);
      downloadLink.href = downloadUrl.href;
      document.getElementById('download-filename').textContent = typeof portal.download.fileName === 'string' ? portal.download.fileName : '클라이언트 설치 파일';
      document.getElementById('download-size').textContent = typeof portal.download.sizeLabel === 'string' ? portal.download.sizeLabel : '';
      document.getElementById('download-source').textContent = downloadUrl.hostname === 'drive.google.com' ? 'Google Drive에서 새 탭으로 열립니다.' : '다운로드 페이지가 새 탭으로 열립니다.';
      content.hidden = false;
    }

    const chatOpen=document.getElementById('chat-open'),chatPanel=document.getElementById('chat-panel'),chatWrap=document.getElementById('chat-frame-wrap'),chatFeedback=document.getElementById('chat-feedback');
    const chatHandle=document.getElementById('chat-drag-handle'),chatRestore=document.getElementById('chat-restore'),chatMaximize=document.getElementById('chat-maximize');
    let chatPayload=null,chatTimer=null,chatAttempt=0,chatConnecting=false,chatPosition=null,chatDrag=null,chatMaximized=false;
    function stopChatDrag(){const drag=chatDrag;chatDrag=null;if(drag&&chatHandle.hasPointerCapture(drag.id))chatHandle.releasePointerCapture(drag.id);chatPanel.classList.remove('is-dragging');}
    function placeChat(x,y){if(chatMaximized||chatPanel.hidden||window.innerWidth<=760)return;const rect=chatPanel.getBoundingClientRect();chatPosition={x:Math.max(12,Math.min(x,window.innerWidth-rect.width-12)),y:Math.max(12,Math.min(y,window.innerHeight-rect.height-12))};chatPanel.style.left=chatPosition.x+'px';chatPanel.style.top=chatPosition.y+'px';chatPanel.style.right='auto';chatPanel.style.bottom='auto';}
    function fitChat(){if(window.innerWidth<=760){chatPanel.style.left='';chatPanel.style.top='';chatPanel.style.right='';chatPanel.style.bottom='';}else if(chatPosition)placeChat(chatPosition.x,chatPosition.y);}
    function closeChat(){stopChatDrag();chatAttempt++;chatPayload=null;chatConnecting=false;clearInterval(chatTimer);chatTimer=null;chatWrap.replaceChildren();chatPanel.hidden=true;chatRestore.hidden=true;chatOpen.setAttribute('aria-expanded','false');}
    function minimizeChat(){stopChatDrag();chatPanel.hidden=true;chatRestore.hidden=false;chatOpen.setAttribute('aria-expanded','false');chatRestore.focus();}
    document.getElementById('chat-minimize').addEventListener('click',minimizeChat);
    chatPanel.addEventListener('keydown',event=>{if(event.key==='Escape'){event.preventDefault();minimizeChat();}});
    chatMaximize.addEventListener('click',()=>{stopChatDrag();chatMaximized=!chatMaximized;chatPanel.classList.toggle('is-maximized',chatMaximized);chatMaximize.textContent=chatMaximized?'이전 크기':'크게';chatMaximize.setAttribute('aria-label',chatMaximized?'채팅창 이전 크기로 보기':'채팅창 크게 보기');chatMaximize.setAttribute('aria-pressed',String(chatMaximized));if(chatMaximized){chatPanel.style.left='';chatPanel.style.top='';chatPanel.style.right='';chatPanel.style.bottom='';}else fitChat();});
    chatHandle.addEventListener('pointerdown',event=>{if(event.button!==0||!event.isPrimary||chatMaximized||window.innerWidth<=760)return;event.preventDefault();const rect=chatPanel.getBoundingClientRect();chatDrag={id:event.pointerId,x:event.clientX,y:event.clientY,left:rect.left,top:rect.top};chatHandle.setPointerCapture(event.pointerId);chatPanel.classList.add('is-dragging');chatHandle.focus();});
    chatHandle.addEventListener('pointermove',event=>{if(chatDrag?.id===event.pointerId)placeChat(chatDrag.left+event.clientX-chatDrag.x,chatDrag.top+event.clientY-chatDrag.y);});
    for(const type of ['pointerup','pointercancel','lostpointercapture'])chatHandle.addEventListener(type,stopChatDrag);
    chatHandle.addEventListener('keydown',event=>{if(!['ArrowLeft','ArrowRight','ArrowUp','ArrowDown'].includes(event.key)||chatMaximized||window.innerWidth<=760)return;event.preventDefault();const rect=chatPanel.getBoundingClientRect(),step=event.shiftKey?5:20;placeChat(rect.left+(event.key==='ArrowRight'?step:event.key==='ArrowLeft'?-step:0),rect.top+(event.key==='ArrowDown'?step:event.key==='ArrowUp'?-step:0));});
    window.addEventListener('resize',()=>{stopChatDrag();fitChat();});
    window.addEventListener('message',event=>{
      const frame=chatWrap.querySelector('iframe');
      if(event.origin==='https://hati0101.github.io'&&event.source===frame?.contentWindow&&event.data?.type==='real-chat-ready'&&chatPayload)frame.contentWindow.postMessage({type:'real-chat-join',payload:chatPayload},'https://hati0101.github.io');
    });
    async function showChat(focus=false){
      if(chatOpen.disabled)return;
      chatPanel.hidden=false;chatRestore.hidden=true;chatOpen.setAttribute('aria-expanded','true');fitChat();if(focus)chatHandle.focus();
      if(chatPayload||chatConnecting)return;
      const attempt=++chatAttempt;chatConnecting=true;chatFeedback.textContent='채팅에 연결하고 있습니다.';
      try{
        const data=await request('/api/chat');if(attempt!==chatAttempt)return;chatPayload=data;
        document.getElementById('chat-nickname').textContent=data.nickname+' · 닉네임은 자동으로 설정됩니다.';
        const frame=document.createElement('iframe');frame.title='REAL 회원 채팅';frame.setAttribute('sandbox','allow-scripts allow-same-origin');frame.referrerPolicy='no-referrer';frame.src='https://hati0101.github.io/real-portal/chat.html';chatWrap.replaceChildren(frame);chatFeedback.textContent='';
        chatTimer=setInterval(async()=>{try{const session=await request('/api/session');if(attempt!==chatAttempt)return;if(session.authenticated!==true){closeChat();location.replace('./index.html');}else chatFeedback.textContent='';}catch(error){if(attempt!==chatAttempt)return;if(error.status===401){closeChat();location.replace('./index.html');}else chatFeedback.textContent='로그인 상태를 다시 확인하고 있습니다.';}},60000);
      }catch(error){if(attempt!==chatAttempt)return;chatFeedback.textContent=error.message;if(error.status===401){closeChat();location.replace('./index.html');}}
      finally{if(attempt===chatAttempt)chatConnecting=false;}
    }
    chatOpen.addEventListener('click',()=>showChat(true));chatRestore.addEventListener('click',()=>showChat(true));

    async function loadPortal() {
      community.clear();
      support.clear();
      serverInfo.clear();
      development.clear();
      closeChat();chatOpen.disabled=true;
      clearPortal();
      adminControls.hidden = true;
      registrationSwitch.disabled = true;
      isAdmin = false;
      apiStatus.textContent = '로그인 상태를 확인하고 있습니다.';
      apiStatus.hidden = false;
      try {
        const session = await request('/api/session');
        if (session.authenticated !== true) {
          location.replace('./index.html');
          return;
        }
        logout.disabled = false;
        isAdmin = session.user?.isAdmin === true;
        const portal = await request('/api/portal');
        renderPortal(portal);
        chatOpen.disabled=false;
        showChat();
        community.enable();
        development.enable();
        support.enable(isAdmin);
        serverInfo.enable(isAdmin);
        apiStatus.hidden = true;
        isAdmin = session.user?.isAdmin === true;
        if (isAdmin) {
          adminControls.hidden = false;
          try {
            const config = await request('/api/config');
            setRegistrationSwitch(config.registrationOpen);
            registrationSwitch.disabled = false;
          } catch (error) {
            showAdminFeedback(error.message, true);
          }
        }
      } catch (error) {
        clearPortal();
        apiStatus.hidden = true;
        if (error.status === 401) location.replace('./index.html');
        else feedback(output, error.message);
      }
    }

    const boards=['notices','patchnotes','development','community','support'];
    function selectBoard(category, focus=false, updateHistory=true) {
      if(!boards.includes(category))return;
      selectedBoard = category;
      notices.hidden = category !== 'notices';patchNotes.hidden = category !== 'patchnotes';
      document.getElementById('development').hidden = category !== 'development';
      document.getElementById('community-board').hidden = !['community','support'].includes(category);
      community.selectBoard(category);
      writeButton.hidden = !isAdmin || !['notices','patchnotes'].includes(category);
      for(const tab of document.querySelectorAll('.board-tabs [role="tab"]')){const active=tab.dataset.board===category;tab.setAttribute('aria-selected',String(active));tab.tabIndex=active?0:-1;if(active&&focus)tab.focus();}
      if(updateHistory&&location.hash!=='#'+category)history.pushState(null,'','#'+category);
    }
    for(const link of document.querySelectorAll('[data-board]'))link.addEventListener('click',event=>{if(event.ctrlKey||event.metaKey||event.shiftKey||event.altKey||event.button>0)return;event.preventDefault();selectBoard(link.dataset.board);});
    document.querySelector('.board-tabs').addEventListener('keydown',event=>{if(['ArrowLeft','ArrowRight','Home','End'].includes(event.key)){event.preventDefault();const index=boards.indexOf(selectedBoard);selectBoard(event.key==='Home'?boards[0]:event.key==='End'?boards[boards.length-1]:boards[(index+(event.key==='ArrowRight'?1:boards.length-1))%boards.length],true);}else if(event.key===' '&&event.target.matches('[role="tab"]')){event.preventDefault();selectBoard(event.target.dataset.board,true);}});
    function restoreBoard(){const category=location.hash.slice(1);if(boards.includes(category))selectBoard(category,false,false);else if(!location.hash)selectBoard('notices',false,false);}
    window.addEventListener('hashchange',restoreBoard);
    window.addEventListener('popstate',restoreBoard);
    selectBoard(boards.includes(location.hash.slice(1))?location.hash.slice(1):'notices',false,false);
    if(!location.hash)history.replaceState(null,'','#notices');
    function editorLock(busy){editorBusy=busy;for(const control of editorForm.elements)control.disabled=busy;editorForm.setAttribute('aria-busy',String(busy));}
    function fillEditor(id=''){
      const posts=editorState[categoryInput.value].posts;
      choiceInput.replaceChildren(new Option('새 글 작성',''));
      for(const post of [...posts].sort((a,b)=>b.draft.date.localeCompare(a.draft.date))){choiceInput.add(new Option((post.published?'':'[초안] ')+post.draft.title,post.id));}
      choiceInput.value=posts.some(p=>p.id===id)?id:'';
      const post=posts.find(p=>p.id===choiceInput.value);
      document.getElementById('post-title').value=post?.draft.title||'';
      document.getElementById('post-body').value=post?.draft.body||'';
      document.getElementById('post-date').value=post?.draft.date||new Intl.DateTimeFormat('en-CA',{timeZone:'Asia/Seoul',year:'numeric',month:'2-digit',day:'2-digit'}).format(new Date());
      document.getElementById('post-pinned').checked=post?.draft.pinned===true;
      document.getElementById('post-unpublish').hidden=!post?.published;
    }
    async function openEditor(category=selectedBoard,id=''){
      if(!isAdmin||editorBusy)return;
      editor.showModal();editorLock(true);feedback(editorFeedback,'글 목록을 불러오고 있습니다.');
      try{editorState=await request('/api/post-list');categoryInput.value=id?Object.keys(editorState).find(key=>editorState[key].posts.some(post=>post.id===id))||category:category;fillEditor(id);feedback(editorFeedback,'');}
      catch(error){feedback(editorFeedback,error.message);editorState=null;}
      finally{editorLock(false);if(!editorState)for(const button of editorForm.querySelectorAll('[type="submit"]'))button.disabled=true;}
    }
    writeButton.addEventListener('click',()=>openEditor());
    document.getElementById('post-editor-close').addEventListener('click',()=>{if(!editorBusy)editor.close();});
    editor.addEventListener('cancel',event=>{if(editorBusy)event.preventDefault();});
    categoryInput.addEventListener('change',()=>{if(editorState)fillEditor();});
    choiceInput.addEventListener('change',()=>{if(editorState)fillEditor(choiceInput.value);});
    editorForm.addEventListener('submit',async event=>{
      event.preventDefault();if(!isAdmin||editorBusy||!editorState)return;
      const category=categoryInput.value,action=event.submitter?.dataset.action||'publish';
      const payload={category,revision:editorState[category].revision,id:choiceInput.value||undefined,action,post:{title:document.getElementById('post-title').value,body:document.getElementById('post-body').value,date:document.getElementById('post-date').value,pinned:document.getElementById('post-pinned').checked}};
      editorLock(true);feedback(editorFeedback,'저장하고 있습니다.');
      try{const saved=await request('/api/post-save',payload);editorState=saved;categoryInput.value=saved.category;fillEditor(saved.id);renderPortal(await request('/api/portal'));feedback(editorFeedback,action==='draft'?'초안을 저장했습니다. 회원에게는 게시되지 않습니다.':action==='unpublish'?'홈페이지에서 게시를 내렸습니다.':'홈페이지에 게시했습니다.',true);}
      catch(error){feedback(editorFeedback,error.message);}
      finally{editorLock(false);}
    });

    if (apiBase) loadPortal();
    window.addEventListener('pageshow', event => {
      if (event.persisted && apiBase) loadPortal();
    });
    window.addEventListener('pagehide', () => {
      community.clear();
      development.clear();
      support.clear();
      serverInfo.clear();
      closeChat();
      clearPortal();
      adminControls.hidden = true;
    });

    function setRegistrationSwitch(open) {
      registrationOpen = open === true;
      registrationSwitch.checked = registrationOpen;
      document.getElementById('registration-switch-label').textContent = registrationOpen ? '열림' : '닫힘';
    }

    function showAdminFeedback(message, failed = false) {
      adminFeedback.textContent = message;
      adminFeedback.hidden = !message;
      adminFeedback.classList.toggle('is-error', failed);
    }

    registrationSwitch.addEventListener('change', async () => {
      if (!isAdmin || registrationSwitch.disabled) return;
      const open = registrationSwitch.checked;
      registrationSwitch.disabled = true;
      adminControls.setAttribute('aria-busy', 'true');
      showAdminFeedback('가입 접수 설정을 변경하고 있습니다.');
      try {
        const result = await request('/api/registration-setting', { open });
        setRegistrationSwitch(result.registrationOpen);
        showAdminFeedback(registrationOpen ? '신규 가입 접수를 열었습니다.' : '신규 가입 접수를 닫았습니다.');
      } catch (error) {
        setRegistrationSwitch(registrationOpen);
        if (error.status === 401) {
          clearPortal();
          location.assign('./index.html');
          return;
        }
        showAdminFeedback(error.message, true);
      } finally {
        registrationSwitch.disabled = false;
        adminControls.removeAttribute('aria-busy');
      }
    });
    logout.addEventListener('click', async () => {
      if (logout.disabled) return;
      logout.disabled = true;
      logout.setAttribute('aria-busy', 'true');
      feedback(output, '');
      try {
        await request('/api/logout', {});
        community.clear();support.clear();serverInfo.clear();development.clear();
        closeChat();
        clearPortal();
        location.assign('./index.html');
      } catch (error) {
        if (error.status === 401) {
          clearPortal();
          location.assign('./index.html');
          return;
        }
        logout.disabled = false;
        logout.removeAttribute('aria-busy');
        feedback(output, error.message);
      }
    });
  }
})();
