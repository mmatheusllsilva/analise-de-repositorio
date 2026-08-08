// GitHub helpers para backend Vercel.
// Aqui serão implementados os adaptadores para a API do GitHub e OAuth.

export async function getGitHubRepos() {
  // TODO: implementar chamada ao GitHub API para listar repositórios.
  return [];
}

export async function getRepoFiles(repoFullName) {
  // Deprecated: use getRepoTreeFiles with token. Kept for compatibility.
  return [];
}

// Fetch repository metadata (to get default branch)
export async function getRepoMeta(repoFullName, token) {
  const url = `https://api.github.com/repos/${repoFullName}`;
  const resp = await fetch(url, {
    headers: {
      Authorization: token ? `token ${token}` : undefined,
      Accept: 'application/vnd.github.v3+json',
      'User-Agent': 'GitHub-IA-Analyzer',
    },
  });
  if (!resp.ok) throw new Error(`Failed to get repo meta: ${resp.status} ${await resp.text()}`);
  return resp.json();
}

// Fetch tree recursively and return candidate file paths filtered by extensions and excluded folders
export async function getRepoTreeFiles(repoFullName, branch, token) {
  const url = `https://api.github.com/repos/${repoFullName}/git/trees/${encodeURIComponent(branch)}?recursive=1`;
  const resp = await fetch(url, {
    headers: {
      Authorization: token ? `token ${token}` : undefined,
      Accept: 'application/vnd.github.v3+json',
      'User-Agent': 'GitHub-IA-Analyzer',
    },
  });
  if (!resp.ok) throw new Error(`Failed to get repo tree: ${resp.status} ${await resp.text()}`);
  const data = await resp.json();
  const tree = data.tree || [];

  const includeExt = ['.js', '.ts', '.jsx', '.tsx', '.mjs', '.cjs', '.py', '.java', '.go', '.rb', '.php', '.rs', '.c', '.cpp', '.h', '.hpp', '.cs', '.swift', '.kt', '.kts', '.dart', '.scala', '.sh', '.sql', '.html', '.css', '.scss', '.sass', '.less', '.vue', '.svelte', '.json', '.yml', '.yaml'];
  const includeFilenames = ['Dockerfile', '.env.example'];
  const excludePaths = ['node_modules/', 'dist/', 'build/', '.git/', 'venv/', '__pycache__/', 'vendor/'];

  const candidates = tree.filter(item => item.type === 'blob' && item.path).filter(item => {
    const path = item.path;
    const lowerPath = path.toLowerCase();
    // exclude paths
    for (const ex of excludePaths) if (path.includes(ex)) return false;
    // include by extension allowlist
    for (const ext of includeExt) if (lowerPath.endsWith(ext)) return true;
    // include special filenames without extension
    const fileName = path.split('/').pop();
    if (includeFilenames.includes(fileName)) return true;
    return false;
  }).map(item => ({ path: item.path, url: item.url, size: item.size || 0 }));

  return candidates;
}

// Fetch file content (base64) from contents API and return decoded string
export async function fetchFileContent(repoFullName, filePath, token) {
  const url = `https://api.github.com/repos/${repoFullName}/contents/${encodeURIComponent(filePath)}`;
  const resp = await fetch(url, {
    headers: {
      Authorization: token ? `token ${token}` : undefined,
      Accept: 'application/vnd.github.v3+json',
      'User-Agent': 'GitHub-IA-Analyzer',
    },
  });
  if (!resp.ok) {
    throw new Error(`Failed to fetch file ${filePath}: ${resp.status} ${await resp.text()}`);
  }
  const data = await resp.json();
  if (!data.content) return '';
  const buff = Buffer.from(data.content, 'base64');
  return buff.toString('utf8');
}
