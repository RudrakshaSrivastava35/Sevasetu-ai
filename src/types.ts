export type UserRole = 'ngo' | 'volunteer' | 'user';

export interface Profile {
  id: string;
  name: string;
  email: string;
  role: UserRole;
  location: string;
  skills?: string[]; // For volunteers
  ngo_type?: 'medical' | 'education' | 'food' | 'social'; // For NGOs
  ngo_registration_number?: string;
  ngo_document_url?: string;
  ngo_website?: string;
  verification_status?: 'Pending' | 'Verified' | 'Rejected';
  avg_rating?: number;
  total_reviews?: number;
  positive_feedback_percent?: number;
  completed_tasks_count?: number;
  is_verified?: boolean;
  latitude?: number | null;
  longitude?: number | null;
  created_at: string;
}

export interface Feedback {
  id: string;
  ngo_id: string;
  user_id: string;
  need_id?: string;
  rating: number;
  comment: string;
  sentiment_type?: 'Positive' | 'Neutral' | 'Negative';
  sentiment_score?: number;
  created_at: string;
  user?: { name: string }; // Joined
}

export interface Need {
  id: string;
  title: string;
  description: string;
  category: 'medical' | 'education' | 'food' | 'social';
  location: string;
  urgency: 'Low' | 'Medium' | 'High';
  status: 'Pending' | 'Assigned' | 'Completed';
  assigned_volunteer_id: string | null;
  ngo_id: string;
  user_id: string;
  proof_images?: string[];
  proof_submitted?: boolean;
  proof_verified?: boolean;
  accepted_at?: string;
  completed_at?: string;
  created_at: string;
  is_deleted?: boolean;
  deleted_at?: string;
  auto_delete_at?: string;
  latitude?: number | null;
  longitude?: number | null;
  donation_enabled?: boolean;
  target_amount?: number;
  raised_amount?: number;
}

export interface Donation {
  id: string;
  user_id: string;
  need_id: string;
  amount: number;
  created_at: string;
}

export interface Notification {
  id: string;
  user_id: string;
  title: string;
  message: string;
  type: string;
  task_id?: string;
  read: boolean;
  created_at: string;
}

export interface Job {
  id: string;
  title: string;
  description: string;
  skills_required: string[];
  location: string;
  ngo_id: string;
  created_at: string;
  is_deleted?: boolean;
  deleted_at?: string;
  auto_delete_at?: string;
}

export interface TaskProof {
  id: string;
  task_id: string;
  volunteer_id: string;
  image_url: string;
  latitude: number;
  longitude: number;
  distance: number;
  verification_status: 'Pending' | 'Verified' | 'Suspicious' | 'Rejected';
  created_at: string;
}

export interface Review {
  id: string;
  task_id: string;
  user_id: string;
  rating: number;
  comment: string;
  created_at: string;
}
