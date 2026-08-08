// Service worker do background da extensão.
// Usado para gerenciar mensagens entre popup, content script e APIs externas.

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
  const { SUPABASE_URL } = await import('../config.js');
  const redirectUri = chrome.identity.getRedirectURL('supabase-callback');

  // Pedimos o scope `repo` conforme requisito. A URL abaixo é um padrão
  // compatível com Supabase / GoTrue authorize endpoint.
  const authUrl = `${SUPABASE_URL.replace(/\/$/, '')}/auth/v1/authorize?provider=github&redirect_to=${encodeURIComponent(redirectUri)}&scope=repo`;

  const interactive = true;
  return new Promise((resolve, reject) => {
    chrome.identity.launchWebAuthFlow({ url: authUrl, interactive }, async (redirectUrl) => {
      if (chrome.runtime.lastError) {
        reject(chrome.runtime.lastError);
        return;
      }

      // `redirectUrl` conterá os parâmetros enviados pelo provedor/Supabase.
      // Normalmente inclui um `code` que precisa ser trocado por tokens
      // usando a `service_role` key do Supabase — essa troca deve ocorrer
      // em backend seguro.
      try {
        const urlObj = new URL(redirectUrl);
        const code = urlObj.searchParams.get('code');
        if (!code) {
          reject(new Error('OAuth callback não retornou código.'));
          return;
        }

        const { saveSession } = await import('../util/auth/auth.js');
        const backendUrl = 'https://analise-de-repositorio.vercel.app/api/auth/exchange';

        const exchangeResponse = await fetch(backendUrl, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ code, redirect_uri: redirectUri }),
        });

        if (!exchangeResponse.ok) {
          const errorText = await exchangeResponse.text();
          throw new Error(`Falha na troca de código: ${exchangeResponse.status} ${errorText}`);
        }

        const session = await exchangeResponse.json();
        await saveSession(session);

        chrome.runtime.sendMessage({ type: 'AUTH_UPDATED' });
        resolve();
      } catch (err) {
        reject(err);
      }
    });
  });
}
