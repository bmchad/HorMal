Role: You are a Principal Mobile-First Full-Stack Cloud Architect, AI Agent Engineer, and Senior TypeScript/React Developer.

Task:
Architect and build a full-stack, ultra-low-cost serverless web application on AWS for an AI-powered "Multi-Language Pure-Listening Tutor" platform. The frontend must be engineered strictly as a 9:16 vertical mobile-first application (PWA-ready smartphone UX). The system uses React, AWS Lambda, Google-SSO only authentication, PostgreSQL, a 3-Agent AI system powered by `gemini-3.8-flash` with automatic background story pre-generation upon answer correction, and a Pluggable Multi-Engine Feminine TTS Voice System with S3/CloudFront audio caching.

===================================================================
1. 9:16 MOBILE-FIRST VIEWPORT & ERGONOMICS (CRITICAL PRIORITY)
===================================================================
The entire UI/UX must be designed around a strict 9:16 vertical smartphone aspect ratio and one-handed thumb ergonomics:

A. 9:16 App Shell & Viewport Container:
   - Mobile Devices: Occupy `w-full min-h-[100dvh]` with `viewport-fit=cover`, respecting native OS safe areas (`pt-[env(safe-area-inset-top)]`, `pb-[env(safe-area-inset-bottom)]`), `overscroll-behavior-y: none`, and preventing accidental input zoom (`text-base` / `16px` minimum on all `<input>` and `<textarea>` fields).
   - Desktop / Tablet Preview: Automatically center the application inside a locked 9:16 smartphone shell (`w-full max-w-[430px] h-[100dvh] sm:h-[92dvh] sm:aspect-[9/16] mx-auto bg-slate-50 shadow-2xl sm:rounded-[2.5rem] sm:border-[6px] sm:border-slate-900 overflow-hidden flex flex-col relative`) over a dark ambient backdrop.
   - Progressive Web App (PWA): Include `manifest.json` with `"display": "standalone"`, `"orientation": "portrait"`, and Apple/Android meta tags so users can install it to their phone's home screen.

B. One-Handed Thumb-Zone Layout (3 Vertical Zones):
   1. **Compact Sticky Top Header (`h-14`):** Shows the current story title, active language/voice status pill (e.g., `🇩🇪 A2 • Vicki`), and a compact `+ New` story button.
   2. **Independent Scrollable Content Area (`flex-1 overflow-y-auto`):** Houses the Pure-Listening story cards, the 6 shuffled question inputs, and the 4-part AI feedback cards.
      - CRITICAL UX RULE — NO AUTO-SCROLL LOCK: Never call `scrollIntoView()` during audio playback. The user must be able to scroll freely up and down the 9:16 screen and type answers while the audio plays.
   3. **Fixed Bottom Thumb-Zone Dock (Sticky Mini-Player + Bottom Tab Bar):**
      - **Docked Audio Control Bar:** Positioned directly above the bottom navigation bar. Contains large, touch-friendly (`min-h-[44px]`) thumb controls: Play/Pause Story (`▶️`/`⏸️`), Prev/Next Sentence (`◀` `1/6` `▶`), Replay Sentence (`🔄`), Speed pill (`0.75x`/`1.0x`), Stop (`⏹`), and a live pulsing audio waveform.
      - **Bottom Navigation Bar (`h-16`):** 3 thumb-accessible tabs:
        * `🎧 Practice` (Active Story, Questions & Generator)
        * `📚 Vocab` (Saved Flashcards with 1-tap audio)
        * `👤 Profile` (Site Language, Studied Language, CEFR Level, Feminine Voice Engine, Account)

C. Mobile-Native Component Patterns (Zero Horizontal Overflow):
   - **No Wide Tables:** In the 4-part correction card, render the Word-by-Word Breakdown as compact, stacked **Mobile Vocab Rows/Pills** (showing the word, color-coded gender badge `der`/`die`/`das`, plural form, translation note, and a 1-tap `+` save icon) so there is zero horizontal scrolling on narrow 9:16 screens.
   - **Slide-Up Bottom Sheets:** Implement both the `"✨ Generate New Story"` modal and the `"💬 Agent 3 Doubt Tutor"` chat as mobile slide-up bottom sheets (`max-h-[85dvh] rounded-t-3xl`) that smoothly handle mobile virtual keyboard opening.

