import React, { useEffect, useRef, useState } from 'react';
import { ActivityIndicator, Pressable, StyleSheet, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import Video from 'react-native-video';
import { NativeStackScreenProps } from '@react-navigation/native-stack';
import { ScreenRouteParamList } from '@screens';
import { trackEvent } from '../../utils/analytics';

type Props = NativeStackScreenProps<ScreenRouteParamList, 'VideoScreen'>;

const VideoScreen = ({ route, navigation }: Props) => {
  const { url, postId, postType } = route.params;
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(false);
  const insets = useSafeAreaInsets();

  const startedAtRef = useRef<number>(Date.now());
  const completedRef = useRef(false);

  useEffect(() => {
    if (postId === undefined || postType === undefined) return;
    trackEvent('video_open', { post_id: postId, post_type: postType });

    return () => {
      trackEvent('video_close', {
        post_id: postId,
        post_type: postType,
        duration_ms: Date.now() - startedAtRef.current,
        completed: completedRef.current ? 1 : 0,
      });
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const handleClose = () => navigation.goBack();

  const handleEnd = () => {
    completedRef.current = true;
    if (postId !== undefined && postType !== undefined) {
      trackEvent('video_play_complete', {
        post_id: postId,
        post_type: postType,
        duration_ms: Date.now() - startedAtRef.current,
      });
    }
    handleClose();
  };

  const handleError = () => {
    setLoading(false);
    setError(true);
    if (postId !== undefined && postType !== undefined) {
      trackEvent('video_error', { post_id: postId, post_type: postType });
    }
  };

  const videoAreaStyle = {
    top: insets.top,
    bottom: insets.bottom,
    left: 0,
    right: 0,
  };

  return (
    <View style={styles.root}>
      <Video
        source={{ uri: url }}
        style={[styles.video, videoAreaStyle]}
        controls
        resizeMode="contain"
        paused={false}
        ignoreSilentSwitch="ignore"
        onLoad={() => setLoading(false)}
        onError={handleError}
        onEnd={handleEnd}
      />
      {loading && !error && (
        <View style={[styles.center, videoAreaStyle]} pointerEvents="none">
          <ActivityIndicator size="large" color="#fff" />
        </View>
      )}
      <View
        style={[styles.closeContainer, { top: insets.top }]}
        pointerEvents="box-none"
      >
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
      </View>
    </View>
  );
};

const styles = StyleSheet.create({
  root: {
    flex: 1,
    backgroundColor: '#000',
  },
  video: {
    position: 'absolute',
  },
  center: {
    position: 'absolute',
    alignItems: 'center',
    justifyContent: 'center',
  },
  closeContainer: {
    position: 'absolute',
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

export type VideoPostType =
  | 'check_in_post'
  | 'check_in_post_story'
  | 'note'
  | 'response';

export type VideoScreenRoute = {
  VideoScreen: {
    url: string;
    postId?: number | string;
    postType?: VideoPostType;
  };
};

export default VideoScreen;
