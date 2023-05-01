import { Platform } from 'react-native';

const IS_IOS = Platform.OS === 'ios';
const IS_ANDROID = Platform.OS === 'android';

export { IS_ANDROID, IS_IOS };
