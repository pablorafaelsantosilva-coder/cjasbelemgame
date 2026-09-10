
-- ENUMS
CREATE TYPE public.app_role AS ENUM ('admin','participant');
CREATE TYPE public.challenge_type AS ENUM ('normal','relampago');
CREATE TYPE public.challenge_status AS ENUM ('rascunho','agendado','encerrado','cancelado');
CREATE TYPE public.submission_status AS ENUM ('submitted','confirmed','rejected');

-- PROFILES
CREATE TABLE public.profiles (
  id uuid PRIMARY KEY REFERENCES auth.users(id) ON DELETE CASCADE,
  name text NOT NULL DEFAULT 'Participante',
  email text,
  avatar_url text,
  status text NOT NULL DEFAULT 'active',
  total_points integer NOT NULL DEFAULT 0,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);
GRANT SELECT, INSERT, UPDATE ON public.profiles TO authenticated;
GRANT ALL ON public.profiles TO service_role;
ALTER TABLE public.profiles ENABLE ROW LEVEL SECURITY;

-- USER ROLES
CREATE TABLE public.user_roles (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  role public.app_role NOT NULL,
  created_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (user_id, role)
);
GRANT SELECT ON public.user_roles TO authenticated;
GRANT ALL ON public.user_roles TO service_role;
ALTER TABLE public.user_roles ENABLE ROW LEVEL SECURITY;

CREATE OR REPLACE FUNCTION public.has_role(_user_id uuid, _role public.app_role)
RETURNS boolean LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public AS $$
  SELECT EXISTS (SELECT 1 FROM public.user_roles WHERE user_id = _user_id AND role = _role);
$$;

CREATE OR REPLACE FUNCTION public.is_admin()
RETURNS boolean LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public AS $$
  SELECT public.has_role(auth.uid(), 'admin');
$$;

CREATE POLICY "profiles_select_own" ON public.profiles FOR SELECT TO authenticated USING (id = auth.uid() OR public.is_admin());
CREATE POLICY "profiles_update_own" ON public.profiles FOR UPDATE TO authenticated USING (id = auth.uid() OR public.is_admin()) WITH CHECK (id = auth.uid() OR public.is_admin());
CREATE POLICY "profiles_insert_own" ON public.profiles FOR INSERT TO authenticated WITH CHECK (id = auth.uid());

CREATE POLICY "roles_select_own" ON public.user_roles FOR SELECT TO authenticated USING (user_id = auth.uid() OR public.is_admin());

