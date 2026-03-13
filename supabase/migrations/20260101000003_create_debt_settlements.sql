-- Create debt_settlements table for expense tracking
CREATE TABLE IF NOT EXISTS debt_settlements (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  trip_id uuid NOT NULL REFERENCES trips(id) ON DELETE CASCADE,
  user_id uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  from_participant_id uuid NOT NULL REFERENCES trip_participants(id) ON DELETE CASCADE,
  to_participant_id uuid NOT NULL REFERENCES trip_participants(id) ON DELETE CASCADE,
  amount numeric(10,2) NOT NULL CHECK (amount > 0),
  date date,
  notes text,
  created_at timestamptz DEFAULT now()
);

ALTER TABLE debt_settlements ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can manage their own settlements"
  ON debt_settlements
  FOR ALL
  USING (auth.uid() = user_id)
  WITH CHECK (auth.uid() = user_id);
