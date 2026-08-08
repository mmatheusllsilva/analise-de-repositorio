# Chrome Extension + Vercel Backend Skeleton

Este repositório contém a estrutura inicial para uma extensão do Chrome que analisa repositórios do GitHub usando IA, com backend serverless hospedado na Vercel.

## Estrutura de pastas

- `chrome-extension/`
  - `manifest.json` — configuração básica da extensão
  - `popup/` — HTML, CSS e JS da interface popup
  - `background/` — service worker do manifest v3
  - `content/` — content script para rodar no contexto do GitHub
  - `util/` — helpers do lado da extensão (GitHub, UI, etc.)

- `vercel-backend/`
  - `api/repos.js` — rota para listar/ler repositórios do GitHub
  - `api/analyze.js` — rota que recebe o repositório e chama a API de IA
  - `lib/` — helpers reutilizáveis e adaptadores de terceiros
  - `package.json` — metadados e ambiente Node para Vercel

- `.env.example` — variáveis de ambiente de exemplo sem valores reais

## Observações

- A autenticação GitHub/OAuth ainda não está implementada. Há comentários indicando onde integrar essa parte no futuro.
- O foco desta versão inicial é apenas a organização e o esqueleto do projeto.
- A análise IA deve retornar um objeto estruturado por arquivo, com severidade, tipo de problema, linha aproximada, explicação e sugestão de correção.
