# HörMal — Project Context, Decisions & Runbook

This directory and document serve as the persistent project context and decisions log for **HörMal** (Pure-Listening AI Language Tutor).

---

## 1. System Architecture & Environment

| Component | Technology | Configuration / Location |
|---|---|---|
| **Backend API** | Node.js 20 ARM64 Lambda (serverless) | AWS SAM stack `hormal` in `sa-east-1`<br>Target AWS Account: `340528522954` (`user/hormal`)<br>Credentials: Configured in `.env` (`AWS_ACCESS_KEY_ID`) |
| **Database** | Supabase Serverless PostgreSQL | Region: `aws-1-ca-central-1.pooler.supabase.com:6543`<br>Connection via Drizzle ORM / `postgres` library (`sslmode=require`, `prepare: false`) |
| **Auth** | AWS Cognito User Pool + Google SSO | User Pool ID: `sa-east-1_g9jJjKDpx`<br>Client ID: `7llh6790o4hqgk4dgsgvd3ghbq`<br>Domain: `hormal.auth.sa-east-1.amazoncognito.com` |
| **TTS Engines** | Multi-engine feminine voices | **Google Cloud TTS (Chirp 3 HD)** — Default<br>Amazon Polly (Vicki / Gabrielle)<br>OpenAI TTS (Nova)<br>Browser Natural |
| **AI LLM** | Google Gemini (`@google/genai`) | Model: `gemini-3.8-flash`<br>3 Agents: Story & Question Generator, Answer Evaluator, Doubt Solver |

---

## 2. Key Architectural Decisions Log

### Decision 001: Default App Language
- **Decision**: Default landing page and site interface language set to **English** (`en-US`), while providing an interactive language selector with all 6 supported languages (`en`, `pt-BR`, `de`, `es`, `fr`, `it`).
- **Rationale**: Clean onboarding experience for international learners, respecting user choice.

### Decision 002: Default Voice Engine
- **Decision**: Standard default feminine voice engine set to **Google Cloud TTS Chirp 3 HD** (`google_cloud_tts`).
- **Rationale**: Unmatched natural prosody and pronunciation clarity across German, Spanish, French, Italian, and Portuguese.

### Decision 003: In-Story Per-Sentence Text Reveal
- **Decision**: Added a visibility toggle button (`Show text` / `Hide text`) on each individual `SentenceCard`.
- **Rationale**: Enables pure-listening first, allowing learners to check understanding sentence-by-sentence at their own pace.

### Decision 004: Stories History Drawer
- **Decision**: Added a slide-up `HistorySheet` accessible from the top header with search, scores, and active story indicators.
- **Rationale**: Learners can revisit past stories and track comprehension scores across sessions.

### Decision 005: Amazon Polly Vicki 502 Fix
- **Decision**: Amazon Polly neural/generative feminine voices (e.g., Vicki) target `us-east-1` client endpoint with automatic standard voice fallback.
- **Rationale**: Prevents 502 errors when certain neural voices are regionally constrained.

### Decision 006: Difficulty Modes (Normal vs Hard) with Didactic Anchoring
- **Decision**: Added `'normal' | 'hard'` difficulty modes to the story generator, user profile, and story metadata:
  - **Normal Mode (🟢 Didático)**:
    - **Keyword Anchoring**: Limits niche/thematic terms to 2–3 target keywords, repeating each of them 2–4 times across the story for auditory retention ("fixação").
    - **Syntax Simplicity**: Direct SVO word order, moderate sentence length (7–12 words for A2), no dense subordinate cascades, no passive voice, and no complex relative clauses.
    - **German A2 Safeguard**: Strictly preserves genuine A2 level and prevents drift into B1.
  - **Hard Mode (⚡ Desafiador)**: Richer vocabulary, varied sentence structures, higher CEFR boundary.
- **Database Schema**: Added `difficulty_mode VARCHAR(16) NOT NULL DEFAULT 'normal'` to `users` and `stories` tables.

---

## 3. Deployment Runbook

### Prerequisites
Ensure the AWS CLI credentials for account `340528522954` (`user/hormal`) from `.env` are loaded in your shell:
```bash
# Set AWS_ACCESS_KEY_ID and AWS_SECRET_ACCESS_KEY from root .env
set AWS_DEFAULT_REGION=sa-east-1
```

### Backend Build & Deploy
```bash
cd backend && npm run typecheck
cd ..
sam build
sam deploy --no-confirm-changeset
```

### Frontend Build & S3/CloudFront Sync
```bash
cd frontend && npm run build
aws s3 sync dist s3://hormal-appbucket-yyutquydabwe --delete
aws cloudfront create-invalidation --distribution-id E2JDBHQIULDKY7 --paths "/*"
```
