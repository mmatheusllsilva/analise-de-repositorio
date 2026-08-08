import { analyzeRepository } from '../lib/ai.js';
import { getRepoMeta, getRepoTreeFiles, fetchFileContent } from '../lib/github.js';

export const config = {
  runtime: 'nodejs18.x',
  maxDuration: 60,
};

export default async function handler(req, res) {
  if (req.method !== 'POST') {
    res.status(405).json({ error: 'Method not allowed' });
    return;
  }

  const body = req.body || {};
  const repoFullName = body.repoFullName || body.full_name || body.fullName;
  const providerToken = body.provider_token || body.providerToken || (req.headers.authorization || '').replace(/^[Bb]earer\s+/, '').trim();

  if (!repoFullName) {
    res.status(400).json({ error: 'repoFullName é obrigatório' });
    return;
  }
  if (!providerToken) {
    res.status(400).json({ error: 'Missing provider_token (GitHub token) in body or Authorization header' });
    return;
  }

  try {
    console.log('Analyze request received for repo:', repoFullName);
    // 1) Find default branch
    const meta = await getRepoMeta(repoFullName, providerToken);
    const branch = meta.default_branch || 'main';

    // 2) Get tree and filter candidate files
    const candidates = await getRepoTreeFiles(repoFullName, branch, providerToken);
    console.log(`Candidates in tree for ${repoFullName}:`, Array.isArray(candidates) ? candidates.length : String(candidates));
    if (!candidates || candidates.length === 0) {
      res.status(400).json({ error: 'No code files found in repository or repository is empty' });
      return;
    }

    // 3) Fetch contents for top N candidates to determine sizes (limit initial fetches)
    const fetchLimit = 50;
    const toFetch = candidates.slice(0, fetchLimit);

    const fetched = await Promise.all(toFetch.map(async c => {
      try {
        const content = await fetchFileContent(repoFullName, c.path, providerToken);
        return { path: c.path, content, size: content.length };
      } catch (err) {
        return null;
      }
    }));

    const validFiles = (fetched.filter(Boolean)).sort((a,b) => b.size - a.size);
    const maxFiles = 10;
    const selected = validFiles.slice(0, maxFiles);
    const partial = validFiles.length > maxFiles || candidates.length > maxFiles;
    console.log(`Repository ${repoFullName} - candidates before filter: ${candidates.length}, valid fetched: ${validFiles.length}, selected for analysis: ${selected.length}`);

    // 4) Prepare payload for AI
    const aiPayload = {
      repoFullName,
      providerToken,
      files: selected.map(f => ({ path: f.path, content: f.content })),
    };

    let analysis;
    try {
      analysis = await analyzeRepository(aiPayload);
      console.log(`AI analysis succeeded for ${repoFullName}`);
    } catch (aiErr) {
      console.error(`AI analysis failed for ${repoFullName}:`, aiErr);
      res.status(500).json({ error: 'AI analysis failed', details: String(aiErr) });
      return;
    }

    res.status(200).json({ analysis, partial, candidate_count: candidates.length, analyzed_files: selected.length });
  } catch (err) {
    console.error('Analyze error', err);
    res.status(500).json({ error: 'Analysis failed', details: String(err) });
  }
}
