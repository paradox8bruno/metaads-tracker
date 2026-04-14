# Meta Ads Tracker

Aplicação Next.js para registrar conversões de vendas fechadas no WhatsApp e enviá-las ao Meta Ads pelo fluxo oficial de Business Messaging CAPI.

## Documentação adicional

- [Playbook 2026 de Meta Ads para Vendas no WhatsApp](</Users/brunonikel/metaads-tracker/docs/meta-ads-whatsapp-playbook-2026.md>)

## O que esta versão faz

- Recebe webhooks do WhatsApp Cloud API.
- Captura `ctwa_clid` do objeto `referral` quando o lead veio de anúncio Click to WhatsApp.
- Persiste conversa, mensagens e status no Postgres.
- Cria ou reutiliza o `dataset_id` do WABA.
- Envia conversões ao Meta com `action_source=business_messaging` e `messaging_channel=whatsapp`.

## Variáveis obrigatórias

Use [`.env.example`](/Users/brunonikel/metaads-tracker/.env.example:1) como referência.

Obrigatórias para o fluxo CTWA:

- `META_ACCESS_TOKEN`
- `META_APP_ID`
- `META_APP_SECRET`
- `WHATSAPP_BUSINESS_ACCOUNT_ID`
- `WHATSAPP_PHONE_NUMBER_ID`
- `WHATSAPP_WEBHOOK_VERIFY_TOKEN`
- `POSTGRES_URL`
- `APP_SECRET`
- `NEXT_PUBLIC_APP_URL`

Opcionais:

- `META_GRAPH_API_VERSION`
- `META_TEST_EVENT_CODE`
- `META_DATASET_ID`

## Setup no Meta

### 1. App e produto

No Meta App Dashboard:

1. Crie ou abra o app que vai receber o webhook.
2. Adicione o produto `Webhooks`.
3. Adicione o produto `WhatsApp`.
4. Garanta que o número de WhatsApp usado no anúncio pertence ao mesmo WABA configurado na aplicação.

### 2. Permissões do token

O token usado em `META_ACCESS_TOKEN` precisa acessar o WABA e permitir gerenciamento de eventos. Para este fluxo, confirme no app e no Business Manager as permissões exigidas pela documentação de Business Messaging CAPI, incluindo:

- `whatsapp_business_management`
- `whatsapp_business_manage_events`

### 3. Webhook

Configure o callback URL do webhook para:

```text
https://SEU-DOMINIO/api/webhooks/whatsapp
```

No campo Verify Token do Meta App Dashboard, use exatamente o mesmo valor de:

```text
WHATSAPP_WEBHOOK_VERIFY_TOKEN
```

Depois assine o campo de mensagens do WhatsApp para que o Meta envie payloads contendo `messages` e `statuses`.

O app também precisa ficar inscrito no WABA. Se `subscribed_apps` estiver vazio, mensagens reais não chegam ao webhook mesmo com o callback URL validado.

### 4. App Secret

Defina o `META_APP_SECRET` da aplicação. Ele é usado para validar a assinatura `X-Hub-Signature-256` dos webhooks.

### 5. WABA

Preencha:

```text
WHATSAPP_BUSINESS_ACCOUNT_ID
```

Esse é o ID do WhatsApp Business Account real que recebe os leads do anúncio Click to WhatsApp.

Preencha também:

```text
WHATSAPP_PHONE_NUMBER_ID
```

O webhook processa apenas mensagens do número configurado para evitar mistura com outros assets do app.

### 6. Dataset

Se você já tiver um dataset de Business Messaging, pode preencher `META_DATASET_ID`.

Se deixar vazio, a app tenta localizar ou criar o dataset do WABA via Graph API no primeiro envio de conversão.

## Fluxo operacional

1. O usuário clica no anúncio Click to WhatsApp.
2. O usuário envia mensagem no WhatsApp.
3. O webhook recebe o payload e salva a conversa com `ctwa_clid`.
4. A tela `/conversions/new` lista apenas conversas com `ctwa_clid`.
5. Você registra a venda vinculando a conversa correta.
6. A API envia a conversão ao dataset do Business Messaging.

## Desenvolvimento local

```bash
npm install
npm run dev
```

Abra:

```text
http://localhost:3000
```

## Validação

```bash
npm run lint
npm run build
```

## Observações importantes

- Sem `ctwa_clid`, a conversa não entra no fluxo oficial de atribuição CTWA.
- A tela de nova venda não usa mais `fbclid` manual.
- `META_TEST_EVENT_CODE` é opcional e só deve ser usado quando você marcar o envio como teste na tela de nova venda.
- Não salve tokens reais no repositório.
- Se já houve vazamento de token em arquivo versionado, gere um novo token e revogue o anterior.

## Documentação oficial

- [Business Messaging CAPI](https://developers.facebook.com/docs/marketing-api/conversions-api/business-messaging/)
- [Customer Information Parameters](https://developers.facebook.com/docs/marketing-api/conversions-api/parameters/customer-information-parameters/)
- [Meta Webhooks Getting Started](https://developers.facebook.com/docs/graph-api/webhooks/getting-started/)
- [WhatsApp Cloud API Webhook Payload Examples](https://developers.facebook.com/docs/whatsapp/cloud-api/webhooks/payload-examples/)
