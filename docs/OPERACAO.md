# Cloud Seller — o que configurar fora do código

Tudo que o código novo precisa e que só você pode fazer (consoles da AWS, Mercado Pago, GitHub e Vercel).
Marque cada item. Sem eles, o recurso correspondente não funciona.

## 1. Variáveis de ambiente na Vercel

| Variável | Para quê | Exemplo |
|---|---|---|
| `NUXT_PUBLIC_APP_URL` | Domínio público, em HTTPS | `https://cloudseller.com.br` |
| `MERCADOPAGO_ACCESS_TOKEN` | Cobrança em reais (token de produção) | `APP_USR-...` |
| `MERCADOPAGO_WEBHOOK_SECRET` | Validação do webhook do Mercado Pago | assinatura secreta do painel |
| `STRIPE_SECRET_KEY`, `STRIPE_WEBHOOK_SECRET` | Cobrança em USD/EUR | do painel do Stripe |
| `CRON_SECRET` | Autoriza a limpeza diária da lixeira | um texto longo e aleatório |
| `NUXT_PUBLIC_COMPANY_NAME`, `NUXT_PUBLIC_COMPANY_CNPJ`, `NUXT_PUBLIC_COMPANY_ADDRESS` | Dados nas páginas legais e no rodapé | |
| `NUXT_PUBLIC_SUPPORT_EMAIL`, `NUXT_PUBLIC_DPO_EMAIL` | Contato e encarregado (LGPD) | `contato@seudominio.com.br` |
| `NUXT_PUBLIC_LEGAL_DRAFT` | `false` para tirar o aviso de rascunho, **só após revisão jurídica** | `false` |
| `NUXT_PUBLIC_PRICE_BOOK` | `seguro` (padrão) ou `competitivo` (só após migrar o storage) | `seguro` |
| `NUXT_PUBLIC_ENABLE_EUR` | `true` só depois de configurar IVA no Stripe | `false` |

Depois de alterar variáveis, faça um novo deploy.

## 2. Mercado Pago

1. No painel, **gere novas credenciais e revogue as antigas** (as atuais foram expostas em um print).
2. Em Webhooks, cadastre `https://SEU-DOMINIO/api/billing/mercadopago/webhook` nos eventos de assinaturas
   (`subscription_preapproval` e `subscription_authorized_payment`) e copie a assinatura secreta para
   `MERCADOPAGO_WEBHOOK_SECRET`.
3. Assinaturas recorrentes aceitam **cartão**. Pix não funciona nesse fluxo.
4. **Plano anual no Mercado Pago:** o código cria a assinatura com cobrança a cada 12 meses. Teste uma compra
   anual real do plano mais barato e cancele em seguida; se o Mercado Pago recusar a frequência, o plano anual
   em BRL deve ser desligado (basta esconder o botão Anual quando a moeda for BRL).

## 3. Cognito: verificação em duas etapas (MFA)

No console do Cognito, em *User pools* > seu pool > *Authentication* > *Sign-in* > *Multi-factor authentication*:
escolha **Optional MFA** e marque **Authenticator apps (TOTP)**. Não use "Required": isso quebraria o login de
quem ainda não configurou. O app client precisa continuar permitindo `ALLOW_USER_PASSWORD_AUTH`.
Cada cliente ativa em **Minha conta** (`/conta`).

## 4. S3: lixeira

A lixeira usa o prefixo `trash/<usuário>/` no mesmo bucket.

1. **Permissões (IAM):** as credenciais do app (`S3_ACCESS_KEY_ID` ou o role) precisam de
   `s3:GetObject`, `s3:PutObject`, `s3:DeleteObject` em `arn:aws:s3:::SEU-BUCKET/trash/*` e de
   `s3:ListBucket` com a condição de prefixo `trash/*`, além do que já têm para `users/*`.
   Sem isso, excluir arquivos falha.
2. **Expiração automática:** aplique `docs/s3-lifecycle-trash.json` (apaga após 31 dias; a tarefa diária
   apaga aos 30). Atenção: o comando abaixo **substitui** as regras existentes do bucket; se já houver regras,
   junte-as ao JSON antes.
   ```bash
   aws s3api put-bucket-lifecycle-configuration --bucket SEU-BUCKET \
     --lifecycle-configuration file://docs/s3-lifecycle-trash.json
   ```
3. A tarefa diária (`vercel.json`, 05:00 UTC) chama `/api/cron/purge-trash` e exige `CRON_SECRET`.
   No plano Hobby da Vercel a frequência diária é a máxima permitida.

## 5. Aplicativo de backup: publicar os instaladores

1. No GitHub: *Settings > Secrets and variables > Actions > Variables* > crie `CLOUD_SELLER_SERVER_URL`
   com o endereço público do site (HTTPS).
2. Publique uma versão criando uma tag:
   ```bash
   git tag desktop-v1.1.0
   git push origin desktop-v1.1.0
   ```
   O workflow `.github/workflows/desktop-release.yml` gera o instalador de Windows, macOS e Linux e cria o release.
3. A página `/backup` aponta para `https://github.com/AnthonyBuilder/Cloud-Seller/releases/latest/download/<arquivo>`.
   Se mudar de repositório, ajuste `NUXT_PUBLIC_DESKTOP_DOWNLOAD_BASE` e `NUXT_PUBLIC_DESKTOP_RELEASES_URL`.
4. No Cognito, o app client do desktop precisa do callback `http://localhost:53682/callback`
   (detalhes no README).
5. **Sem assinatura de código** o Windows e o macOS mostram avisos ao instalar (a página `/backup` explica).
   Para remover os avisos: certificado de assinatura (Windows) e Apple Developer ID com notarização (macOS);
   configure os secrets `CSC_LINK` e `CSC_KEY_PASSWORD` no GitHub.

## 6. Decisões de negócio que ficaram em aberto (nos Termos, entre [colchetes])

- Prazo em que arquivos ficam disponíveis para download após cancelamento ou fim do teste (sugestão: 60 dias).
  **O sistema ainda não apaga arquivos automaticamente nem envia aviso por e-mail**; hoje a conta fica somente leitura.
  Antes de prometer a exclusão, implemente a rotina e os avisos.
- Prazo de retenção de logs técnicos.
- Política de reembolso proporcional após os 7 dias.
- Limite de responsabilidade (valor e período).
- Revisão de todos os textos por um advogado, depois `NUXT_PUBLIC_LEGAL_DRAFT=false`.

## 7. Dados do aceite dos termos

Cada cadastro grava, na tabela do DynamoDB, um item `consent#<id-do-usuário>` com e-mail, versão dos termos e data.
Ao publicar novos termos, altere `TERMS_VERSION` em `utils/legal.ts`.
