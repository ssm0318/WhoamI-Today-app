import React, { useCallback, useState } from 'react';
import {
  ActivityIndicator,
  Pressable,
  StatusBar,
  StyleSheet,
  View,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import Video from 'react-native-video';
import { useFocusEffect } from '@react-navigation/native';
import { NativeStackScreenProps } from '@react-navigation/native-stack';
import { ScreenRouteParamList } from '@screens';

type Props = NativeStackScreenProps<ScreenRouteParamList, 'VideoScreen'>;

const VideoScreen = ({ route, navigation }: Props) => {
  const { url } = route.params;
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(false);

  useFocusEffect(
    useCallback(() => {
      StatusBar.setHidden(true, 'fade');
      return () => StatusBar.setHidden(false, 'fade');
    }, []),
  );

  const handleClose = () => navigation.goBack();

  return (
    <View style={styles.root}>
      <Video
        source={{ uri: url }}
        style={StyleSheet.absoluteFill}
        controls
        resizeMode="contain"
        paused={false}
        ignoreSilentSwitch="ignore"
        onLoad={() => setLoading(false)}
        onError={() => {
          setLoading(false);
          setError(true);
        }}
        onEnd={handleClose}
      />
      {loading && !error && (
        <View style={styles.center} pointerEvents="none">
          <ActivityIndicator size="large" color="#fff" />
        </View>
      )}
      <SafeAreaView style={styles.safeArea} pointerEvents="box-none">
        <Pressable
          onPress={handleClose}
          hitSlop={12}
          style={({ pressed }) => [
            styles.closeBtn,
            pressed && { opacity: 0.6 },
          ]}
        >
          <View style={styles.closeIconBar1} />
          <View style={styles.closeIconBar2} />
        </Pressable>
      </SafeAreaView>
    </View>
  );
};

const styles = StyleSheet.create({
  root: {
    flex: 1,
    backgroundColor: '#000',
  },
  center: {
    ...StyleSheet.absoluteFillObject,
    alignItems: 'center',
    justifyContent: 'center',
  },
  safeArea: {
    position: 'absolute',
    top: 0,
    left: 0,
    right: 0,
  },
  closeBtn: {
    width: 36,
    height: 36,
    margin: 12,
    borderRadius: 18,
    backgroundColor: 'rgba(0,0,0,0.4)',
    alignItems: 'center',
    justifyContent: 'center',
  },
  closeIconBar1: {
    position: 'absolute',
    width: 18,
    height: 2,
    backgroundColor: '#fff',
    transform: [{ rotate: '45deg' }],
  },
  closeIconBar2: {
    position: 'absolute',
    width: 18,
    height: 2,
    backgroundColor: '#fff',
    transform: [{ rotate: '-45deg' }],
  },
});

export type VideoScreenRoute = {
  VideoScreen: {
    url: string;
  };
};

export default VideoScreen;