===================================================================
2. CLOUD ARCHITECTURE & ULTRA-LOW-COST AWS STACK
===================================================================
- Frontend: React (Vite) + TypeScript + Tailwind CSS + Internationalization (i18n).
- Frontend & Audio CDN Hosting: Amazon S3 + Amazon CloudFront CDN (AWS Always-Free tier: 1 TB transfer out + 10M requests/month).
- Authentication (Google-SSO Only):
  * Amazon Cognito User Pool configured EXCLUSIVELY with Google as a Federated OAuth 2.0 / OpenID Connect Identity Provider.
  * Direct redirect to Google Sign-In (`signInWithRedirect({ provider: 'Google' })` using OAuth2 PKCE flow).
- Backend API, AI Orchestration & TTS Proxy:
  * AWS Lambda (Node.js 20.x / TypeScript, ARM64 Graviton2) + Amazon API Gateway HTTP API (v2) with a Cognito JWT Authorizer.
  * Google Gen AI SDK (`@google/genai`) configured to run `gemini-3.8-flash` with strict JSON Schema outputs (`responseSchema`).
- Database (PostgreSQL):
  * PostgreSQL accessed via `DATABASE_URL` using Drizzle ORM.
  * COST GUARDRAIL: No AWS VPC NAT Gateways. Lambda runs outside a VPC, connecting over SSL/TLS to Serverless Postgres on AWS (Neon/Supabase Free Tier or RDS Free Tier).

===================================================================
3. MULTI-ENGINE FEMININE VOICE ARCHITECTURE (NON-ROBOTIC TTS)
===================================================================
All audio synthesis automatically uses the `targetLanguage` and `preferredVoiceEngine` configured in the user's Profile. All engines must be strictly configured to use warm, natural, non-robotic FEMININE voices:

A. Supported Voice Engines (`voiceEngine` selector):
   1. `polly_generative` (AWS Native — Recommended Default):
      - Uses `@aws-sdk/client-polly` with `Engine: "generative"` (fallback to `"neural"` where generative is unavailable) and `OutputFormat: "mp3"`, `SampleRate: "24000"`.
      - Language-to-Feminine-Voice mapping based on the user's Profile `targetLanguage`:
        * German (`de-DE`): `Vicki` (Generative / Neural)
        * French (`fr-FR`): `Gabrielle` (Generative / Neural)
        * Spanish (`es-ES` / `es-US`): `Lucia` / `Lupe` (Generative / Neural)
        * Italian (`it-IT`): `Beatrice` / `Bianca` (Generative / Neural)
        * English (`en-US`): `Ruth` / `Danielle` (Generative)
        * Portuguese (`pt-BR`): `Camila` (Neural)
   2. `openai_tts` (Expressive Conversational Feminine):
      - Calls OpenAI Audio API (`tts-1` or `gpt-4o-mini-tts`) using the warm feminine voice `nova` (with option to toggle `shimmer` or `coral`).
   3. `elevenlabs` (Ultra-Realistic Human Feminine):
      - Calls ElevenLabs API (`eleven_flash_v2_5` for low latency and 50% lower cost, or `eleven_multilingual_v2`) using a natural feminine voice ID (e.g., `Charlotte` or `Matilda`) with natural breathing and intonation.
   4. `browser_natural` ($0.00 Client-Side Fallback):
      - Uses `window.speechSynthesis` on the client, implementing a smart voice-priority filter (`getBestFeminineVoice(targetLanguage)`) that searches `speechSynthesis.getVoices()` for high-quality feminine voices (matching keywords like `"Natural"`, `"Online"`, `"Google"`, `"Katja"`, `"Vicki"`, `"Anna"`, `"Helena"`, `"Paulina"`, `"Female"`) before falling back to the OS default.

