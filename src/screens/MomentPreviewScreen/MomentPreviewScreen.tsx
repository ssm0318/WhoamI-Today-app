import React, { useCallback, useLayoutEffect } from 'react';
import {
  Image,
  SafeAreaView,
  StatusBar,
  StyleSheet,
  useWindowDimensions,
} from 'react-native';
import { WebView } from 'react-native-webview';
import { APP_CONSTS, WEBVIEW_CONSTS } from '@constants';
import { NativeStackScreenProps } from '@react-navigation/native-stack';
import { ScreenRouteParamList } from '@screens';
import {
  useAppStateEffect,
  useNavigation,
  usePushNotification,
  useWebView,
} from '@hooks';
import { FirebaseNotification, LocalNotification } from '@libs';
import { MomentType } from '@types';
import { momentApis } from '@apis';
import * as S from './MomentPreviewScreen.styled';
import { SvgIcon } from '@components';
import { useTranslation } from 'react-i18next';
import { KeyboardAwareScrollView } from 'react-native-keyboard-aware-scroll-view';

const MomentPreviewScreen: React.FC<MomentPreviewScreenProps> = ({ route }) => {
  const { todayMoment, draft, photoPreviewUrl } = route.params;
  const navigation = useNavigation();
  const [t] = useTranslation('translation', { keyPrefix: 'moment' });
  const { width } = useWindowDimensions();

  const DEFAULT_MARGIN = 25;
  const PHOTO_SIZE = width - 2 * DEFAULT_MARGIN;

  const handlePostMoment = useCallback(async () => {
    try {
      // 사진 업로드
      await momentApis.updateTodayMoment({
        photo: photoPreviewUrl,
      });
    } catch (err) {
      console.error(err);
    } finally {
      navigation.navigate('AppScreen', {
        url: '/moment-upload',
      });
    }
  }, [photoPreviewUrl]);

  const handleClose = () => {
    navigation.navigate('MomentPhotoUploadScreen', {
      todayMoment,
      draft,
    });
  };

  const isPostable = true;

  return (
    <SafeAreaView
      style={{
        backgroundColor: '#FFFFFF',
        flex: 1,
      }}
    >
      <KeyboardAwareScrollView
        style={{
          flex: 1,
        }}
      >
        <S.ScreenContainer>
          <S.TopContainer>
            <S.CloseButton onPress={handleClose}>
              <SvgIcon name={'navigation_close_black'} size={20} />
            </S.CloseButton>
            <S.ScreenTitle>{t('todays_moment')}</S.ScreenTitle>
            {/* Post 버튼 */}
            <S.PostButton
              onPress={handlePostMoment}
              bgColor={isPostable ? '#303030' : '#D9D9D9'}
            >
              <S.PostText textColor={isPostable ? '#FFFFFF' : '#A0A0A0'}>
                {t('post')}
              </S.PostText>
            </S.PostButton>
          </S.TopContainer>
          <S.ContentWrapper>
            {/* mood */}
            {/* react native emoji 적용 필요 */}
            <S.MoodInputWrapper>
              <SvgIcon name={'moment_mood'} size={20} />
              <S.MoodInput
                multiline
                placeholder={t('mood_placeholder') || ''}
              />
            </S.MoodInputWrapper>

            {/* photo */}
            <S.PhotoWrapper>
              <Image
                source={{ uri: photoPreviewUrl }}
                style={{
                  width: PHOTO_SIZE,
                  height: PHOTO_SIZE,
                }}
                resizeMode="cover"
              />
            </S.PhotoWrapper>

            {/* description */}
            <S.DescriptionInputWrapper>
              <SvgIcon name={'moment_description'} size={20} />
              <S.DescriptionInput
                placeholder={t('description_placeholder') || ''}
                multiline
              />
            </S.DescriptionInputWrapper>
          </S.ContentWrapper>
        </S.ScreenContainer>
      </KeyboardAwareScrollView>
    </SafeAreaView>
  );
};

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#FFFFFF',
  },
});

type MomentPreviewScreenProps = NativeStackScreenProps<
  ScreenRouteParamList,
  'MomentPreviewScreen'
>;

export type MomentPreviewScreenRoute = {
  MomentPreviewScreen: {
    todayMoment: MomentType.TodayMoment;
    draft: MomentType.TodayMoment;
    photoPreviewUrl: string;
  };
};

export default MomentPreviewScreen;
