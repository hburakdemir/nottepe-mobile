export type AuthStackParamList = {
  Login: undefined;
  Register: undefined;
};

export type MainTabParamList = {
  HomeTab: undefined;
  Departments: undefined;
  AddPost: undefined;
  Notifications: undefined;
  Profile: undefined;
};

export type HomeStackParamList = {
  Home: undefined;
  PostDetail: { postId: number };
};
