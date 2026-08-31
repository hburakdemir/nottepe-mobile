export type AuthStackParamList = {
  Login: undefined;
  Register: undefined;
  VerifyEmail: { email: string };
  ForgotPassword: undefined;
  ResetPassword: { email: string };
};

export interface NoteRequestSummary {
  id: number;
  faculty: string;
  department: string;
  course_name: string;
}

export type MainTabParamList = {
  Home: undefined;
  Departments: undefined;
  AddPost: { noteRequest?: NoteRequestSummary } | undefined;
  Tools: undefined;
  Notifications: undefined;
  Profile: undefined;
};

export type RootStackParamList = {
  MainTabs: undefined;
  PostDetail: { postId: number };
  DepartmentDetail: { faculty: string; department: string };
  SavedPosts: undefined;
  UserProfile: { username: string };
  Checklists: { slug?: string } | undefined;
  AktsCalculator: { loadId?: number } | undefined;
  Schedule: undefined;
  NoteRequests: undefined;
};
