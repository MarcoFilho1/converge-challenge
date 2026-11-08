# Landing Praevenius

Site isolado para publicação estática. Não contém o login, API, banco ou aplicação clínica.

Na Vercel, importe o repositório e selecione `landing` em **Root Directory**. O framework é Next.js; o build usa `npm run build` e gera `out`.

Localmente: `cd landing`, `corepack pnpm install`, `corepack pnpm build`. Os botões da versão pública usam âncoras da própria página até existir um endereço seguro para a aplicação.

Esta pasta é uma cópia independente da landing em `src/components`. Ao alterar a landing do aplicativo, replique e revise as mudanças aqui antes de publicar.
