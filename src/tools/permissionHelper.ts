import { Linking } from 'react-native';

// Function to navigate to device settings screen
export const redirectSetting = () => {
  Linking.openSettings();
};
