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

  if (page === 'home') {
    const output = document.getElementById('home-feedback');
    const logout = document.getElementById('logout-button');
    const content = document.getElementById('portal-content');
    const notices = document.getElementById('notice-list');
    const downloadLink = document.getElementById('download-link');
    const adminControls = document.getElementById('admin-controls');
    const registrationSwitch = document.getElementById('registration-switch');
    const adminFeedback = document.getElementById('admin-feedback');
    let isAdmin = false;
    let registrationOpen = false;
    logout.disabled = true;

    function clearPortal() {
      content.hidden = true;
      notices.replaceChildren();
      downloadLink.removeAttribute('href');
      document.getElementById('download-filename').textContent = '';
      document.getElementById('download-size').textContent = '';
    }

    function renderPortal(portal) {
      if (!Array.isArray(portal.notices) || !portal.download || typeof portal.download.url !== 'string') throw new Error('홈페이지 정보를 불러오지 못했습니다. 잠시 후 다시 시도해 주세요.');
      const downloadUrl = new URL(portal.download.url);
      if (downloadUrl.protocol !== 'https:' || downloadUrl.username || downloadUrl.password) throw new Error('다운로드 정보를 확인하지 못했습니다. 잠시 후 다시 시도해 주세요.');
      clearPortal();
      for (const notice of portal.notices) {
        if (!notice || typeof notice.title !== 'string' || typeof notice.body !== 'string' || !/^\d{4}-\d{2}-\d{2}$/.test(notice.date)) continue;
        const article = document.createElement('article');
        article.className = 'notice';
        const meta = document.createElement('div');
        meta.className = 'notice-meta';
        const tag = document.createElement('span');
        tag.className = 'notice-tag';
        tag.textContent = '안내';
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
        article.append(meta, title, body);
        notices.append(article);
      }
      if (!notices.childElementCount) {
        const empty = document.createElement('p');
        empty.className = 'notice-body';
        empty.textContent = '등록된 공지가 없습니다.';
        notices.append(empty);
      }
      downloadLink.href = downloadUrl.href;
      document.getElementById('download-filename').textContent = typeof portal.download.fileName === 'string' ? portal.download.fileName : '클라이언트 설치 파일';
      document.getElementById('download-size').textContent = typeof portal.download.sizeLabel === 'string' ? portal.download.sizeLabel : '';
      document.getElementById('download-source').textContent = downloadUrl.hostname === 'drive.google.com' ? 'Google Drive에서 새 탭으로 열립니다.' : '다운로드 페이지가 새 탭으로 열립니다.';
      content.hidden = false;
    }

    async function loadPortal() {
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
        if (typeof session.user?.userid === 'string') document.getElementById('account-name').textContent = session.user.userid;
        logout.disabled = false;
        const portal = await request('/api/portal');
        renderPortal(portal);
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

    if (apiBase) loadPortal();
    window.addEventListener('pageshow', event => {
      if (event.persisted && apiBase) loadPortal();
    });
    window.addEventListener('pagehide', () => {
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
