// Script do popup da extensão.
// Gerencia a UI de login/logout e comunica com o background/auth util.

import { getSession, clearSession } from '../util/auth/auth.js';
import { fetchUserRepos } from '../util/github.js';

// Estado local do popup: repositório selecionado atualmente (guardamos full_name)
let selectedRepoFullName = null;
let selectedRepoObj = null;

const loginBtn = document.getElementById('login-btn');
const logoutBtn = document.getElementById('logout-btn');
const notLogged = document.getElementById('not-logged-in');
const logged = document.getElementById('logged-in');
const userName = document.getElementById('user-name');
const userAvatar = document.getElementById('user-avatar');

async function render() {
  const loadingEl = document.getElementById('popup-loading');
  if (loadingEl) loadingEl.style.display = 'flex';

  try {
    const session = await getSession();
    if (session && session.user) {
    // Exibe informações do usuário (quando disponíveis). Caso o objeto seja
    // apenas um placeholder (ex: contém apenas `code`), mostramos estado
    // logado pendente de troca do código por tokens no backend.
    notLogged.style.display = 'none';
    logged.style.display = 'flex';
    userName.textContent = session.user.email || session.user.name || 'Usuário';
    if (session.user.avatar_url) {
      userAvatar.src = session.user.avatar_url;
    } else {
      userAvatar.src = '';
    }

    // Busca os repositórios do usuário e exibe na seção de seleção
    try {
      const repos = await fetchUserRepos(session.provider_token);
      renderRepoList(repos);
    } catch (err) {
      console.error('Erro ao buscar repositórios', err);
      const repoSection = document.getElementById('repo-selection');
      repoSection.innerHTML = `<div class="repo-error">Erro ao carregar repositórios: ${String(err)}</div>`;
    }
    } else if (session && session.code) {
    // Código OAuth recebido mas sem sessão trocada ainda.
    notLogged.style.display = 'none';
    logged.style.display = 'flex';
    userName.textContent = 'Logado (pendente)';
    userAvatar.src = '';
    } else {
      // No valid session: show only login state and clear all other sections
      notLogged.style.display = 'block';
      logged.style.display = 'none';

      // Clear selection and analysis UI to avoid showing stale data
      selectedRepoFullName = null;
      selectedRepoObj = null;
      const repoSection = document.getElementById('repo-selection');
      const actions = document.getElementById('analysis-actions');
      const result = document.getElementById('analysis-result');
      if (repoSection) repoSection.innerHTML = '';
      if (actions) actions.innerHTML = '';
      if (result) result.innerHTML = '';
    }
  } finally {
    // hide loading overlay once initial render logic completes (success or error)
    if (loadingEl) loadingEl.style.display = 'none';
    // Atualiza ações de análise sempre que a UI é renderizada
    renderAnalysisActions();
  }
}

function renderRepoList(repos) {
  const repoSection = document.getElementById('repo-selection');
  repoSection.innerHTML = '';

  const ul = document.createElement('ul');
  ul.id = 'repo-list';

  repos.forEach(r => {
    const li = document.createElement('li');
    li.className = 'repo-item';

    const title = document.createElement('div');
    title.className = 'repo-title';
    title.textContent = r.full_name || r.name;

    const desc = document.createElement('div');
    desc.className = 'repo-description';
    desc.textContent = r.description || '';

    if (selectedRepoFullName && (r.full_name === selectedRepoFullName || r.name === selectedRepoFullName)) {
      li.classList.add('selected');
      selectedRepoObj = r;
    }

    li.appendChild(title);
    li.appendChild(desc);

    li.addEventListener('click', () => {
      document.querySelectorAll('.repo-item.selected').forEach(el => el.classList.remove('selected'));
      li.classList.add('selected');
      selectedRepoFullName = r.full_name || r.name;
      selectedRepoObj = r;
      renderAnalysisActions();
    });

    ul.appendChild(li);
  });

  repoSection.appendChild(ul);
}

