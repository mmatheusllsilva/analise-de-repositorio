// Helper para chamar a API de IA (Groq, Gemini ou similar).
// Deve retornar análise estruturada por arquivo.

export async function analyzeRepository(payload) {
  const { repoFullName, providerToken, files } = payload || {};
  if (!repoFullName || !providerToken) {
    throw new Error('Missing repoFullName or providerToken');
  }

  // Monta prompt para a IA com os arquivos (limitados e possivelmente truncados)
  // Cada arquivo: { path, content }
  const maxFileChars = 20000; // limite por arquivo para o prompt

  const fileEntries = (files || []).map(f => ({
    path: f.path,
    content: f.content.length > maxFileChars ? f.content.slice(0, maxFileChars) + '\n/*...TRUNCATED*/' : f.content,
  }));

  // Prompt: instruções claras para analisar em 3 eixos e retornar SOMENTE JSON
  const system = `You are a code reviewer assistant. Analyze provided source files for Security, Code Quality, and Best Practices. Respond ONLY with a JSON array where each element has the shape: {"arquivo": "path", "problemas": [{"tipo":"short id","categoria":"seguranca|qualidade|boas_praticas","severidade":"alta|media|baixa","linha_aproximada": <number|null>, "explicacao":"...","sugestao":"..."}]}.
Do NOT include any additional prose or commentary.`;

  const batches = [];
  let currentBatch = [];
  let currentChars = 0;
  const maxBatchFiles = 3;
  const maxBatchChars = 6000;

  for (const file of fileEntries) {
    const fileChars = file.content.length;
    const exceedsCharLimit = currentBatch.length > 0 && currentChars + fileChars > maxBatchChars;
    const exceedsFileLimit = currentBatch.length >= maxBatchFiles;
    if (exceedsCharLimit || exceedsFileLimit) {
      batches.push(currentBatch);
      currentBatch = [];
      currentChars = 0;
    }
    currentBatch.push(file);
    currentChars += fileChars;
  }
  if (currentBatch.length > 0) {
    batches.push(currentBatch);
  }

  const aggregated = [];
  const errors = [];

  for (let batchIndex = 0; batchIndex < batches.length; batchIndex += 1) {
    const batch = batches[batchIndex];
    let userPrompt = 'Analyze the following files:\n';
    for (const f of batch) {
      userPrompt += `\n--- FILE: ${f.path} ---\n`;
      userPrompt += f.content + '\n';
    }
    userPrompt += `\nFor each file, list problems found categorized into Security, Code Quality, and Best Practices. Provide approximate line numbers when possible. If no problems, return an empty array for problemas. Return EXACTLY a single JSON array.`;

    try {
      const aiResp = await callAI({ system, prompt: userPrompt });
      if (!Array.isArray(aiResp)) {
        throw new Error('AI returned invalid analysis format (not an array)');
      }
      aggregated.push(...aiResp);
    } catch (err) {
      errors.push({
        batch: batchIndex + 1,
        files: batch.map(f => f.path),
        error: String(err),
      });
    }

    if (batchIndex < batches.length - 1) {
      await delay(1200);
    }
  }

  return { files: aggregated, errors, batch_count: batches.length };
}

function delay(ms) {
  return new Promise(resolve => setTimeout(resolve, ms));
}

async function callAI({ system, prompt }) {
  const GROQ_API_KEY = process.env.GROQ_API_KEY;
  if (!GROQ_API_KEY) throw new Error('GROQ_API_KEY not configured');

  // Modelo sugerido (ajustar conforme disponibilidade)
  const model = 'llama-3.3-70b-versatile';

  const body = {
    model,
    messages: [
      { role: 'system', content: system },
      { role: 'user', content: prompt }
    ],
    temperature: 0.0,
    max_tokens: 8000,
  };

  const resp = await fetch('https://api.groq.com/openai/v1/chat/completions', {
    method: 'POST',
    headers: {
      Authorization: `Bearer ${GROQ_API_KEY}`,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify(body),
  });

  if (!resp.ok) {
    const text = await resp.text();
    throw new Error(`AI call failed: ${resp.status} ${text}`);
  }

  const data = await resp.json();
  const content = data?.choices?.[0]?.message?.content;
  if (!content) throw new Error('AI returned empty content');

  // The model was instructed to return ONLY JSON. Attempt parse.
  try {
    return JSON.parse(content);
  } catch (err) {
    // Try to extract JSON substring heuristically
    const m = content.match(/(\[\s*\{[\s\S]*\}\s*\])/m);
    if (m) {
      try {
        return JSON.parse(m[1]);
      } catch (e) {
        throw new Error('AI returned malformed JSON and extraction failed');
      }
    }
    throw new Error('Failed to parse AI JSON response');
  }
}
