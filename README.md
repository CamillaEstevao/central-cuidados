# Central de Cuidados — PWA + Supabase + Node/Vercel

Versão 2 do sistema, preparada para celular e desktop.

## O que já vem pronto

- React + Vite
- PWA instalável
- Login seguro por link no e-mail (Supabase Auth)
- Supabase como banco online
- RLS: cada usuário acessa apenas os próprios registros
- Consultas e exames
- Medicamentos, horários, estoque e registro de tomadas
- Glicemia
- Lembretes
- Gastos
- Histórico
- Web Push
- Funções Node.js em `/api`
- Vercel Cron para disparar lembretes
- Layout responsivo

## 1. Criar o Supabase

1. Crie um projeto no Supabase.
2. Abra **SQL Editor**.
3. Execute `supabase/schema.sql`.
4. Em **Authentication > URL Configuration**, adicione a URL local:
   `http://localhost:5173`
5. Quando publicar, adicione também a URL da Vercel.

## 2. Variáveis locais

Copie `.env.example` para `.env.local` e preencha:

```env
VITE_SUPABASE_URL=
VITE_SUPABASE_ANON_KEY=
SUPABASE_URL=
SUPABASE_SERVICE_ROLE_KEY=
VAPID_PUBLIC_KEY=
VAPID_PRIVATE_KEY=
VAPID_SUBJECT=mailto:seu-email@exemplo.com
```

As chaves VAPID podem ser geradas com:

```bash
npx web-push generate-vapid-keys
```

## 3. Rodar localmente

```bash
npm install
npm run dev
```

Abra:

`http://localhost:5173`

## 4. Criar seu usuário

Na tela de login, informe seu e-mail. O Supabase enviará um link de acesso.

Depois, pegue o UUID do usuário em:

**Supabase > Authentication > Users**

Abra `supabase/seed_medicamentos.sql`, troque `SEU_USER_UUID` pelo UUID e execute no SQL Editor.

Os medicamentos das receitas serão cadastrados. Os horários exatos ficam vazios quando a receita não informou a hora. Ajuste manualmente dentro do app.

## 5. Publicar na Vercel

1. Suba o projeto no GitHub.
2. Importe o repositório na Vercel.
3. Cadastre todas as variáveis do `.env.example` em **Project Settings > Environment Variables**.
4. Faça o Deploy.
5. No Supabase, adicione a URL final da Vercel em **Authentication > URL Configuration**.

## 6. Instalar como aplicativo

Android / Chrome:
- Abra o site.
- Menu do Chrome.
- **Adicionar à tela inicial** ou **Instalar app**.

iPhone / Safari:
- Abra o site.
- Compartilhar.
- **Adicionar à Tela de Início**.

## 7. Notificações

Clique em **Ativar avisos** dentro do app.

O projeto inclui Web Push real. Há um endpoint Node `/api/send-reminders` e um cron configurado em `vercel.json`.

Observação importante: disponibilidade e frequência de Vercel Cron dependem do plano da Vercel. Se o plano não permitir execução a cada 15 minutos, altere o cron ou use um scheduler externo/Supabase Cron.

## Importante sobre os medicamentos

O sistema foi pré-configurado com os nomes e orientações legíveis nas receitas enviadas, mas não inventa horários que não estavam prescritos. Confirme os horários reais antes de ativar os lembretes.

O aplicativo serve para organização e registro. Ele não substitui orientação médica, nem deve calcular ou alterar doses por conta própria.
