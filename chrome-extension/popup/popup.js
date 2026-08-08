// Script do popup da extensão.
// Gerencia a UI de login/logout e comunica com o background/auth util.

import { getSession, clearSession } from '../util/auth/auth.js';

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
