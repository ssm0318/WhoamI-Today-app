import ApiService from './API';

const { API } = ApiService;

type RegisterPushTokenRequest = {
  type: string;
  registration_id: string;
  active: boolean;
  device_id: string;
};

export const registerPushToken = async (params: RegisterPushTokenRequest) => {
  await API.post('/devices/', params);
};
