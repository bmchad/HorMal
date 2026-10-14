# HörMal — Multi-Language Pure-Listening Tutor

> Apps name: "HörMal" (German for *"Listen up!"* / *"Listen once"*)

A full-stack, ultra-low-cost serverless web application engineered strictly as a 9:16 vertical mobile-first Progressive Web App (PWA) for pure-listening language practice.

Built with **React (Vite) + TypeScript + Tailwind CSS**, **AWS Lambda (Node.js 20 ARM64)**, **Cognito (Google SSO only)**, **PostgreSQL (Drizzle ORM)**, a **3-Agent AI System (`gemini-3.8-flash`)**, and a **Pluggable Natural Feminine Voice System (Google Cloud TTS Chirp 3 HD, AWS Polly Vicki, Browser Natural offline, and OpenAI Nova)** with S3/CloudFront audio caching.

---

## Architecture Overview

```
HorenApp/
├─ template.yaml                AWS SAM: Cognito Google SSO, HTTP API v2, Node 20 ARM64 Lambda, S3 + CloudFront
├─ schema.sql                   PostgreSQL relational schema (7 tables)
├─ backend/                     AWS Lambda backend
│  ├─ src/
│  │  ├─ handlers/api.ts        Single API router (/api/me, /api/stories, /api/agents/*, /api/tts/synthesize, /api/vocab)
│  │  ├─ agents/
│  │  │  ├─ storyGenerator.ts   Agent 1: CEFR Story Architect (with Shuffle Rule)
│  │  │  ├─ answerCorrection.ts Agent 2: Batch Answer Evaluator & 4-Part Feedback Tutor
│  │  │  └─ doubtSolver.ts      Agent 3: Contextual Doubt & Grammar Assistant
│  │  ├─ services/
│  │  │  ├─ ttsService.ts       Google Cloud TTS (Chirp 3 HD) + Polly Vicki + OpenAI Nova + S3/CloudFront caching
│  │  │  ├─ storyService.ts     Story & comprehension question queries
│  │  │  ├─ userService.ts      User profile & preferences (Cognito JWT authorizer)
│  │  │  └─ vocabService.ts     Vocabulary notebook service
│  │  ├─ lib/
│  │  │  ├─ gemini.ts           Google Gen AI SDK wrapper with strict JSON Schema
│  │  │  └─ constants.ts        Supported languages, themes, and voice engines
│  │  └─ db/
│  │     ├─ schema.ts           Drizzle ORM definitions
│  │     └─ client.ts           Serverless Postgres client (TLS outside VPC, zero NAT cost)
│  └─ package.json
└─ frontend/                    9:16 Mobile-First React + TypeScript + Tailwind PWA
   ├─ src/
   │  ├─ components/
   │  │  ├─ AppShell9x16.tsx    Locked 9:16 viewport shell with ambient backdrop
   │  │  ├─ Header.tsx          Sticky top header with voice status pill
   │  │  ├─ AudioDock.tsx       Thumb-zone docked audio mini-player with live waveform
   │  │  ├─ BottomNav.tsx       Thumb-zone 3-tab navigation (Practice · Vocab · Profile)
   │  │  ├─ BottomSheet.tsx     Keyboard-aware slide-up bottom sheet
   │  │  ├─ SentenceCard.tsx    Pure-listening blurred card (Listen · Translate · Ask)
   │  │  ├─ QuestionCard.tsx    6 shuffled comprehension question cards
   │  │  ├─ FeedbackCard.tsx    Stacked 4-part correction cards with compact vocab pills
   │  │  ├─ NextStoryBanner.tsx Live progression banner with background prefetch status
   │  │  ├─ GeneratorSheet.tsx  Slide-up story generator sheet (10 theme grid + custom keywords)
   │  │  ├─ SubmitThemeSheet.tsx Pop-up on answer submit: choose next story theme while evaluating
   │  │  └─ DoubtSheet.tsx      Slide-up Agent 3 tutor chat sheet
   │  ├─ context/
   │  │  ├─ AppContext.tsx      Active profile & i18n context (English, Portuguese, Spanish)
   │  │  ├─ AudioContext.tsx    Persistent HTML5 audio player & sentence queue (iOS/Android unlock)
   │  │  └─ StoryContext.tsx    Zero-wait story prefetch hook & answer state
   │  ├─ tabs/
   │  │  ├─ PracticeTab.tsx     Main pure-listening workflow
   │  │  ├─ VocabTab.tsx        Saved vocabulary flashcards
   │  │  └─ ProfileTab.tsx      Languages, CEFR level & feminine voice engine selector
   │  ├─ lib/
   │  │  ├─ api.ts              REST client (with real and mock modes)
   │  │  ├─ auth.ts             AWS Amplify Cognito Google-SSO PKCE client
   │  │  └─ voices.ts           Feminine voice selection & smart browser fallback filter
   │  └─ i18n.ts                Localization in English, Portuguese (pt-BR), and Spanish (es)
   ├─ public/
   │  ├─ manifest.json          PWA manifest (standalone portrait)
   │  └─ sw.js                  Service worker for offline shell caching
   └─ package.json
```

