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

  let userPrompt = 'Analyze the following files:\n';
  for (const f of fileEntries) {
    userPrompt += `\n--- FILE: ${f.path} ---\n`;
    userPrompt += f.content + '\n';
  }

  userPrompt += `\nFor each file, list problems found categorized into Security, Code Quality, and Best Practices. Provide approximate line numbers when possible. If no problems, return an empty array for problemas. Return EXACTLY a single JSON array.`;

  // Call AI
  const aiResp = await callAI({ system, prompt: userPrompt });

  // Expect aiResp to be a parsed JSON array
  if (!Array.isArray(aiResp)) {
    throw new Error('AI returned invalid analysis format (not an array)');
  }

  // Normalize and return
  return { files: aiResp };
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
