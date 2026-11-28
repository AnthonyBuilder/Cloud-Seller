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

### Cobrança Mercado Pago (reais)

O checkout cria uma assinatura recorrente mensal (`/preapproval`) em BRL e redireciona o
cliente para o Mercado Pago. O estado da assinatura é atualizado pelo webhook, cuja
assinatura (`x-signature`) é validada com HMAC-SHA256.

1. No painel do Mercado Pago (Suas integrações), copie o **Access Token de produção**
   (`APP_USR-...`) e defina `MERCADOPAGO_ACCESS_TOKEN` nas variáveis de ambiente da Vercel.
   Não use a Public Key, o Client ID nem o Client Secret: o fluxo atual só precisa do Access Token.
2. Em *Webhooks > Configurar notificações*, informe a URL
   `https://SEU-DOMINIO/api/billing/mercadopago/webhook`, modo **Produção**, e marque os eventos
   **Planos e assinaturas** (`subscription_preapproval` e `subscription_authorized_payment`).
3. Copie a **chave secreta** gerada nessa tela para `MERCADOPAGO_WEBHOOK_SECRET`.
4. Defina `NUXT_PUBLIC_APP_URL` com o domínio HTTPS de produção, pois ele é usado como
   `back_url` e `notification_url`. Em `localhost` o checkout não funciona de ponta a ponta
   (o Mercado Pago não consegue chamar o webhook); teste em um deploy de preview.
5. Faça um novo deploy depois de salvar as variáveis. Elas nunca devem ir para o Git.

Se o Access Token ou o Client Secret forem expostos (chat, print, repositório), gere novas
credenciais no painel e atualize a Vercel.

## Planos, preços e moeda por país

Os planos ficam em `utils/plan-catalog.ts`, fonte única para cobrança e páginas públicas. Para mudar
um preço, altere apenas esse arquivo. Os valores são tabelas fixas por moeda (centavos), nunca
conversão de câmbio ao vivo.

**Ciclos:** mensal e anual (anual = 10 mensalidades, 2 meses grátis). O ciclo contratado fica gravado na assinatura
(`billingInterval`). No Stripe o plano anual usa `interval: year`; no Mercado Pago, cobrança a cada 12 meses
(teste antes de divulgar; veja `docs/OPERACAO.md`).

**Moeda automática:** a moeda segue o país do visitante (header `x-vercel-ip-country` da Vercel):
Brasil → BRL (Mercado Pago); zona do euro → EUR, se `NUXT_PUBLIC_ENABLE_EUR=true`; demais países → USD
(Stripe). Sem país, o idioma `pt-BR` do navegador usa BRL. O visitante pode trocar a moeda no seletor
(gravada no cookie `cs_currency`). A moeda define o meio de pagamento no checkout. Para testar
localmente, envie o header, por exemplo `curl -H "x-vercel-ip-country: US" http://localhost:3000`.

**Dois livros de preço** (variável `NUXT_PUBLIC_PRICE_BOOK`):

| Plano     | Espaço | `seguro` (padrão) BRL / USD | `competitivo` BRL / USD / EUR |
|-----------|--------|-----------------------------|-------------------------------|
| Essencial | 100 GB | R$ 14,90 / US$ 3,99         | R$ 9,90 / US$ 2,99 / € 2,99   |
| Pro       | 500 GB | R$ 59,90 / US$ 12,99        | R$ 34,90 / US$ 8,99 / € 8,49  |
| Família   | 1 TB   | R$ 109,90 / US$ 22,99       | R$ 64,90 / US$ 15,99 / € 14,99 |

- `seguro`: preços para o storage atual em S3 Standard, que cobra pelo download. Mesmo assim a margem
  só fecha com pouco download; meça o uso real.
- `competitivo`: preços próximos do Google One e do iCloud. **Só ative depois de migrar o storage** para
  Backblaze B2 ou Cloudflare R2 (`S3_ENDPOINT` já é suportado). Em S3 Standard esses preços dão prejuízo.
