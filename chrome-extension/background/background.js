// Service worker do background da extensão.
// Usado para gerenciar mensagens entre popup, content script e APIs externas.

import { saveSession } from '../util/auth/auth.js';
import { SUPABASE_URL, SUPABASE_ANON_KEY } from '../config.js';

chrome.runtime.onInstalled.addListener(() => {
  console.log('GitHub IA Analyzer instalado.');
});

chrome.runtime.onMessage.addListener((message, sender, sendResponse) => {
  // TODO: implementar comunicação e encaminhamento de dados.
  if (message && message.type === 'START_GITHUB_LOGIN') {
    // Inicia o fluxo OAuth usando chrome.identity.launchWebAuthFlow
    startGitHubLogin().then(() => {
      sendResponse({ status: 'started' });
    }).catch(err => {
      console.error('Erro iniciando login', err);
      sendResponse({ status: 'error', error: String(err) });
    });
    // Indicate we'll respond asynchronously
    return true;
  }
  sendResponse({ status: 'not-implemented' });
});

async function startGitHubLogin() {
  // Constrói a URL de autorização do Supabase para o provider GitHub.
  // Usamos `chrome.identity.getRedirectURL()` para obter a redirect URI
  // registrada na dashboard do Supabase (adicionar essa URL lá é necessário).
  const redirectUri = chrome.identity.getRedirectURL('supabase-callback');

  // Pedimos o scope `repo` conforme requisito. A URL abaixo é um padrão
  // compatível com Supabase / GoTrue authorize endpoint.
  const scopes = encodeURIComponent('repo read:user user:email');
  const authUrl = `${SUPABASE_URL.replace(/\/$/, '')}/auth/v1/authorize?provider=github&redirect_to=${encodeURIComponent(redirectUri)}&scope=${scopes}`;

  const interactive = true;
  return new Promise((resolve, reject) => {
    chrome.identity.launchWebAuthFlow({ url: authUrl, interactive }, async (redirectUrl) => {
      if (chrome.runtime.lastError) {
        reject(chrome.runtime.lastError);
        return;
      }

      // DEBUG: mostra a redirectUrl completa recebida para diagnóstico
      console.log('DEBUG - redirectUrl completa:', redirectUrl);

      // `redirectUrl` conterá os parâmetros enviados pelo provedor/Supabase.
      // Normalmente inclui um `code` que precisa ser trocado por tokens
      // usando a `service_role` key do Supabase — essa troca deve ocorrer
      // em backend seguro.
      try {
        // O Supabase no fluxo implícito retorna tokens no fragmento da URL (após '#')
        const fragment = redirectUrl.split('#')[1] || '';
        const params = new URLSearchParams(fragment);

        const access_token = params.get('access_token');
        const provider_token = params.get('provider_token');
        const refresh_token = params.get('refresh_token');
        const expires_in = params.get('expires_in');

        if (!access_token) {
          reject(new Error('OAuth callback não retornou access_token no fragmento.'));
          return;
        }

        // Busca dados do usuário usando o access_token retornado pelo Supabase
        const userUrl = `${SUPABASE_URL.replace(/\/$/, '')}/auth/v1/user`;
        const userResp = await fetch(userUrl, {
          method: 'GET',
          headers: {
            Authorization: `Bearer ${access_token}`,
            apikey: SUPABASE_ANON_KEY,
          },
        });

        if (!userResp.ok) {
          const text = await userResp.text();
          throw new Error(`Falha ao buscar usuário: ${userResp.status} ${text}`);
        }

        const userData = await userResp.json();

        // Monta o objeto de sessão conforme solicitado
        const sessionObj = {
          access_token,
          provider_token,
          refresh_token,
          expires_in: expires_in ? Number(expires_in) : null,
          user: {
            id: userData.id ?? null,
            email: userData.email ?? null,
            name: userData.user_metadata?.full_name || userData.email || null,
            avatar_url: userData.user_metadata?.avatar_url || null,
            raw: userData,
          },
        };

        await saveSession(sessionObj);
        chrome.runtime.sendMessage({ type: 'AUTH_UPDATED' });
        resolve();
      } catch (err) {
        reject(err);
      }
    });
  });
}