B. S3 + CloudFront Audio Caching Pipeline & Mobile Audio Unlock (`POST /api/tts/synthesize`):
   - Input: `{ text, targetLanguage, engine, voiceId }`.
   - Deterministic cache key: `hash = SHA256(engine + ":" + voiceId + ":" + targetLanguage + ":" + text.trim())`.
   - Check PostgreSQL `audio_cache` table (or S3 `HEAD` request on `s3://{Bucket}/audio-cache/${hash}.mp3`). If cached, immediately return the CloudFront URL.
   - If not cached, synthesize the MP3, upload to S3 with `Cache-Control: public, max-age=31536000, immutable`, record in PostgreSQL, and return the CloudFront URL.
   - Mobile iOS/Android Audio Autoplay Compliance: Reuse a single persistent HTML5 `<audio playsInline>` instance unlocked on the user's first tap so sequential sentence-by-sentence playback never gets blocked by mobile Safari or Chrome autoplay restrictions. Support `audio.playbackRate = 0.75` or `1.0` with `preservesPitch = true`.

===================================================================
4. PROFILE-DRIVEN LANGUAGE, THEME & CUSTOM INSTRUCTIONS CONFIG
===================================================================
A. Centralized Language Settings (Managed Exclusively in the `👤 Profile` Tab):
   - Site / Base Language (`uiLanguage`): Controls the entire website UI localization, inline sentence translations, vocabulary notes, and grammar explanations (e.g., English `en`, Portuguese `pt-BR`, Spanish `es`).
   - Studied / Story & Listening Language (`targetLanguage`): Controls the language passed to the AI Story & Question Agents AND the BCP-47 voice locale used by the Listening Audio / TTS Engine (e.g., German `de-DE`, French `fr-FR`, Spanish `es-ES`, Italian `it-IT`, English `en-US`).
   - CEFR Level (`cefrLevel`): Default `A2` (configurable `A1`, `A2`, `B1`, `B2` in the Profile tab).
   - Default Feminine Voice Engine (`preferredVoiceEngine`): Selector with a 1-tap "🔊 Test Voice" button.
   - Persistence: Changing these settings in the Profile Tab calls `PATCH /api/me/preferences`, updating PostgreSQL and the active React Context.

B. The 10 Selectable Story Themes (Rendered as a 2-Column Mobile Grid in the Generator Bottom Sheet):
   1. `fun_facts`: Curiosities & Fun Facts
   2. `science_nature`: Science & Nature
   3. `history`: History & Time Travel
   4. `culture_daily`: Everyday Life & Culture
   5. `tech_inventions`: Technology & Inventions
   6. `travel_places`: Travel & Hidden Places
   7. `food_culinary`: Food & Culinary Secrets
   8. `psychology`: Psychology & Human Behavior
   9. `space_cosmos`: Space & The Universe
   10. `sports_pop`: Sports, Music & Pop Culture

C. Additional Custom Instructions & Focus Keywords (`additionalInstructions`):
   - Inside the "✨ Generate New Story" slide-up bottom sheet, provide an optional input field:
     * Label: Localized in `uiLanguage` (e.g., "Additional Instructions or Keywords")
     * Placeholder: "e.g., 'DNA', 'KI / Artificial Intelligence', 'Focus on separable verbs'"
   - Passed via payload: `{ theme, additionalInstructions?: string }`.

===================================================================
5. THE 3-AGENT ARCHITECTURE & AUTO-PREFETCH WORKFLOW (`gemini-3.8-flash`)
===================================================================
All agents must be implemented as modular TypeScript services in the AWS Lambda backend using `model: "gemini-3.8-flash"` and reading the user's Profile language settings (`targetLanguage`, `uiLanguage`, `cefrLevel`).

