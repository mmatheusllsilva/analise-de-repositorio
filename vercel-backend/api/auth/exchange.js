// Endpoint stub: troque um `code` recebido do OAuth por tokens usando a
// Supabase service_role key. Esta função precisa ser implementada com
// cuidado no backend, usando a chave `SUPABASE_SERVICE_ROLE_KEY` do env
// para chamar a API do Supabase e devolver os tokens ao cliente de forma
// segura.

export default async function handler(req, res) {
  if (req.method !== 'POST') {
    res.status(405).json({ error: 'Method not allowed' });
    return;
  }

  const { code, redirect_uri } = req.body || {};
  if (!code) {
    res.status(400).json({ error: 'Missing code in request body' });
    return;
  }

  // TODO: implementar a troca do `code` por tokens com Supabase Auth
  // usando a service_role key. Consulte a documentação do Supabase para
  // o endpoint correto (`/auth/v1/token`) e envie `grant_type=authorization_code`.

  res.status(501).json({ error: 'Not implemented. Exchange code for tokens on server.' });
}
