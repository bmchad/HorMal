-- Update default preferred voice engine to Google Cloud TTS (Chirp 3 HD)
ALTER TABLE users ALTER COLUMN preferred_voice_engine SET DEFAULT 'google_cloud_tts';
UPDATE users SET preferred_voice_engine = 'google_cloud_tts' WHERE preferred_voice_engine = 'polly_generative';