- EUR fica desligada até configurar IVA (Stripe Tax/OSS). Os valores em EUR já incluem IVA.
- Assinantes antigos mantêm o valor contratado: o preço é fixado no Stripe/Mercado Pago na assinatura.

Verificações antes de mudar preços ou storage:

```bash
npm run check-pricing                                   # consistência do catálogo e da detecção de moeda
npm run margin-check                                    # margem por plano e moeda (livro e storage atuais)
PRICE_BOOK=competitivo STORAGE_PROVIDER=b2 npm run margin-check
```

As premissas do `margin-check` (uso da cota, download mensal, taxas, impostos) estão no topo de
`scripts/margin-check.ts`; substitua pelos dados reais e revise a cada trimestre ou quando o dólar
variar mais de 8%.

## Estado do MVP

A aplicação inclui páginas de login, escolha de armazenamento e arquivos, autenticação
Cognito, armazenamento privado S3 e cotas por cliente. Os planos disponíveis são 100 GB,
500 GB e 1 TB, com os valores da tabela acima.
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

O cliente desktop em `desktop/` envia as pastas escolhidas para a nuvem, restaura arquivos e roda sozinho:

- **Backup noturno:** todo dia, no horário escolhido (padrão 02:00), confere todas as pastas, envia o que mudou
  e guarda uma versão diária dos arquivos alterados. Se o computador estava desligado, o backup roda assim que
  ele ligar e o app abrir (recupera noites perdidas). Durante o backup o app impede a suspensão do computador.
- **Durante o dia (opcional):** envia arquivos novos ou alterados logo depois de salvos.
- **Retenção:** versões diárias com mais de N dias (padrão 30, ajustável de 7 a 365) são removidas
  automaticamente após cada backup noturno. O histórico é incremental: só entram as versões dos arquivos que
  mudaram, e a cópia atual fica em `Backups/<computador>/Current/`.
- Arquivos locais removidos não apagam a cópia atual na nuvem. Cada upload é limitado a 5 GB.
- Tudo conta na cota do plano do cliente.

O cliente usa OAuth Authorization Code com PKCE, não contém credenciais AWS e guarda
tokens com a criptografia nativa do Windows/macOS. Fechar a janela mantém o app na
bandeja; por padrão ele inicia com o sistema. `.git`, `node_modules` e `.DS_Store`
são ignorados. Na restauração, a estrutura do computador, data e pasta de origem é
preservada no destino escolhido.

### Distribuição para clientes

A página pública `/backup` oferece o download para Windows, macOS e Linux. Os instaladores são gerados pelo
GitHub Actions ao enviar uma tag `desktop-v*` (passo a passo em `docs/OPERACAO.md`).

### Configuração e instaladores (manual)

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

## Páginas legais, conta, MFA e lixeira

- `/termos`, `/privacidade` e `/reembolso`: rascunhos em português (LGPD e CDC) com dados da empresa vindos de
  variáveis `NUXT_PUBLIC_COMPANY_*`. **Revise com um advogado** e depois defina `NUXT_PUBLIC_LEGAL_DRAFT=false`.
  O cadastro exige o aceite e grava a prova (versão e data) no DynamoDB.
- `/conta`: ativar e desativar a verificação em duas etapas (TOTP) pelo Cognito. O login pede o código quando ativa.
  Requer "Optional MFA" com aplicativos autenticadores no User Pool.
- `/trash`: excluir arquivos e pastas move para a lixeira (`trash/<usuário>/` no bucket), restaurável por 30 dias.
  Itens na lixeira ocupam espaço do plano. Limpeza por regra de ciclo de vida do bucket e pela tarefa diária
  `/api/cron/purge-trash` (`vercel.json`, exige `CRON_SECRET`). Atenção às permissões IAM para `trash/*`.

Verificações: `npm run check-pricing`, `npm run check-trash`, `npm run check-backup`, `npm run margin-check`.
