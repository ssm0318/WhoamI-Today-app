import { Notification } from '@notifee/react-native';
import ApiService from './API';

const { API } = ApiService;

export const readNotification = async (notificationIds: number[]) => {
  await API.patch<Notification[]>(`/notifications/read/`, {
    notificationIds,
  });
};
