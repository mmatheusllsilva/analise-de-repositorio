// Helpers de UI para o popup.

export function renderAuthStatus(container, isAuthenticated) {
  container.innerHTML = isAuthenticated
    ? '<p>Autenticado com GitHub (mock)</p>'
    : '<p>Login não configurado</p>';
}

export function renderRepoSelection(container, repos) {
  container.innerHTML = '<p>Selecione um repositório</p>';
}
