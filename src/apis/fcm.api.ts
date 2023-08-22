import ApiService from './API';

const { API } = ApiService;

type RegisterFCMTokenRequest = {
  type: 'android' | 'ios';
  registration_id: string;
  active: boolean;
};

export const registerFCMToken = (params: RegisterFCMTokenRequest) =>
  API.post('/devices/', params);
