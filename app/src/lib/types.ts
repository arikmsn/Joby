// ============================================================
// Joby — TypeScript types (mirrors DB schema)
// ============================================================

import type {
  ShiftStatus,
  ApplicationStatus,
  SOSStatus,
  IncidentType,
  IncidentSeverity,
  IncidentStatus,
  UserRole,
  CheckinSource,
  NotificationChannel,
} from "./constants";

// --- Database Row Types ---

export interface User {
  id: string;
  phone: string;
  email: string | null;
  full_name: string;
  role: UserRole;
  avatar_url: string | null;
  is_active: boolean;
  created_at: string;
  updated_at: string;
}

export interface EmployerProfile {
  id: string;
  user_id: string;
  business_name: string;
  business_type: string | null;
  address: string | null;
  lat: number | null;
  lng: number | null;
  logo_url: string | null;
  created_at: string;
}

export interface WorkerProfile {
  id: string;
  user_id: string;
  date_of_birth: string | null;
  city: string | null;
  lat: number | null;
  lng: number | null;
  experience_tags: string[];
  bio: string | null;
  trust_score: number;
  total_shifts: number;
  no_show_count: number;
  cancel_count: number;
  created_at: string;
}

export interface Shift {
  id: string;
  employer_id: string;
  title: string;
  role_tag: string;
  description: string | null;
  location_name: string | null;
  city: string | null;
  address: string;
  lat: number | null;
  lng: number | null;
  start_at: string;
  end_at: string;
  pay_rate: number;
  pay_type: string;
  workers_needed: number;
  slots_filled: number;
  status: ShiftStatus;
  dress_code: string | null;
  gear_required: string | null;
  arrival_notes: string | null;
  contact_name: string | null;
  contact_phone: string | null;
  min_trust_score: number;
  created_at: string;
  updated_at: string;
}

export interface ShiftWithEmployer extends Shift {
  employer_name: string;
  business_name: string;
}

export interface Application {
  id: string;
  shift_id: string;
  worker_id: string;
  status: ApplicationStatus;
  is_backup: boolean;
  is_sos: boolean;
  applied_at: string;
  approved_at: string | null;
  confirmed_at: string | null;
  checked_in_at: string | null;
  checked_out_at: string | null;
  cancelled_at: string | null;
  cancel_reason: string | null;
  created_at: string;
  updated_at: string;
}

export interface Rating {
  id: string;
  application_id: string;
  shift_id: string;
  worker_id: string;
  employer_id: string;
  score: number;
  flag: string | null;
  comment: string | null;
  created_at: string;
}

export interface CheckinEvent {
  id: string;
  application_id: string;
  shift_id: string;
  worker_id: string;
  event_type: "CHECK_IN" | "CHECK_OUT";
  source: CheckinSource;
  scanned_by_user_id: string | null;
  scanned_at: string;
  lat: number | null;
  lng: number | null;
}

export interface SOSBroadcast {
  id: string;
  shift_id: string;
  employer_id: string;
  slots_needed: number;
  radius_km: number;
  min_trust: number;
  sent_to_count: number;
  filled_count: number;
  status: SOSStatus;
  created_at: string;
  expires_at: string | null;
}

export interface Incident {
  id: string;
  incident_type: IncidentType;
  severity: IncidentSeverity;
  status: IncidentStatus;
  title: string;
  description: string | null;
  related_user_id: string | null;
  related_shift_id: string | null;
  related_application_id: string | null;
  created_by_user_id: string | null;
  assigned_admin_id: string | null;
  resolution_notes: string | null;
  created_at: string;
  updated_at: string;
  resolved_at: string | null;
}

export interface AdminAction {
  id: string;
  admin_user_id: string;
  target_type: string;
  target_id: string;
  action: string;
  details: Record<string, unknown> | null;
  created_at: string;
}

export interface Notification {
  id: string;
  user_id: string;
  type: string;
  title: string;
  body: string | null;
  payload: Record<string, unknown> | null;
  channel: NotificationChannel;
  is_read: boolean;
  sent_at: string;
}

// --- API Response Types ---

export interface AuthResponse {
  token: string;
  user: User;
  profile: EmployerProfile | WorkerProfile;
}

export interface ApiError {
  error: string;
  message: string;
}

export interface PaginatedResponse<T> {
  data: T[];
  total: number;
  page: number;
  limit: number;
}


// --- Auth Context ---

export interface AuthUser {
  id: string;
  phone: string;
  role: UserRole;
  full_name: string;
  is_active: boolean;
}
