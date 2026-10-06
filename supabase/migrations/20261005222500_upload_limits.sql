-- Keep the proofs bucket private; only increase the per-object limit.
UPDATE storage.buckets SET file_size_limit = 104857600 WHERE id = 'proofs';
ALTER TABLE public.event_settings ALTER COLUMN max_file_mb SET DEFAULT 100;
UPDATE public.event_settings SET max_file_mb = 100 WHERE id = 1 AND max_file_mb <= 50;

