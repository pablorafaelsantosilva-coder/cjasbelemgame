-- Fecha imediatamente as inscrições do Baile e libera a votação.
-- Mantém todas as inscrições e fotos já cadastradas.
ALTER TABLE public.event_settings
  ADD COLUMN IF NOT EXISTS costume_registration_closed boolean NOT NULL DEFAULT false;

UPDATE public.event_settings
SET costume_registration_closed = true,
    updated_at = now()
WHERE id = 1;
