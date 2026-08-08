export default async function handler(req, res) {
  if (req.method !== 'GET') {
    res.status(405).json({ error: 'Method not allowed' });
    return;
  }

  // Espera o token do GitHub no header `Authorization: Bearer <provider_token>`
  const authHeader = req.headers.authorization || req.headers.Authorization;
  if (!authHeader) {
    res.status(400).json({ error: 'Missing Authorization header with GitHub provider token' });
    return;
  }

  const token = authHeader.replace(/^[Bb]earer\s+/,'').trim();
  if (!token) {
    res.status(400).json({ error: 'Invalid Authorization header format' });
    return;
  }

  // Chama a API do GitHub para listar repositórios do usuário
  try {
    const githubUrl = 'https://api.github.com/user/repos?sort=updated&per_page=30';
    const ghResp = await fetch(githubUrl, {
      method: 'GET',
      headers: {
        Authorization: `token ${token}`,
        Accept: 'application/vnd.github.v3+json',
        'User-Agent': 'GitHub-IA-Analyzer',
      },
    });

    if (ghResp.status === 401 || ghResp.status === 403) {
      const text = await ghResp.text();
      res.status(401).json({ error: 'Invalid or expired GitHub token', details: text });
      return;
    }

    if (!ghResp.ok) {
      const text = await ghResp.text();
      res.status(ghResp.status || 500).json({ error: 'GitHub API error', details: text });
      return;
    }

    const repos = await ghResp.json();

    // Simplifica a lista para os campos necessários
    const simplified = (repos || []).map(r => ({
      name: r.name,
      full_name: r.full_name,
      description: r.description,
      private: r.private,
      language: r.language,
      updated_at: r.updated_at,
    }));

    res.status(200).json({ repos: simplified });
  } catch (err) {
    res.status(500).json({ error: 'Server error calling GitHub API', details: String(err) });
  }
}
