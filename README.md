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

### Cobrança Stripe

Defina `STRIPE_SECRET_KEY`, `STRIPE_WEBHOOK_SECRET` e `NUXT_PUBLIC_APP_URL`.
Em desenvolvimento, coloque as chaves no `.env` da raiz e reinicie o servidor
(`npm run dev`). `STRIPE_SECRET_KEY` deve começar com `sk_test_` ou `sk_live_`;
`pk_test_` e `pk_live_` são chaves publicáveis e não iniciam o Checkout.
Para produção, configure uma chave `sk_live_` e o segredo `whsec_` do endpoint
criado no modo live apenas nas variáveis privadas do ambiente de produção da Vercel.
No Stripe Dashboard, registre o endpoint `https://SEU-DOMINIO/api/billing/webhook`
e ative os eventos `checkout.session.completed`, `customer.subscription.updated`
e `customer.subscription.deleted`. O projeto cria os preços recorrentes em USD
diretamente no Checkout, sem armazenar números de cartão no servidor.

## Estado do MVP

A aplicação inclui páginas de login, escolha de armazenamento e arquivos, autenticação
Cognito, armazenamento privado S3 e cotas por cliente. Os planos disponíveis são 100 GB,
500 GB e 1 TB. Os valores mensais em USD são US$ 7,67, US$ 38,33 e US$ 76,67.
Contas sem plano podem ativar 100 GB gratuitos por 24 horas, sem cartão e sem cobrança
automática. Depois do período, os arquivos continuam disponíveis para visualização e
download, mas novos envios exigem um plano pago. A expiração é aplicada pelo servidor.

As páginas públicas incluem a home, `/como-funciona`, `/seguranca`, `/sobre` e `/contato`.
O site e o painel adaptam a navegação e os controles para telas de celular. O contato é
feito pelo endereço `cloudseller@icloud.com`.

## Login e arquivos

Após o login Cognito, clientes sem plano são direcionados para `/subscription`, onde
escolhem 100 GB, 500 GB ou 1 TB. A cota é aplicada no servidor aos uploads e os arquivos
existentes continuam disponíveis para download. As capacidades usam unidades decimais
(1 GB = 1.000.000.000 bytes).

A rota `/dashboard` permite navegar por pastas, enviar, baixar e excluir arquivos reais.
Os arquivos são armazenados no S3 por APIs do servidor; o navegador não recebe
credenciais AWS. O painel também oferece visualização em lista ou grade, filtros por tipo,
ordenação, prévias de imagens, favoritos salvos no navegador, arquivos modificados nos
últimos 30 dias, seleção para download ou exclusão em lote e ações para mover e renomear
arquivos e pastas.

Na rota `/register`, o cliente cria a conta pelo Cloud Seller, confirma o e-mail com
o código enviado pelo Cognito e, em seguida, entra pela rota `/login`, que autentica
diretamente no Cognito sem redirecionar para a Hosted UI. O login também permite solicitar
um código de redefinição de senha pelo e-mail. O App Client precisa permitir
o fluxo `ALLOW_USER_PASSWORD_AUTH`, além dos fluxos OAuth usados pelo aplicativo desktop.

## AWS Cognito e S3

Configure estas variáveis no ambiente da aplicação:

- `S3_REGION`
- `S3_BUCKET=dataseller-cloud-prod-storage`
- `S3_ACCESS_KEY_ID`
- `S3_SECRET_ACCESS_KEY`
- `DYNAMODB_TABLE=cloudseller-subscriptions-prod`
- `DYNAMODB_REGION=us-east-2` (opcional; por padrão usa `S3_REGION`)
- `COGNITO_REGION`
- `COGNITO_USER_POOL_ID`
- `COGNITO_CLIENT_ID`
- `NUXT_PUBLIC_COGNITO_DOMAIN`
- `NUXT_PUBLIC_COGNITO_REDIRECT_URI`

As variáveis privadas devem ser configuradas apenas no servidor/Vercel. O bucket deve
manter o acesso público bloqueado. Configure CORS no bucket para permitir `PUT` e
`GET` pela origem da aplicação, por exemplo `http://localhost:3000` em desenvolvimento
e o domínio de produção.

Os objetos são separados por usuário em `users/{cognito-sub}/`. As assinaturas e cotas
são guardadas na tabela DynamoDB configurada por `DYNAMODB_TABLE`. Os endpoints de servidor
validam o JWT do Cognito e retornam URLs pré-assinadas temporárias para upload e download;
assim, usuários diferentes não podem acessar pastas uns dos outros.

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
