# Cloud Seller

Site inicial de uma plataforma de armazenamento online, criado com Vue 3,
TypeScript e Nuxt. O Nuxt gera a aplicação para implantação na Vercel.

## Requisitos

- Node.js 20 ou superior
- npm

## Desenvolvimento

```bash
npm install
npm run dev
```

Abra o endereço mostrado pelo Nuxt no terminal.

## Implantação na Vercel

1. Envie este projeto para um repositório Git.
2. Importe o repositório na Vercel.
3. Use `npm run build` como comando de build. A Vercel detecta Nuxt automaticamente.
4. Configure as variáveis de ambiente necessárias no projeto Vercel antes de habilitar
   integrações.

## Estado do MVP

A aplicação inclui páginas de login e arquivos, integração de autenticação Cognito e
armazenamento privado S3 no servidor, além do cliente desktop de backup descrito abaixo.
Os planos e preços da página inicial são demonstrativos; cobrança e limites comerciais
por plano ainda precisam ser implementados antes do lançamento.

## Login e arquivos

As rotas `/login` e `/dashboard` usam Cognito e permitem navegar por pastas, enviar,
baixar e excluir arquivos reais. Os arquivos são armazenados no S3 por APIs do servidor;
o navegador não recebe credenciais AWS.

Na rota `/register`, o cliente cria a conta com e-mail e senha, confirma o e-mail com
o código enviado pelo Cognito e, em seguida, pode entrar pela rota `/login`.

## AWS Cognito e S3

Configure estas variáveis no ambiente da aplicação:

- `S3_REGION`
- `S3_BUCKET=dataseller-cloud-prod-storage`
- `S3_ACCESS_KEY_ID`
- `S3_SECRET_ACCESS_KEY`
- `COGNITO_REGION`
- `COGNITO_USER_POOL_ID`
- `COGNITO_CLIENT_ID`
- `NUXT_PUBLIC_COGNITO_DOMAIN`
- `NUXT_PUBLIC_COGNITO_REDIRECT_URI`

As variáveis privadas devem ser configuradas apenas no servidor/Vercel. O bucket deve
manter o acesso público bloqueado. Configure CORS no bucket para permitir `PUT` e
`GET` pela origem da aplicação, por exemplo `http://localhost:3000` em desenvolvimento
e o domínio de produção.

Os objetos são separados por usuário em `users/{cognito-sub}/`. Os endpoints de servidor
validam o JWT do Cognito e retornam URLs pré-assinadas temporárias para upload,
download e exclusão. Assim, usuários diferentes não podem acessar pastas uns dos outros.

## Aplicativo Cloud Seller Backup

O cliente desktop em `desktop/` permite escolher pastas locais, enviar arquivos
automaticamente ao detectar alterações, fazer uma cópia diária e restaurar arquivos.
Ele mantém uma cópia atual e snapshots diários no prefixo privado `Backups/` da conta.
Arquivos locais removidos não apagam as cópias na nuvem. Snapshots não são apagados
automaticamente; configure uma política de retenção antes de oferecer o serviço, pois
o espaço ocupado e o custo de S3 crescem com o tempo. Cada upload é limitado a 5 GB.

O cliente usa OAuth Authorization Code com PKCE, não contém credenciais AWS e guarda
tokens com a criptografia nativa do Windows/macOS. Fechar a janela mantém o app na
bandeja; por padrão ele inicia com o sistema. `.git`, `node_modules` e `.DS_Store`
são ignorados. Na restauração, a estrutura do computador, data e pasta de origem é
preservada no destino escolhido.

### Configuração e instaladores

1. Configure `NUXT_PUBLIC_DESKTOP_REDIRECT_URI` como
   `http://localhost:53682/callback` na hospedagem.
2. No Cognito, use um app client público sem secret, habilite Authorization Code,
   PKCE e os escopos `openid`, `email` e `profile`; adicione a URL de callback acima.
3. Configure `COGNITO_USER_POOL_ID`, `COGNITO_CLIENT_ID`, `NUXT_PUBLIC_COGNITO_DOMAIN`
   e as credenciais privadas do S3 no servidor.
4. Instale as dependências desktop: `npm install --prefix desktop`.
5. Gere o instalador no Windows com `$env:CLOUD_SELLER_SERVER_URL="https://seu-dominio"; npm run dist --prefix desktop`.
   O resultado fica em `desktop/release/`.
6. Para gerar o DMG do macOS, execute `npm run dist --prefix desktop` em um Mac.
   A distribuição pública do macOS também exige assinatura e notarização da Apple.

Na primeira execução, informe o endereço público do Cloud Seller, conecte a conta,
adicione as pastas e salve as preferências. O login deve permanecer ativo para os
backups automáticos funcionarem.
