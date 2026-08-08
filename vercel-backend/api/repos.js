import { getGitHubRepos } from '../lib/github.js';

export default async function handler(req, res) {
  if (req.method !== 'GET') {
    res.status(405).json({ error: 'Method not allowed' });
    return;
  }

  // TODO: receber token/mocked auth e buscar repositórios do GitHub.
  const repos = await getGitHubRepos();
  res.status(200).json({ repos });
}
