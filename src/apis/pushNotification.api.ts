import ApiService from './API';

const { API } = ApiService;

type RegisterPushTokenRequest = {
  type: 'android' | 'ios';
  registration_id: string;
  active: boolean;
};

const registerPushToken = (params: RegisterPushTokenRequest) =>
  API.post('/devices/', params);

export const pushNotificationApi = {
  registerPushToken,
};