---

## 3-Agent AI System (`gemini-3.8-flash`)

1. **Agent 1: Story & Question Architect (`storyGenerator.ts`)**
   - Calibrated strictly to the user's CEFR level (`A1`, `A2`, `B1`, `B2`).
   - Generates 6 to 8 engaging sentences in `targetLanguage` with sentence-by-sentence translation in `uiLanguage`.
   - Generates 6 comprehension questions with model answers.
   - **Shuffle Rule**: Questions are sorted non-chronologically so the user cannot answer in sentence order (1 → 6).
   - Excludes previously seen titles to prevent duplicates.

2. **Agent 2: Dynamic Answer Evaluator & Tutor (`answerCorrection.ts`)**
   - Batch-evaluates all 6 student answers in a single Gemini call.
   - Produces a stacked 4-part correction card per question:
     1. Sentence correction & feedback note.
     2. Translations of question and model answer.
     3. Word-by-word vocabulary breakdown with gender badges (`der`/`die`/`das`), plural, and notes.
     4. Bite-sized CEFR grammar analysis.

3. **Automatic Background Story Pre-generation (Zero-Wait Flow)**
   - When the user clicks **Submit & Correct**, a pop-up appears: *"Choose the theme of your next story"*.
   - Once confirmed, **Agent 2 evaluates the answers** while **Agent 1 immediately starts generating the next story in the background** with the newly selected theme!
   - Sentence 1 of the next story is automatically pre-synthesized into the TTS cache.
   - When the user finishes reviewing their corrections, they tap **`✨ Next Story Ready — Start Now ⏭️`** and swap to the new story with **0 ms waiting time**.

4. **Agent 3: Contextual Doubt Tutor (`doubtSolver.ts`)**
   - Slide-up bottom sheet chat pre-loaded with the active sentence or question context.
   - Short, scannable explanations tailored for mobile screens.

---

## Pluggable Natural Feminine TTS Architecture

All voice engines are strictly configured with warm, natural feminine voices:

| Engine | Service | Cost | Default Voices |
|---|---|---|---|
| `google_cloud_tts` | Google Cloud TTS | 1M chars/mo Free Forever | `de-DE-Chirp3-HD-Aoede`, `fr-FR`, `es-ES`, `it-IT`, `en-US`, `pt-BR` (or `Neural2`) |
| `polly_generative` | AWS Polly | 1M chars/mo AWS Free Tier | `Vicki` (de), `Gabrielle` (fr), `Lucia` (es), `Beatrice` (it), `Ruth` (en), `Camila` (pt) |
| `browser_natural` | Web Speech API | $0.00 Client-side | Smart filter prioritizing `"Natural"`, `"Online"`, `"Google"`, `"Katja"`, `"Vicki"` |
| `openai_tts` | OpenAI Audio API | Pay-as-you-go (~$0.01/story) | `nova` (warm conversational) |

**S3 + CloudFront Audio Caching Pipeline**:
- Cache key: `SHA256(engine + ":" + voiceId + ":" + targetLanguage + ":" + text)`.
- Checked in PostgreSQL `audio_cache` (and S3). If present, immediately returns the CloudFront URL.
- If not cached, synthesizes, uploads to S3 with `Cache-Control: public, max-age=31536000, immutable`, and saves to the database.

---

## Quickstart: Running in Local Mock Mode (Zero AWS Setup)

