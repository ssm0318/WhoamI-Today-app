import { UserType } from '@types';
import ApiService from './API';

const { API } = ApiService;

export const getMe = async () => {
  const res = await API.get<UserType.MyProfile>('/user/me/');
  return res;
};