function renderAnalysisActions() {
  const actions = document.getElementById('analysis-actions');
  actions.innerHTML = '';

  const btn = document.createElement('button');
  btn.id = 'analyze-repo-btn';
  btn.textContent = 'Analisar repositório';
  btn.className = 'button-primary';
  btn.disabled = !selectedRepoFullName;

  btn.addEventListener('click', async () => {
    if (!selectedRepoFullName) {
      return;
    }

    btn.disabled = true;
    const originalText = btn.textContent;
    btn.textContent = 'Analisando... isso pode levar alguns segundos';
    try {
      const session = await getSession();
      if (!session || !session.provider_token) throw new Error('Sessão inválida ou token ausente');
      const repoFullNameToSend = selectedRepoFullName || (selectedRepoObj && (selectedRepoObj.full_name || selectedRepoObj.name));
      if (!repoFullNameToSend) {
        throw new Error('Selecione um repositório primeiro');
      }

      console.log('DEBUG - calling /api/analyze with repoFullName=', repoFullNameToSend);

      const resp = await fetch('https://analise-de-repositorio.vercel.app/api/analyze', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ repoFullName: repoFullNameToSend, provider_token: session.provider_token }),
      });

      if (!resp.ok) {
        const text = await resp.text();
        throw new Error(`Análise falhou: ${resp.status} ${text}`);
      }

      const data = await resp.json();
      renderAnalysisResult(data);
    } catch (err) {
      console.error('Erro durante análise', err);
      const result = document.getElementById('analysis-result');
      result.innerHTML = `<div class="analysis-error">Erro na análise: ${String(err)}</div>`;
    } finally {
      btn.disabled = !selectedRepoFullName;
      btn.textContent = originalText;
    }
  });

  actions.appendChild(btn);

  if (!selectedRepoFullName) {
    const hint = document.createElement('div');
    hint.textContent = 'Selecione um repositório para habilitar a análise.';
    actions.appendChild(hint);
  }
}

loginBtn.addEventListener('click', () => {
  // Pede ao background para iniciar o fluxo OAuth.
  chrome.runtime.sendMessage({ type: 'START_GITHUB_LOGIN' });
});

logoutBtn.addEventListener('click', async () => {
  await clearSession();
  render();
});

// Atualiza quando a extensão recebe mensagem de atualização de auth
chrome.runtime.onMessage.addListener((message, sender, sendResponse) => {
  if (message && message.type === 'AUTH_UPDATED') {
    render();
  }
});

window.addEventListener('DOMContentLoaded', render);

// Renderiza os resultados da análise retornados pelo backend/IA
function renderAnalysisResult(response) {
  const container = document.getElementById('analysis-result');
  container.innerHTML = '';

  if (!response) {
    container.textContent = 'Nenhum resultado disponível.';
    return;
  }

  if (response.error) {
    container.innerHTML = `<div class="analysis-error">Erro: ${response.error}</div>`;
    return;
  }

  const analysis = response.analysis?.files || response.analysis || response.files || response;
  if (!Array.isArray(analysis) || analysis.length === 0) {
    container.innerHTML = '<div class="analysis-empty">Nenhum problema encontrado ou análise vazia.</div>';
    return;
  }

  analysis.forEach(fileReport => {
    const fileDiv = document.createElement('div');
    fileDiv.className = 'file-report';
    const h = document.createElement('h4');
    h.textContent = fileReport.arquivo || fileReport.path || 'arquivo';
    fileDiv.appendChild(h);

    const problemas = fileReport.problemas || [];
    if (problemas.length === 0) {
      const ok = document.createElement('div');
      ok.textContent = 'Nenhum problema encontrado.';
      ok.style.color = 'green';
      fileDiv.appendChild(ok);
    } else {
      const ul = document.createElement('ul');
      problemas.forEach(p => {
        const li = document.createElement('li');
        li.innerHTML = `<strong>[${p.categoria}] ${p.severidade.toUpperCase()}</strong> - ${p.explicacao}<br/><em>Sugestão:</em> ${p.sugestao}`;
        ul.appendChild(li);
      });
      fileDiv.appendChild(ul);
    }

    container.appendChild(fileDiv);
  });
}
