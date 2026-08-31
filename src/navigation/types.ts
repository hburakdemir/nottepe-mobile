export type AuthStackParamList = {
  Login: undefined;
  Register: undefined;
};

export type MainTabParamList = {
  Home: undefined;
  Departments: undefined;
  AddPost: undefined;
  Notifications: undefined;
  Profile: undefined;
};

export type RootStackParamList = {
  MainTabs: undefined;
  PostDetail: { postId: number };
  DepartmentDetail: { faculty: string; department: string };
};
