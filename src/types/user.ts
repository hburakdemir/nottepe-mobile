export interface User {
  id: number;
  full_name: string;
  username: string;
  email: string;
  phone?: string | null;
  role: string;
  is_public: boolean;
  faculty?: string | null;
  department?: string | null;
  bio?: string | null;
  profile_section_visibility?: unknown;
  kvkkConsentAt?: string | null;
}
