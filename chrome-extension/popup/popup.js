// Script do popup da extensão.
// Gerencia a UI de login/logout e comunica com o background/auth util.

import { getSession, clearSession } from '../util/auth/auth.js';
import { fetchUserRepos } from '../util/github.js';

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
    title.textContent = r.full_name || r.name;
    title.style.fontWeight = '600';

    const desc = document.createElement('div');
    desc.textContent = r.description || '';
    desc.style.fontSize = '12px';
    desc.style.color = '#444';

    li.appendChild(title);
    li.appendChild(desc);

    li.addEventListener('click', () => {
      // Marca visualmente como selecionado
      document.querySelectorAll('.repo-item.selected').forEach(el => el.classList.remove('selected'));
      li.classList.add('selected');
      li.style.background = '#eef';
    });

    ul.appendChild(li);
  });

  repoSection.appendChild(ul);
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