-- CHALLENGES
CREATE TABLE public.challenges (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  title text NOT NULL,
  description text NOT NULL DEFAULT '',
  instructions text NOT NULL DEFAULT '',
  points integer NOT NULL DEFAULT 100,
  type public.challenge_type NOT NULL DEFAULT 'normal',
  starts_at timestamptz NOT NULL DEFAULT now(),
  ends_at timestamptz NOT NULL DEFAULT (now() + interval '1 day'),
  requires_photo boolean NOT NULL DEFAULT true,
  requires_video boolean NOT NULL DEFAULT false,
  allow_resubmit boolean NOT NULL DEFAULT true,
  audience text,
  max_participants integer,
  extra_rules text,
  status public.challenge_status NOT NULL DEFAULT 'rascunho',
  created_by uuid REFERENCES auth.users(id) ON DELETE SET NULL,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.challenges TO authenticated;
GRANT ALL ON public.challenges TO service_role;
ALTER TABLE public.challenges ENABLE ROW LEVEL SECURITY;
CREATE INDEX challenges_window_idx ON public.challenges (starts_at, ends_at);

-- participants only see published (agendado) challenges that already started
CREATE POLICY "challenges_select_live" ON public.challenges FOR SELECT TO authenticated
USING (public.is_admin() OR (status IN ('agendado','encerrado') AND starts_at <= now()));
CREATE POLICY "challenges_admin_write" ON public.challenges FOR ALL TO authenticated
USING (public.is_admin()) WITH CHECK (public.is_admin());

-- SUBMISSIONS
CREATE TABLE public.submissions (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  challenge_id uuid NOT NULL REFERENCES public.challenges(id) ON DELETE CASCADE,
  user_id uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  status public.submission_status NOT NULL DEFAULT 'submitted',
  submitted_at timestamptz NOT NULL DEFAULT now(),
  reviewed_at timestamptz,
  reviewed_by uuid REFERENCES auth.users(id) ON DELETE SET NULL,
  rejection_reason text,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (challenge_id, user_id)
);
GRANT SELECT, INSERT, UPDATE ON public.submissions TO authenticated;
GRANT ALL ON public.submissions TO service_role;
ALTER TABLE public.submissions ENABLE ROW LEVEL SECURITY;
CREATE INDEX submissions_status_idx ON public.submissions (status, submitted_at);
CREATE INDEX submissions_user_idx ON public.submissions (user_id);

CREATE POLICY "submissions_select" ON public.submissions FOR SELECT TO authenticated USING (user_id = auth.uid() OR public.is_admin());
CREATE POLICY "submissions_insert_own" ON public.submissions FOR INSERT TO authenticated WITH CHECK (user_id = auth.uid());
CREATE POLICY "submissions_update_own_pending" ON public.submissions FOR UPDATE TO authenticated
USING ((user_id = auth.uid() AND status = 'rejected') OR public.is_admin())
WITH CHECK ((user_id = auth.uid() AND status = 'submitted') OR public.is_admin());

-- SUBMISSION FILES
CREATE TABLE public.submission_files (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  submission_id uuid NOT NULL REFERENCES public.submissions(id) ON DELETE CASCADE,
  user_id uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  storage_path text NOT NULL,
  file_type text NOT NULL,
  file_size bigint NOT NULL DEFAULT 0,
  created_at timestamptz NOT NULL DEFAULT now()
);
GRANT SELECT, INSERT, DELETE ON public.submission_files TO authenticated;
GRANT ALL ON public.submission_files TO service_role;
ALTER TABLE public.submission_files ENABLE ROW LEVEL SECURITY;
CREATE POLICY "files_select" ON public.submission_files FOR SELECT TO authenticated USING (user_id = auth.uid() OR public.is_admin());
CREATE POLICY "files_insert_own" ON public.submission_files FOR INSERT TO authenticated WITH CHECK (user_id = auth.uid());
CREATE POLICY "files_delete_own" ON public.submission_files FOR DELETE TO authenticated USING (user_id = auth.uid());

-- POINTS
CREATE TABLE public.points_transactions (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  challenge_id uuid REFERENCES public.challenges(id) ON DELETE SET NULL,
  points integer NOT NULL,
  type text NOT NULL DEFAULT 'challenge',
  description text,
  created_by uuid REFERENCES auth.users(id) ON DELETE SET NULL,
  created_at timestamptz NOT NULL DEFAULT now()
);
GRANT SELECT ON public.points_transactions TO authenticated;
GRANT ALL ON public.points_transactions TO service_role;
ALTER TABLE public.points_transactions ENABLE ROW LEVEL SECURITY;
CREATE POLICY "points_select" ON public.points_transactions FOR SELECT TO authenticated USING (user_id = auth.uid() OR public.is_admin());

CREATE OR REPLACE FUNCTION public.apply_points() RETURNS trigger
LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
BEGIN
  UPDATE public.profiles SET total_points = total_points + NEW.points, updated_at = now() WHERE id = NEW.user_id;
  RETURN NEW;
END; $$;
CREATE TRIGGER points_apply AFTER INSERT ON public.points_transactions
FOR EACH ROW EXECUTE FUNCTION public.apply_points();

-- NOTIFICATIONS
CREATE TABLE public.notifications (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  title text NOT NULL,
  message text NOT NULL DEFAULT '',
  type text NOT NULL DEFAULT 'info',
  read boolean NOT NULL DEFAULT false,
  created_at timestamptz NOT NULL DEFAULT now()
);
GRANT SELECT, UPDATE ON public.notifications TO authenticated;
GRANT ALL ON public.notifications TO service_role;
ALTER TABLE public.notifications ENABLE ROW LEVEL SECURITY;
CREATE INDEX notifications_user_idx ON public.notifications (user_id, read, created_at DESC);
CREATE POLICY "notif_select_own" ON public.notifications FOR SELECT TO authenticated USING (user_id = auth.uid());
CREATE POLICY "notif_update_own" ON public.notifications FOR UPDATE TO authenticated USING (user_id = auth.uid()) WITH CHECK (user_id = auth.uid());

-- AUDIT
CREATE TABLE public.audit_logs (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  admin_id uuid REFERENCES auth.users(id) ON DELETE SET NULL,
  action text NOT NULL,
  entity_type text,
  entity_id uuid,
  details jsonb NOT NULL DEFAULT '{}'::jsonb,
  created_at timestamptz NOT NULL DEFAULT now()
);
GRANT SELECT, INSERT ON public.audit_logs TO authenticated;
GRANT ALL ON public.audit_logs TO service_role;
ALTER TABLE public.audit_logs ENABLE ROW LEVEL SECURITY;
CREATE POLICY "audit_admin_select" ON public.audit_logs FOR SELECT TO authenticated USING (public.is_admin());
CREATE POLICY "audit_admin_insert" ON public.audit_logs FOR INSERT TO authenticated WITH CHECK (public.is_admin());

-- EVENT SETTINGS
CREATE TABLE public.event_settings (
  id integer PRIMARY KEY DEFAULT 1,
  name text NOT NULL DEFAULT 'CJAS Belém Game',
  logo_url text,
  start_date date NOT NULL DEFAULT current_date,
  end_date date NOT NULL DEFAULT (current_date + 3),
  rules text NOT NULL DEFAULT '',
  org_message text NOT NULL DEFAULT '',
  max_file_mb integer NOT NULL DEFAULT 50,
  finished boolean NOT NULL DEFAULT false,
  updated_at timestamptz NOT NULL DEFAULT now(),
  CONSTRAINT single_row CHECK (id = 1)
);
GRANT SELECT, INSERT, UPDATE ON public.event_settings TO authenticated;
GRANT ALL ON public.event_settings TO service_role;
ALTER TABLE public.event_settings ENABLE ROW LEVEL SECURITY;
CREATE POLICY "settings_read" ON public.event_settings FOR SELECT TO authenticated USING (true);
CREATE POLICY "settings_admin_write" ON public.event_settings FOR ALL TO authenticated USING (public.is_admin()) WITH CHECK (public.is_admin());
INSERT INTO public.event_settings (id) VALUES (1);

-- LEADERBOARD VIEW (public data only)
CREATE VIEW public.leaderboard AS
SELECT p.id, p.name, p.avatar_url, p.total_points,
       RANK() OVER (ORDER BY p.total_points DESC, p.created_at ASC) AS position
FROM public.profiles p
WHERE p.status = 'active';
GRANT SELECT ON public.leaderboard TO authenticated;

-- NEW USER HANDLER: first user becomes admin
CREATE OR REPLACE FUNCTION public.handle_new_user() RETURNS trigger
LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE user_count integer;
BEGIN
  INSERT INTO public.profiles (id, name, email)
  VALUES (NEW.id, COALESCE(NEW.raw_user_meta_data->>'name', split_part(NEW.email,'@',1)), NEW.email);
  SELECT count(*) INTO user_count FROM public.user_roles;
  IF user_count = 0 THEN
    INSERT INTO public.user_roles (user_id, role) VALUES (NEW.id, 'admin');
  ELSE
    INSERT INTO public.user_roles (user_id, role) VALUES (NEW.id, 'participant');
  END IF;
  RETURN NEW;
END; $$;
CREATE TRIGGER on_auth_user_created AFTER INSERT ON auth.users
FOR EACH ROW EXECUTE FUNCTION public.handle_new_user();

-- REVIEW SUBMISSION (admin)
CREATE OR REPLACE FUNCTION public.review_submission(_submission_id uuid, _approve boolean, _reason text DEFAULT NULL)
RETURNS void LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE s record; c record;
BEGIN
  IF NOT public.has_role(auth.uid(), 'admin') THEN RAISE EXCEPTION 'Acesso negado'; END IF;
  SELECT * INTO s FROM public.submissions WHERE id = _submission_id FOR UPDATE;
  IF s IS NULL THEN RAISE EXCEPTION 'Envio não encontrado'; END IF;
  IF s.status = 'confirmed' THEN RAISE EXCEPTION 'Envio já confirmado'; END IF;
  SELECT * INTO c FROM public.challenges WHERE id = s.challenge_id;

  IF _approve THEN
    UPDATE public.submissions SET status='confirmed', reviewed_at=now(), reviewed_by=auth.uid(), rejection_reason=NULL, updated_at=now() WHERE id=_submission_id;
    INSERT INTO public.points_transactions (user_id, challenge_id, points, type, description, created_by)
    VALUES (s.user_id, s.challenge_id, c.points, 'challenge', 'Desafio confirmado: '||c.title, auth.uid());
    INSERT INTO public.notifications (user_id, title, message, type)
    VALUES (s.user_id, '🎉 Atividade confirmada!', 'Você recebeu +'||c.points||' pontos por "'||c.title||'".', 'confirmed');
  ELSE
    UPDATE public.submissions SET status='rejected', reviewed_at=now(), reviewed_by=auth.uid(), rejection_reason=_reason, updated_at=now() WHERE id=_submission_id;
    INSERT INTO public.notifications (user_id, title, message, type)
    VALUES (s.user_id, '❌ Atividade não confirmada', 'Motivo: '||COALESCE(_reason,'não informado'), 'rejected');
  END IF;

  INSERT INTO public.audit_logs (admin_id, action, entity_type, entity_id, details)
  VALUES (auth.uid(), CASE WHEN _approve THEN 'submission_confirmed' ELSE 'submission_rejected' END, 'submission', _submission_id,
          jsonb_build_object('challenge', c.title, 'user_id', s.user_id, 'reason', _reason));
END; $$;

-- MANUAL POINTS ADJUSTMENT (admin)
CREATE OR REPLACE FUNCTION public.adjust_points(_user_id uuid, _points integer, _description text)
RETURNS void LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
BEGIN
  IF NOT public.has_role(auth.uid(), 'admin') THEN RAISE EXCEPTION 'Acesso negado'; END IF;
  INSERT INTO public.points_transactions (user_id, points, type, description, created_by)
  VALUES (_user_id, _points, 'ajuste', _description, auth.uid());
  INSERT INTO public.notifications (user_id, title, message, type)
  VALUES (_user_id, 'Pontuação ajustada', COALESCE(_description,'Ajuste da organização')||' ('||_points||' pontos)', 'points');
  INSERT INTO public.audit_logs (admin_id, action, entity_type, entity_id, details)
  VALUES (auth.uid(), 'points_adjusted', 'user', _user_id, jsonb_build_object('points', _points, 'description', _description));
END; $$;
