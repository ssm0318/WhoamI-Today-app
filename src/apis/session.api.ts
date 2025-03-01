import { SessionStorage } from '@tools';
import ApiService from './API';
const { API } = ApiService;

export const startSession = async () => {
  const response = await API.post<{ session_id: string }>(
    `/user/app-sessions/start/`,
  );
  await SessionStorage.setSessionId(response.session_id);
  return response;
};

export const sendTouch = async () => {
  const sessionId = await SessionStorage.getSessionId();
  await API.patch(`/user/app-sessions/touch/`, { session_id: sessionId });
};

export const endSession = async () => {
  const sessionId = await SessionStorage.getSessionId();
  await API.patch(`/user/app-sessions/end/`, { session_id: sessionId });
  await SessionStorage.removeSessionId();
};
