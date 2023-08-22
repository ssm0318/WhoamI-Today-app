import React, { useCallback, useState } from 'react';
import {
  Alert,
  Image,
  SafeAreaView,
  StyleSheet,
  TouchableWithoutFeedback,
  useWindowDimensions,
} from 'react-native';
import { NativeStackScreenProps } from '@react-navigation/native-stack';
import { ScreenRouteParamList } from '@screens';
import { useNavigation } from '@hooks';
import { MomentType } from '@types';
import { momentApis } from '@apis';
import * as S from './MomentPreviewScreen.styled';
import { SvgIcon } from '@components';
import { useTranslation } from 'react-i18next';
import { KeyboardAwareScrollView } from 'react-native-keyboard-aware-scroll-view';
import EmojiSelector from 'react-native-emoji-selector';
import RNFS from 'react-native-fs';

const MomentPreviewScreen: React.FC<MomentPreviewScreenProps> = ({ route }) => {
  const { todayMoment, draft: initialDraft, photoPreviewUrl } = route.params;
  const navigation = useNavigation();
  const [t] = useTranslation('translation', { keyPrefix: 'moment' });
  const { width } = useWindowDimensions();
  const [isEmojiSelectorVisible, setIsEmojiSelectorVisible] = useState(false);
  const DEFAULT_MARGIN = 25;
  const PHOTO_SIZE = width - 2 * DEFAULT_MARGIN;
  const [draft, setDraft] = useState<MomentType.TodayMoment>(initialDraft);

  const isMoodInputEditable = !todayMoment.mood;
  const isDescriptionInputEditalbe = !todayMoment.description;

  const handleSelectedEmoji = (emoji: string) => {
    setDraft({
      ...draft,
      mood: (draft.mood || '') + emoji,
    });
  };

  const handleDeleteEmoji = () => {
    const updatedEmoji = (draft.mood || '').slice(0, -1);
    setDraft({
      ...draft,
      mood: updatedEmoji,
    });
  };

  const handleChangeDescription = (text: string) => {
    setDraft({
      ...draft,
      description: text,
    });
  };

  const handlePostMoment = useCallback(async () => {
    const base64 = await RNFS.readFile(photoPreviewUrl, 'base64');

    const updatedData: MomentType.TodayMoment = {
      ...draft,
      photo: photoPreviewUrl,
    };
    // 이미 todayMoment에 존재하는 데이터는 key 값을 삭제 후 업로드
    Object.keys(todayMoment).forEach((key) => {
      if (todayMoment[key as keyof MomentType.TodayMoment] !== null) {
        delete updatedData[key as keyof MomentType.TodayMoment];
      }
    });

    try {
      // 모먼트 업로드
      if (!updatedData.mood && !updatedData.description) {
        await momentApis.postTodayMoment(updatedData);
      } else {
        await momentApis.updateTodayMoment(updatedData);
      }

      // TODO 모달 디자인 픽스 후 적용 필요
      Alert.alert('모먼트 업로드 성공');
    } catch (err) {
      console.error(err);
      Alert.alert('에러 발생');
    } finally {
      navigation.navigate('AppScreen', {
        url: '/home',
      });
    }
  }, [photoPreviewUrl]);

  const handleClose = () => {
    navigation.navigate('MomentPhotoUploadScreen', {
      todayMoment,
      draft,
    });
  };

  const toggleEmojiSelector = () => {
    if (!isMoodInputEditable) return;
    setIsEmojiSelectorVisible((prev) => !prev);
  };

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
        contentContainerStyle={{
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
            <S.PostButton onPress={handlePostMoment} bgColor={'#303030'}>
              <S.PostText textColor={'#FFFFFF'}>{t('post')}</S.PostText>
            </S.PostButton>
          </S.TopContainer>
          <S.ContentWrapper>
            {/* mood */}
            <TouchableWithoutFeedback onPress={toggleEmojiSelector}>
              <S.MoodInputWrapper>
                <SvgIcon name={'moment_mood'} size={20} />
                <S.MoodInput
                  multiline
                  value={draft.mood || ''}
                  placeholder={t('mood_placeholder') || ''}
                  editable={false}
                />
                {draft.mood && (
                  <S.EmojiDeleteIcon onPress={handleDeleteEmoji}>
                    <SvgIcon name={'delete_button'} size={20} />
                  </S.EmojiDeleteIcon>
                )}
              </S.MoodInputWrapper>
            </TouchableWithoutFeedback>
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
                value={draft.description || ''}
                multiline
                editable={isDescriptionInputEditalbe}
                onChangeText={handleChangeDescription}
              />
            </S.DescriptionInputWrapper>
          </S.ContentWrapper>
        </S.ScreenContainer>
      </KeyboardAwareScrollView>
      {isEmojiSelectorVisible && (
        <EmojiSelector
          onEmojiSelected={handleSelectedEmoji}
          showSearchBar={false}
          columns={8}
        />
      )}
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
