export type AuthStackParamList = {
  Login: undefined;
  Register: undefined;
};

export type MainTabParamList = {
  Home: undefined;
  Departments: undefined;
  AddPost: undefined;
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
  AktsCalculator: undefined;
  Schedule: undefined;
};
