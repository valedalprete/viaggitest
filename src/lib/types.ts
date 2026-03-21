// =============================================
// DATABASE TYPES (aligned with Supabase schema)
// =============================================

export interface Trip {
  id: string;
  user_id: string;
  name: string;
  destination: string;
  lat: number | null;
  lon: number | null;
  start_date: string; // ISO date 'YYYY-MM-DD'
  end_date: string;
  cover_image: string | null;
  notes: string | null;
  created_at: string;
  updated_at: string;
}

export interface TripParticipant {
  id: string;
  trip_id: string;
  user_id: string;
  name: string;
  created_at: string;
}

export interface Flight {
  id: string;
  trip_id: string;
  user_id: string;
  type: 'outbound' | 'return' | 'other';
  airline: string | null;
  flight_number: string | null;
  from_airport: string;
  to_airport: string;
  departure_at: string | null; // ISO timestamptz
  arrival_at: string | null;
  price: number | null;
  booking_ref: string | null;
  notes: string | null;
  created_at: string;
}

export interface Accommodation {
  id: string;
  trip_id: string;
  user_id: string;
  name: string;
  type: 'hotel' | 'airbnb' | 'hostel' | 'apartment' | 'villa' | 'camping' | 'other';
  address: string | null;
  checkin_date: string | null;
  checkin_time: string | null;
  checkout_date: string | null;
  checkout_time: string | null;
  price_per_night: number | null;
  price_type: 'per_night' | 'total';
  booking_ref: string | null;
  booking_url: string | null;
  maps_url: string | null;
  notes: string | null;
  created_at: string;
}

export interface Restaurant {
  id: string;
  trip_id: string;
  user_id: string;
  name: string | null;
  address: string | null;
  status: 'booked' | 'wishlist' | 'recommended';
  booking_date: string | null;
  booking_time: string | null;
  cuisine: string | null;
  price_range: '€' | '€€' | '€€€' | '€€€€' | null;
  source: 'manual' | 'opentripmap';
  external_id: string | null;
  maps_url: string | null;
  tiktok_url: string | null;
  notes: string | null;
  created_at: string;
}

export interface Place {
  id: string;
  trip_id: string;
  user_id: string;
  name: string | null;
  category: string | null;
  address: string | null;
  lat: number | null;
  lon: number | null;
  status: 'booked' | 'wishlist' | 'suggested' | 'chosen';
  booking_date: string | null;
  booking_time: string | null;
  source: 'manual' | 'opentripmap';
  external_id: string | null;
  description: string | null;
  rating: string | null;
  maps_url: string | null;
  tiktok_url: string | null;
  notes: string | null;
  created_at: string;
}

export type ExpenseCategory = 'food' | 'transport' | 'accommodation' | 'activities' | 'shopping' | 'health' | 'other';

export interface Expense {
  id: string;
  trip_id: string;
  user_id: string;
  description: string;
  amount: number;
  category: ExpenseCategory;
  date: string | null;
  paid_by_participant_id: string | null;
  split_type: 'equal' | 'exact';
  created_at: string;
}

export interface ExpenseSplit {
  id: string;
  expense_id: string;
  participant_id: string;
  user_id: string;
  owed_amount: number;
  created_at: string;
}

export interface DiaryEntry {
  id: string;
  trip_id: string;
  user_id: string;
  day_date: string; // 'YYYY-MM-DD'
  author_name: string | null;
  visibility: 'public' | 'private';
  title: string | null;
  content: string | null;
  mood: 1 | 2 | 3 | 4 | 5 | null;
  weather: string | null;
  created_at: string;
  updated_at: string;
}

export interface Transport {
  id: string;
  trip_id: string;
  user_id: string;
  type: 'train' | 'bus' | 'ferry' | 'metro' | 'taxi' | 'uber' | 'other';
  from_location: string | null;
  to_location: string | null;
  date: string | null;
  departure_time: string | null;
  arrival_time: string | null;
  operator: string | null;
  price: number | null;
  booking_ref: string | null;
  notes: string | null;
  created_at: string;
}

export interface CarRental {
  id: string;
  trip_id: string;
  user_id: string;
  company: string | null;
  pickup_location: string | null;
  dropoff_location: string | null;
  pickup_date: string | null;
  dropoff_date: string | null;
  car_model: string | null;
  price_total: number | null;
  booking_ref: string | null;
  notes: string | null;
  created_at: string;
}

