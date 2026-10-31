ALTER TABLE public.event_settings
  ADD COLUMN IF NOT EXISTS costume_registration_closed boolean NOT NULL DEFAULT false;

CREATE OR REPLACE FUNCTION public.validate_costume_entry() RETURNS trigger
LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
BEGIN
  PERFORM pg_advisory_xact_lock(hashtext('costume_entries_limit'));
  IF COALESCE((SELECT costume_registration_closed FROM public.event_settings WHERE id = 1), false) THEN
    RAISE EXCEPTION 'As inscrições do Baile foram encerradas.';
  END IF;
  IF (SELECT count(*) FROM public.costume_entries) >= 20 THEN
    RAISE EXCEPTION 'As 20 vagas do concurso já foram preenchidas.';
  END IF;
  IF NOT EXISTS (SELECT 1 FROM public.profiles WHERE id = NEW.user_id AND status = 'active') THEN
    RAISE EXCEPTION 'Conta inativa.';
  END IF;
  NEW.first_name := btrim(NEW.first_name);
  NEW.last_name := btrim(NEW.last_name);
  NEW.costume_name := btrim(NEW.costume_name);
  NEW.description := btrim(NEW.description);
  RETURN NEW;
END $$;

CREATE OR REPLACE FUNCTION public.validate_costume_vote() RETURNS trigger
LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
BEGIN
  IF NOT COALESCE((SELECT costume_registration_closed FROM public.event_settings WHERE id = 1), false) THEN
    RAISE EXCEPTION 'A votação será liberada após o encerramento das inscrições.';
  END IF;
  IF EXISTS (SELECT 1 FROM public.costume_entries WHERE id = NEW.entry_id AND user_id = NEW.voter_id) THEN
    RAISE EXCEPTION 'Você não pode votar na sua própria fantasia.';
  END IF;
  NEW.created_at := now();
  RETURN NEW;
END $$;
