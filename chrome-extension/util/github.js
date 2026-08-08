// Helpers reutilizáveis para interagir com a API do GitHub.
// Ainda não implementa autenticação, apenas stubs e contratos.

export async function fetchUserRepos(providerToken) {
  // Chama o backend para listar repositórios do usuário autenticado.
  // Recebe `providerToken` (GitHub access token) e envia no header Authorization.
  if (!providerToken) return [];

  const backendUrl = 'https://analise-de-repositorio.vercel.app/api/repos';
  const resp = await fetch(backendUrl, {
    method: 'GET',
    headers: {
      Authorization: `Bearer ${providerToken}`,
      Accept: 'application/json',
    },
  });

  if (!resp.ok) {
    const text = await resp.text();
    throw new Error(`Failed to fetch repos: ${resp.status} ${text}`);
  }

  const data = await resp.json();
  return data.repos || [];
}

export async function fetchRepoFiles(repoFullName) {
  // TODO: retornar arquivos relevantes para análise.
  return [];
}
