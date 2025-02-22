import AsyncStorage from '@react-native-async-storage/async-storage';

const SESSION_ID_KEY = '@session_id';

export const SessionStorage = {
  setSessionId: async (sessionId: string) => {
    try {
      await AsyncStorage.setItem(SESSION_ID_KEY, sessionId);
    } catch (error) {
      console.error('Error saving session ID:', error);
    }
  },

  getSessionId: async (): Promise<string | null> => {
    try {
      return await AsyncStorage.getItem(SESSION_ID_KEY);
    } catch (error) {
      console.error('Error getting session ID:', error);
      return null;
    }
  },

  removeSessionId: async () => {
    try {
      await AsyncStorage.removeItem(SESSION_ID_KEY);
    } catch (error) {
      console.error('Error removing session ID:', error);
    }
  },
};
