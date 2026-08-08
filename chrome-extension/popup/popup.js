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
    notLogged.style.display = 'block';
    logged.style.display = 'none';
  }

  // Atualiza ações de análise sempre que a UI é renderizada
  renderAnalysisActions();
}

function renderRepoList(repos) {
  const repoSection = document.getElementById('repo-selection');
  repoSection.innerHTML = '';

  const ul = document.createElement('ul');
  ul.id = 'repo-list';
  ul.style.listStyle = 'none';
  ul.style.padding = '0';

  repos.forEach(r => {
    const li = document.createElement('li');
    li.className = 'repo-item';
    li.style.padding = '8px';
    li.style.borderBottom = '1px solid #eee';
    li.style.cursor = 'pointer';

    const title = document.createElement('div');
    title.className = 'repo-title';
    title.textContent = r.full_name || r.name;
    title.style.fontWeight = '600';

    const desc = document.createElement('div');
    desc.className = 'repo-description';
    desc.textContent = r.description || '';
    desc.style.fontSize = '12px';
    desc.style.color = '#444';

    const icon = document.createElement('span');
    icon.className = 'repo-icon';
    icon.textContent = '✓';
    icon.style.display = 'none';

    if (selectedRepoFullName && (r.full_name === selectedRepoFullName || r.name === selectedRepoFullName)) {
      li.classList.add('selected');
      li.style.background = '#2563eb';
      icon.style.display = 'inline-block';
      selectedRepoObj = r;
    }

    li.appendChild(icon);
    li.appendChild(title);
    li.appendChild(desc);

    li.addEventListener('click', () => {
        // Marca visualmente como selecionado e guarda o repositório selecionado
        document.querySelectorAll('.repo-item.selected').forEach(el => {
          el.classList.remove('selected');
          el.style.background = '';
          const prevIcon = el.querySelector('.repo-icon');
          if (prevIcon) prevIcon.style.display = 'none';
        });
        li.classList.add('selected');
        li.style.background = '#2563eb';
        icon.style.display = 'inline-block';
        selectedRepoFullName = r.full_name || r.name;
        selectedRepoObj = r;
        // Atualiza a seção de ações para mostrar o botão de analisar
        renderAnalysisActions();
    });

    // If this repo was previously selected, apply selection styles
    if (selectedRepoFullName && (r.full_name === selectedRepoFullName || r.name === selectedRepoFullName)) {
      li.classList.add('selected');
      li.style.background = '#eef';
      selectedRepoObj = r;
    }

    ul.appendChild(li);
  });

  repoSection.appendChild(ul);
}

// Renderiza o botão de "Analisar repositório" quando houver um repositório selecionado
function renderAnalysisActions() {
  const actions = document.getElementById('analysis-actions');
  actions.innerHTML = '';

  if (!selectedRepoFullName) {
    // Show a disabled button or instruction to select a repo
    const hint = document.createElement('div');
    hint.textContent = 'Selecione um repositório para habilitar a análise.';
    hint.style.fontSize = '12px';
    hint.style.color = '#666';
    actions.appendChild(hint);
    return;
  }

  const btn = document.createElement('button');
  btn.id = 'analyze-repo-btn';
  btn.textContent = 'Analisar repositório';
  btn.style.padding = '8px 12px';
  btn.style.marginTop = '8px';

    btn.addEventListener('click', async () => {
    // Estado de carregamento ao iniciar a análise
    btn.disabled = true;
    const originalText = btn.textContent;
    btn.textContent = 'Analisando... isso pode levar alguns segundos';
    try {
      // Chama o backend /api/analyze com full_name e provider_token
      const session = await getSession();
      if (!session || !session.provider_token) throw new Error('Sessão inválida ou token ausente');
      // Validate that a repo is selected before calling backend
      const repoFullNameToSend = selectedRepoFullName || (selectedRepoObj && (selectedRepoObj.full_name || selectedRepoObj.name));
      if (!repoFullNameToSend) {
        throw new Error('Selecione um repositório primeiro');
      }

      // DEBUG log: mostrar qual repoFullName será enviado
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
      const analysis = data.analysis || data.analysis?.files || data;
      renderAnalysisResult(data);
    } catch (err) {
      console.error('Erro durante análise', err);
      const result = document.getElementById('analysis-result');
      result.innerHTML = `<div class="analysis-error">Erro na análise: ${String(err)}</div>`;
    } finally {
      btn.disabled = false;
      btn.textContent = originalText;
    }
  });

  actions.appendChild(btn);
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
