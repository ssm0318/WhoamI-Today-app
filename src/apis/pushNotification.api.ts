import ApiService from './API';

const { API } = ApiService;

type RegisterPushTokenRequest = {
  type: 'android' | 'ios';
  registration_id: string;
  active: boolean;
  device_id: string;
};

export const registerPushToken = (params: RegisterPushTokenRequest) =>
  API.post('/devices/', params);