You can explore the entire 9:16 UX, audio player, background generation, and bottom sheets locally without any AWS configuration:

```bash
cd frontend
npm install
npm run dev:mock
```

Open `http://localhost:5173/` in your browser (preferably in mobile responsive mode at 430×900).

---

## Deploying to AWS (AWS SAM)

### 1. Database Setup (Supabase / PostgreSQL)
1. Crie seu projeto gratuito no **[Supabase](https://supabase.com)** (região recomendada: `sa-east-1` São Paulo).
2. **Integração Supabase-GitHub**:
   - As migrations estão padronizadas na pasta `supabase/migrations/`.
   - Conecte o repositório no Supabase Dashboard (**Project Settings > Integrations > GitHub**) para aplicar as migrations automaticamente a cada push na branch `main`.
   - Alternativamente, você pode rodar a migration inicial colando o conteúdo de `supabase/migrations/20261014020000_init_hormal_schema.sql` no **SQL Editor** do Supabase.
3. Copie a string de conexão em **Project Settings > Database > Connection string (URI)** (marcando *Mode: Transaction / Session* com `?sslmode=require`) e cole em `DATABASE_URL` no `.env`.

### 2. Google OAuth Credentials & Consent Screen
1. Vá para o **Google Cloud Console > APIs e Serviços > Tela de consentimento OAuth (OAuth consent screen)**:
   - **Nome do app**: `HörMal`
   - **Página inicial do aplicativo (Home Page URL)**:
     - Local/Desenvolvimento: `http://localhost:5173/`
     - Produção: URL do CloudFront (ex: `https://<distribution-id>.cloudfront.net/` ou domínio próprio)
   - **Link da política de privacidade (Privacy Policy URL)**:
     - Local/Desenvolvimento: `http://localhost:5173/privacy.html`
     - Produção: `https://<distribution-id>.cloudfront.net/privacy.html`
   - **Escopos**: `openid`, `.../auth/userinfo.email`, `.../auth/userinfo.profile`

2. Vá para **APIs e Serviços > Credenciais > Criar credenciais > ID do cliente OAuth 2.0** (Aplicativo da Web):
   - **Origens JavaScript autorizadas**:
     - `http://localhost:5173`
     - Produção: `https://<distribution-id>.cloudfront.net` (quando publicado)
   - **URIs de redirecionamento autorizados**:
     - O Google autentica através do Amazon Cognito Hosted UI! Insira:
       `https://hormal.auth.<Regiao>.amazoncognito.com/oauth2/idpresponse`
       *(Exemplo com região sa-east-1 do .env: `https://hormal.auth.sa-east-1.amazoncognito.com/oauth2/idpresponse`)*
       *(Esse valor exato também é exibido no output `GoogleRedirectUriForGoogleConsole` ao rodar o `sam deploy`).*

### 3. Deploy the SAM Stack
```bash
sam build
sam deploy --guided
```
Parameters prompted:
- `GoogleClientId`: Your Google OAuth Client ID.
- `GoogleClientSecret`: Your Google OAuth Client Secret.
- `CognitoDomainPrefix`: Subdomínio/prefixo único para o Cognito Hosted UI (use `hormal`, gerando `hormal.auth.<region>.amazoncognito.com`).
- `DatabaseUrl`: PostgreSQL connection string with `?sslmode=require`.
- `GeminiApiKey`: Google Gemini API key.
- `GoogleTtsApiKey`: (Optional) Dedicated Google Cloud TTS API key.
- `OpenAiApiKey`: (Optional) OpenAI API key for Nova voice.

### 4. Post-Deployment Steps
1. Copy the output `GoogleRedirectUriForGoogleConsole` into Google Cloud Console's *Authorized redirect URIs*.
2. Copy the output `AppUrl` into `CallbackUrls` / `LogoutUrls` in your stack configuration.
3. Build and upload the frontend:
   ```bash
   cd frontend
   cp .env.example .env.local
   # Fill VITE_COGNITO_USER_POOL_ID, VITE_COGNITO_APP_CLIENT_ID, VITE_COGNITO_AUTH_DOMAIN
   npm run build
   aws s3 sync dist/ s3://<AppBucketName> --delete
   aws cloudfront create-invalidation --distribution-id <DistributionId> --paths "/*"
   ```