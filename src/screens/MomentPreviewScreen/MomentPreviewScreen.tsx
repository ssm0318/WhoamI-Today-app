import React, { useCallback, useMemo, useRef, useState } from 'react';
import {
  Image,
  SafeAreaView,
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
import {
  BottomSheetModal,
  BottomSheetModalProvider,
} from '@gorhom/bottom-sheet';

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

  const completeBottomSheetModalRef = useRef<BottomSheetModal>(null);
  const snapPoints = useMemo(() => ['30%'], []);

  const handleSelectedEmoji = (emoji: string) => {
    setDraft({
      ...draft,
      mood: (draft.mood || '') + emoji,
    });
  };

  const handleDeleteEmoji = () => {
    if (!draft.mood) return;
    const updatedEmoji =
      draft.mood.length === 2 ? '' : (draft.mood || '').slice(0, -2);
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
    const updatedData: MomentType.TodayMoment = {
      ...draft,
      photo: photoPreviewUrl,
    };

    Object.keys(todayMoment).forEach((key) => {
      if (todayMoment[key as keyof MomentType.TodayMoment] !== null) {
        delete updatedData[key as keyof MomentType.TodayMoment];
      }
    });

    try {
      // 모먼트 업로드
      // 기존 todayMoment에 데이터가 없으면 post, 있으면 put
      if (!todayMoment.mood && !todayMoment.description) {
        await momentApis.postTodayMoment(updatedData);
      } else {
        await momentApis.updateTodayMoment(updatedData);
      }

      completeBottomSheetModalRef.current?.present();
    } catch (err) {
      console.error(err);
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

  const handlePressViewFriendsFeed = () => {
    navigation.push('AppScreen', {
      url: '/friends',
    });
  };

  const handleOnCloseCompleteModal = () => {
    navigation.push('AppScreen', {
      url: '/home',
    });
  };

  return (
    <BottomSheetModalProvider>
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
          keyboardShouldPersistTaps="handled"
          onTouchEnd={() => {
            if (isEmojiSelectorVisible) setIsEmojiSelectorVisible(false);
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
                    editable={isMoodInputEditable}
                    pointerEvents="none"
                  />
                  {isMoodInputEditable && draft.mood && (
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
            columns={8}
            showSectionTitles={false}
            showTabs={false}
          />
        )}
        <BottomSheetModal
          ref={completeBottomSheetModalRef}
          snapPoints={snapPoints}
          enableDismissOnClose
          onDismiss={handleOnCloseCompleteModal}
        >
          <S.CompleteModalContent>
            <S.CompleteText>🎉</S.CompleteText>
            <S.CompleteText>{t('post_complete')}</S.CompleteText>
            <S.ViewFriendsFeedButton onPress={handlePressViewFriendsFeed}>
              <S.ViewFriendsFeedText>
                {t('view_friends_moment')}
              </S.ViewFriendsFeedText>
            </S.ViewFriendsFeedButton>
          </S.CompleteModalContent>
        </BottomSheetModal>
      </SafeAreaView>
    </BottomSheetModalProvider>
  );
};

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