-------------------------------------------------------------------
AGENT 1: Story & Question Architect (`StoryGeneratorAgent`)
-------------------------------------------------------------------
- Trigger: `POST /api/agents/generate-story` (Inputs: `theme`, `additionalInstructions`, `excludeRecentTitles?: string[]`, plus user Profile's `targetLanguage`, `uiLanguage`, `cefrLevel`).
- Role & System Prompt:
  * Act as an expert CEFR curriculum designer for `targetLanguage`.
  * Ensure the new story topic is completely distinct from any title listed in `excludeRecentTitles`.
  * If `additionalInstructions` is provided (e.g., "DNA", "KI"), seamlessly weave those concepts into the narrative while explaining/contextualizing them with simple, everyday words so the text strictly remains at `cefrLevel`.
  * Generate a 6-to-8 sentence engaging story in `targetLanguage` calibrated to `cefrLevel` (for A2: short sentences, everyday vocabulary, simple past/perfect tenses, basic connectors).
  * Provide an accurate sentence-by-sentence translation in `uiLanguage`.
  * Generate 6 comprehension questions in `targetLanguage` with translations and ideal model answers in `targetLanguage` and `uiLanguage`.
  * SHUFFLE RULE: Order the 6 questions NON-CHRONOLOGICALLY so the user cannot answer in sentence order (1 -> 6).
- Output Enforcement: `responseMimeType: "application/json"` with strict `responseSchema`. Save immediately to PostgreSQL.

-------------------------------------------------------------------
AGENT 2: Dynamic Answer Evaluator & Tutor (`AnswerCorrectionAgent`)
-------------------------------------------------------------------
- Trigger: `POST /api/agents/evaluate-answers` (Inputs: `storyId`, and the array of 6 `{ questionId, userAnswer }` items).
- Role & System Prompt:
  * Batch-evaluate all 6 student answers in a single call to `gemini-3.8-flash`.
  * Return a 4-part evaluation object per question written in `uiLanguage`:
    1. `sentenceCorrection`: `{ status: "correct"|"partial"|"incorrect", correctedUserSentence, feedbackNote, modelAnswer }`.
    2. `translation`: Full `uiLanguage` translation of question and model answer.
    3. `vocabBreakdown`: Array of 3–4 key words with `word`, `gender` (`der`/`die`/`das`, etc.), `plural`, `pos`, and `note`.
    4. `grammarAnalysis`: Bite-sized `cefrLevel` grammar rule explanation in `uiLanguage`.
- Output Enforcement: Strict `responseSchema`. Save score and feedback JSON to `user_progress` in PostgreSQL.

-------------------------------------------------------------------
AUTOMATIC BACKGROUND STORY PRE-GENERATION (ZERO-WAIT NEXT STORY FLOW)
-------------------------------------------------------------------
- Trigger Rule: ALWAYS and AUTOMATICALLY trigger **Agent 1 (`POST /api/agents/generate-story`)** in the background the exact moment the user finishes correcting their answers (`evaluate-answers` resolves).
- Execution Flow:
  1. As soon as Agent 2 displays the 4-part correction cards on screen, fire an asynchronous background call to `POST /api/agents/generate-story` using the active `theme`, active `additionalInstructions` (if any), the user's Profile language settings, and `excludeRecentTitles` containing the titles of already-seen stories.
  2. While the background request is running, display a live status indicator inside the top feedback progression banner:
     `⏳ Generating your next story in the background...`
  3. The moment Agent 1 returns the newly generated story:
     - Store it in `prefetchedNextStory` React state (and append it to the local story library list).
     - Automatically pre-warm the TTS audio cache (`POST /api/tts/synthesize`) for Sentence 1 of `prefetchedNextStory` in the background.
     - Update the progression button to an active, glowing state:
       `✨ Next Story Ready: "${prefetchedNextStory.title}" — Start Now ⏭️`
  4. When the user taps "Start Now ⏭️", immediately swap `currentStory` to `prefetchedNextStory` with **0 ms waiting time**, reset the question inputs, and scroll smoothly to the top of the new story.

-------------------------------------------------------------------
AGENT 3: Contextual Doubt & Grammar Assistant (`DoubtSolverAgent`)
-------------------------------------------------------------------
- Trigger: `POST /api/agents/ask-doubt` (Inputs: `storyId`, `userQuestion`, optional `selectedSentenceOrQuestionContext`, and `chatHistory`).
- Role & System Prompt:
  * Act as a concise, mobile-friendly language tutor. Keep responses short and scannable on a 9:16 phone screen.
  * Inject the story sentences, the 6 questions, `additionalInstructions`, and the user's answers as system context.

===================================================================
6. POSTGRESQL RELATIONAL SCHEMA
===================================================================
1. `users`: `id` (UUID, PK), `cognito_sub` (VARCHAR, UNIQUE), `email` (VARCHAR, UNIQUE), `name` (VARCHAR), `avatar_url` (TEXT), `ui_language` (VARCHAR, default 'en'), `target_language` (VARCHAR, default 'de-DE'), `cefr_level` (VARCHAR, default 'A2'), `preferred_voice_engine` (VARCHAR, default 'polly_generative'), `created_at` (TIMESTAMPTZ), `updated_at` (TIMESTAMPTZ).
2. `stories`: `id` (UUID, PK), `theme` (VARCHAR), `additional_instructions` (TEXT, nullable), `target_language` (VARCHAR), `ui_language` (VARCHAR), `cefr_level` (VARCHAR), `title` (VARCHAR), `created_by_user_id` (UUID, FK, nullable), `created_at` (TIMESTAMPTZ).
3. `story_sentences`: `id` (SERIAL, PK), `story_id` (UUID, FK -> stories.id ON DELETE CASCADE), `sentence_index` (INT), `text_target` (TEXT), `text_ui` (TEXT).
4. `story_questions`: `id` (SERIAL, PK), `story_id` (UUID, FK -> stories.id ON DELETE CASCADE), `default_shuffled_order` (INT), `question_target` (TEXT), `question_ui` (TEXT), `model_answer_target` (TEXT), `model_answer_ui` (TEXT).
5. `audio_cache`: `hash` (VARCHAR(64), PK), `engine` (VARCHAR), `voice_id` (VARCHAR), `target_language` (VARCHAR), `s3_key` (TEXT), `cloudfront_url` (TEXT), `created_at` (TIMESTAMPTZ).
6. `user_progress`: `id` (SERIAL, PK), `user_id` (UUID, FK -> users.id), `story_id` (UUID, FK -> stories.id), `score` (INT), `ai_feedback_json` (JSONB), `completed_at` (TIMESTAMPTZ), UNIQUE(`user_id`, `story_id`).
7. `user_vocabulary`: `id` (SERIAL, PK), `user_id` (UUID, FK -> users.id), `target_language` (VARCHAR), `word` (VARCHAR), `gender` (VARCHAR), `plural` (VARCHAR), `pos` (VARCHAR), `note` (TEXT), `saved_at` (TIMESTAMPTZ), UNIQUE(`user_id`, `target_language`, `word`).

===================================================================
7. CORE 9:16 FRONTEND COMPONENT DETAILS
===================================================================
A. Story Sentence Cards (Optimized for 9:16 Vertical Width):
   - Transcript text in `targetLanguage` is blurred by default (`filter: blur(9px)`).
   - Each sentence card features a compact bottom action bar with 3 thumb-friendly icon+label pills:
     * `🔊 Listen` (plays only this sentence in the active feminine voice).
     * `🌐 Translate` (toggles the `uiLanguage` translation directly below this sentence).
     * `❓ Ask` (opens the Agent 3 Slide-Up Bottom Sheet pre-loaded with this sentence).

B. 6 Shuffled Questions (Vertical Mobile Cards):
   - Question texts are blurred by default with a `🔊 Listen` button, an `👁️` reveal toggle, and a `16px` mobile-friendly input box (`enterKeyHint="next"`).
   - Includes a `"🔀 Shuffle"` pill button at the top of the section.
   - Full-width `"📝 Submit & Correct"` button at the bottom of the question list that triggers Agent 2 AND immediately kicks off the background pre-generation of the next story via Agent 1.

===================================================================
8. DELIVERABLES REQUESTED
===================================================================
1. Project Folder Structure (Frontend + Backend + Agents + TTS Service + Database + AWS SAM IaC + PWA manifest).
2. Complete PostgreSQL Schema (`schema.sql`) and Drizzle ORM definition.
3. AWS SAM (`template.yaml`) configuring Cognito Google-SSO Only, HTTP API v2, Node.js 20 Lambda, and S3 + CloudFront.
4. Full TypeScript Backend implementation:
   - Profile endpoints (`GET /api/me`, `PATCH /api/me/preferences`).
   - Pluggable Feminine TTS Service (`ttsService.ts`) with S3/CloudFront caching.
   - The 3 Gemini 3.8 Flash Agents (`storyGenerator.ts`, `answerCorrection.ts`, `doubtSolver.ts`).
5. Complete 9:16 Mobile-First React + TypeScript + Tailwind Frontend (`AppShell9x16`, Sticky Bottom Audio Dock, Bottom Tab Navigation, `ProfileTab`, Slide-Up Story Generator Sheet, Automatic Background Next-Story Prefetch Hook, Pure-Listening Sentence Cards, Shuffled Question Cards, Stacked 4-Part Feedback Cards, and Slide-Up Doubt Chat Sheet).