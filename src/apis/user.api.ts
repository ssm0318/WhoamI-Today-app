import ApiService from './API';

const { API } = ApiService;

// sign in
export interface SignInParams {
  username: string;
  password: string;
}

export interface SignInResponse {
  access_token: string;
  refresh: string;
}

const signIn = ({ signInInfo }: { signInInfo: SignInParams }) =>
  API.post<SignInResponse>('/user/login/', signInInfo);

export const userApi = {
  signIn,
};