export interface TripLiveLocation {
  id: string;
  trip_id: string;
  user_id: string;
  lat: number | null;
  lon: number | null;
  accuracy_m: number | null;
  sharing_enabled: boolean;
  last_shared_at: string | null;
  expires_at: string | null;
  updated_at: string;
}

export interface FlightAttachment {
  id: string;
  trip_id: string;
  flight_id: string;
  uploaded_by: string;
  storage_path: string;
  file_name: string | null;
  mime_type: string | null;
  size_bytes: number | null;
  created_at: string;
}

export interface TransportAttachment {
  id: string;
  trip_id: string;
  transport_id: string;
  uploaded_by: string;
  storage_path: string;
  file_name: string | null;
  mime_type: string | null;
  size_bytes: number | null;
  created_at: string;
}

export interface PlaceAttachment {
  id: string;
  trip_id: string;
  place_id: string;
  uploaded_by: string;
  storage_path: string;
  file_name: string | null;
  mime_type: string | null;
  size_bytes: number | null;
  created_at: string;
}

// =============================================
// APP / UI TYPES
// =============================================

export interface OpenTripMapPlace {
  xid: string;
  name: string;
  kinds: string;
  dist?: number;
  point: { lon: number; lat: number };
}

export interface OpenTripMapDetail {
  xid: string;
  name: string;
  kinds: string;
  rate: string;
  image?: string;
  wikipedia_extracts?: { text: string };
  point: { lon: number; lat: number };
  address?: {
    road?: string;
    city?: string;
    country?: string;
  };
}

export interface NominatimResult {
  display_name: string;
  lat: string;
  lon: string;
  boundingbox: string[];
}

export interface DebtSettlement {
  from: string; // participant name
  to: string;
  fromId: string;
  toId: string;
  amount: number;
}

export const EXPENSE_CATEGORIES: { value: ExpenseCategory; label: string; color: string; icon: string }[] = [
  { value: 'food',          label: 'Cibo & Ristoranti', color: 'bg-orange-100 text-orange-700', icon: '🍽️' },
  { value: 'transport',     label: 'Trasporti',          color: 'bg-blue-100 text-blue-700',    icon: '🚌' },
  { value: 'accommodation', label: 'Alloggio',           color: 'bg-purple-100 text-purple-700', icon: '🏨' },
  { value: 'activities',    label: 'Attività',           color: 'bg-green-100 text-green-700',  icon: '🎡' },
  { value: 'shopping',      label: 'Shopping',           color: 'bg-pink-100 text-pink-700',    icon: '🛍️' },
  { value: 'health',        label: 'Salute',             color: 'bg-red-100 text-red-700',      icon: '💊' },
  { value: 'other',         label: 'Altro',              color: 'bg-gray-100 text-gray-700',    icon: '📦' },
];

export const MOOD_OPTIONS = [
  { value: 1, emoji: '😢', label: 'Pessima' },
  { value: 2, emoji: '😕', label: 'Non bene' },
  { value: 3, emoji: '🙂', label: 'Okay' },
  { value: 4, emoji: '😄', label: 'Ottima' },
  { value: 5, emoji: '🤩', label: 'Fantastica' },
];

// =============================================
// COLLABORATION TYPES
// =============================================

export interface Profile {
  id: string;
  email: string;
  display_name: string | null;
  avatar_url: string | null;
  created_at: string;
  updated_at: string;
}

export type TripRole = 'owner' | 'editor' | 'viewer';

export interface TripMember {
  id: string;
  trip_id: string;
  user_id: string;
  role: TripRole;
  joined_at: string;
  profiles?: Profile;
}

export interface TripInvite {
  id: string;
  trip_id: string;
  invited_by: string;
  email: string | null;
  role: 'editor' | 'viewer';
  token: string;
  expires_at: string;
  accepted_at: string | null;
  created_at: string;
}

export const ROLE_LABELS: Record<TripRole, string> = {
  owner: 'Proprietario',
  editor: 'Editor',
  viewer: 'Visualizzatore',
};

export const ROLE_COLORS: Record<TripRole, string> = {
  owner: 'bg-amber-100 text-amber-700',
  editor: 'bg-blue-100 text-blue-700',
  viewer: 'bg-gray-100 text-gray-600',
};

// =============================================
// WEATHER TYPES
// =============================================

export interface WeatherForecast {
  date: string; // 'YYYY-MM-DD'
  tempMax: number; // °C
  tempMin: number; // °C
  precipitation: number; // mm
  weatherCode: number; // WMO code
  description: string; // 'Sunny', 'Rainy', etc.
  iconName: string; // Lucide icon name
  hint: string; // Context-aware message
}
