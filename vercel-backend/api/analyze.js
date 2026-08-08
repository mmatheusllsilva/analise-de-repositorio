import { analyzeRepository } from '../lib/ai.js';

export default async function handler(req, res) {
  if (req.method !== 'POST') {
    res.status(405).json({ error: 'Method not allowed' });
    return;
  }

  const payload = req.body;
  // payload: { repoFullName, files: [{ path, content }] }

  const analysis = await analyzeRepository(payload);
  res.status(200).json({ analysis });
}
