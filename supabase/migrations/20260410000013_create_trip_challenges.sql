-- Challenge system for trips: participants, challenges, completions, leaderboard

CREATE TABLE IF NOT EXISTS public.trip_challenge_participants (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  trip_id uuid NOT NULL REFERENCES public.trips(id) ON DELETE CASCADE,
  created_by uuid NOT NULL,
  name text NOT NULL,
  created_at timestamptz NOT NULL DEFAULT now()
);

CREATE TABLE IF NOT EXISTS public.trip_challenges (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  trip_id uuid NOT NULL REFERENCES public.trips(id) ON DELETE CASCADE,
  created_by uuid NOT NULL,
  title text NOT NULL,
  points integer NOT NULL CHECK (points >= 0),
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

CREATE TABLE IF NOT EXISTS public.trip_challenge_completions (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  trip_id uuid NOT NULL REFERENCES public.trips(id) ON DELETE CASCADE,
  challenge_id uuid NOT NULL REFERENCES public.trip_challenges(id) ON DELETE CASCADE,
  participant_id uuid NOT NULL REFERENCES public.trip_challenge_participants(id) ON DELETE CASCADE,
  completed_by uuid NOT NULL,
  created_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (challenge_id, participant_id)
);

CREATE INDEX IF NOT EXISTS idx_trip_challenge_participants_trip_id
  ON public.trip_challenge_participants(trip_id);

CREATE INDEX IF NOT EXISTS idx_trip_challenges_trip_id
  ON public.trip_challenges(trip_id);

CREATE INDEX IF NOT EXISTS idx_trip_challenge_completions_trip_id
  ON public.trip_challenge_completions(trip_id);

CREATE INDEX IF NOT EXISTS idx_trip_challenge_completions_challenge_id
  ON public.trip_challenge_completions(challenge_id);

CREATE INDEX IF NOT EXISTS idx_trip_challenge_completions_participant_id
  ON public.trip_challenge_completions(participant_id);

CREATE OR REPLACE FUNCTION public.set_trip_challenges_updated_at()
RETURNS trigger
LANGUAGE plpgsql
SET search_path TO ''
AS $$
BEGIN
  NEW.updated_at := now();
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS set_trip_challenges_updated_at ON public.trip_challenges;
CREATE TRIGGER set_trip_challenges_updated_at
BEFORE UPDATE ON public.trip_challenges
FOR EACH ROW
EXECUTE FUNCTION public.set_trip_challenges_updated_at();

CREATE OR REPLACE FUNCTION public.ensure_trip_challenge_completion_trip_match()
RETURNS trigger
LANGUAGE plpgsql
SET search_path TO ''
AS $$
DECLARE
  challenge_trip_id uuid;
  participant_trip_id uuid;
BEGIN
  SELECT tc.trip_id INTO challenge_trip_id
  FROM public.trip_challenges tc
  WHERE tc.id = NEW.challenge_id;

  SELECT tcp.trip_id INTO participant_trip_id
  FROM public.trip_challenge_participants tcp
  WHERE tcp.id = NEW.participant_id;

  IF challenge_trip_id IS NULL OR participant_trip_id IS NULL THEN
    RAISE EXCEPTION 'Challenge or participant not found';
  END IF;

  IF NEW.trip_id <> challenge_trip_id OR NEW.trip_id <> participant_trip_id THEN
    RAISE EXCEPTION 'trip_id mismatch for challenge completion';
  END IF;

  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS ensure_trip_challenge_completion_trip_match ON public.trip_challenge_completions;
CREATE TRIGGER ensure_trip_challenge_completion_trip_match
BEFORE INSERT OR UPDATE ON public.trip_challenge_completions
FOR EACH ROW
EXECUTE FUNCTION public.ensure_trip_challenge_completion_trip_match();

ALTER TABLE public.trip_challenge_participants ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.trip_challenges ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.trip_challenge_completions ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "trip_challenge_participants_select_members" ON public.trip_challenge_participants;
CREATE POLICY "trip_challenge_participants_select_members"
ON public.trip_challenge_participants
FOR SELECT
USING (
  EXISTS (
    SELECT 1
    FROM public.trip_members tm
    WHERE tm.trip_id = trip_challenge_participants.trip_id
      AND tm.user_id = auth.uid()
  )
);

DROP POLICY IF EXISTS "trip_challenge_participants_insert_members" ON public.trip_challenge_participants;
CREATE POLICY "trip_challenge_participants_insert_members"
ON public.trip_challenge_participants
FOR INSERT
WITH CHECK (
  created_by = auth.uid()
  AND EXISTS (
    SELECT 1
    FROM public.trip_members tm
    WHERE tm.trip_id = trip_challenge_participants.trip_id
      AND tm.user_id = auth.uid()
  )
);

DROP POLICY IF EXISTS "trip_challenge_participants_update_members" ON public.trip_challenge_participants;
CREATE POLICY "trip_challenge_participants_update_members"
ON public.trip_challenge_participants
FOR UPDATE
USING (
  EXISTS (
    SELECT 1
    FROM public.trip_members tm
    WHERE tm.trip_id = trip_challenge_participants.trip_id
      AND tm.user_id = auth.uid()
  )
)
WITH CHECK (
  EXISTS (
    SELECT 1
    FROM public.trip_members tm
    WHERE tm.trip_id = trip_challenge_participants.trip_id
      AND tm.user_id = auth.uid()
  )
);

DROP POLICY IF EXISTS "trip_challenge_participants_delete_members" ON public.trip_challenge_participants;
CREATE POLICY "trip_challenge_participants_delete_members"
ON public.trip_challenge_participants
FOR DELETE
USING (
  EXISTS (
    SELECT 1
    FROM public.trip_members tm
    WHERE tm.trip_id = trip_challenge_participants.trip_id
      AND tm.user_id = auth.uid()
  )
);

DROP POLICY IF EXISTS "trip_challenges_select_members" ON public.trip_challenges;
CREATE POLICY "trip_challenges_select_members"
ON public.trip_challenges
FOR SELECT
USING (
  EXISTS (
    SELECT 1
    FROM public.trip_members tm
    WHERE tm.trip_id = trip_challenges.trip_id
      AND tm.user_id = auth.uid()
  )
);

DROP POLICY IF EXISTS "trip_challenges_insert_members" ON public.trip_challenges;
CREATE POLICY "trip_challenges_insert_members"
ON public.trip_challenges
FOR INSERT
WITH CHECK (
  created_by = auth.uid()
  AND EXISTS (
    SELECT 1
    FROM public.trip_members tm
    WHERE tm.trip_id = trip_challenges.trip_id
      AND tm.user_id = auth.uid()
  )
);

DROP POLICY IF EXISTS "trip_challenges_update_members" ON public.trip_challenges;
CREATE POLICY "trip_challenges_update_members"
ON public.trip_challenges
FOR UPDATE
USING (
  EXISTS (
    SELECT 1
    FROM public.trip_members tm
    WHERE tm.trip_id = trip_challenges.trip_id
      AND tm.user_id = auth.uid()
  )
)
WITH CHECK (
  EXISTS (
    SELECT 1
    FROM public.trip_members tm
    WHERE tm.trip_id = trip_challenges.trip_id
      AND tm.user_id = auth.uid()
  )
);

DROP POLICY IF EXISTS "trip_challenges_delete_members" ON public.trip_challenges;
CREATE POLICY "trip_challenges_delete_members"
ON public.trip_challenges
FOR DELETE
USING (
  EXISTS (
    SELECT 1
    FROM public.trip_members tm
    WHERE tm.trip_id = trip_challenges.trip_id
      AND tm.user_id = auth.uid()
  )
);

DROP POLICY IF EXISTS "trip_challenge_completions_select_members" ON public.trip_challenge_completions;
CREATE POLICY "trip_challenge_completions_select_members"
ON public.trip_challenge_completions
FOR SELECT
USING (
  EXISTS (
    SELECT 1
    FROM public.trip_members tm
    WHERE tm.trip_id = trip_challenge_completions.trip_id
      AND tm.user_id = auth.uid()
  )
);

DROP POLICY IF EXISTS "trip_challenge_completions_insert_members" ON public.trip_challenge_completions;
CREATE POLICY "trip_challenge_completions_insert_members"
ON public.trip_challenge_completions
FOR INSERT
WITH CHECK (
  completed_by = auth.uid()
  AND EXISTS (
    SELECT 1
    FROM public.trip_members tm
    WHERE tm.trip_id = trip_challenge_completions.trip_id
      AND tm.user_id = auth.uid()
  )
);

DROP POLICY IF EXISTS "trip_challenge_completions_update_members" ON public.trip_challenge_completions;
CREATE POLICY "trip_challenge_completions_update_members"
ON public.trip_challenge_completions
FOR UPDATE
USING (
  EXISTS (
    SELECT 1
    FROM public.trip_members tm
    WHERE tm.trip_id = trip_challenge_completions.trip_id
      AND tm.user_id = auth.uid()
  )
)
WITH CHECK (
  EXISTS (
    SELECT 1
    FROM public.trip_members tm
    WHERE tm.trip_id = trip_challenge_completions.trip_id
      AND tm.user_id = auth.uid()
  )
);

DROP POLICY IF EXISTS "trip_challenge_completions_delete_members" ON public.trip_challenge_completions;
CREATE POLICY "trip_challenge_completions_delete_members"
ON public.trip_challenge_completions
FOR DELETE
USING (
  EXISTS (
    SELECT 1
    FROM public.trip_members tm
    WHERE tm.trip_id = trip_challenge_completions.trip_id
      AND tm.user_id = auth.uid()
  )
);
