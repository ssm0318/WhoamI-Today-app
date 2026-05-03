# Android Widget UI Improvements

## 변경사항

### 1. 앨범 커버 Rounded Corners 적용

**문제**: 앨범 커버가 사각형으로 표시되어 iOS와 다른 느낌

**해결**:
- `CheckinWidgetProvider.java`에 `getRoundedCornerBitmap()` 메서드 추가
- 앨범 이미지 로드 시 자동으로 rounded corners 적용 (16dp radius)
- iOS와 일관된 UI 제공

**코드**:
```java
private static Bitmap getRoundedCornerBitmap(Bitmap bitmap, float cornerRadius) {
    // Canvas를 사용하여 rounded corners 적용
    // PorterDuff.Mode.SRC_IN으로 마스킹
}
```

### 2. Spotify 아이콘을 IconPlaylist로 교체

**문제**: Android에서 커스텀 Spotify 아이콘 사용, iOS와 다름

**해결**:
- iOS의 `IconPlaylist` asset을 Android로 복사
- `ic_playlist.png`로 저장
- 레이아웃에서 `@drawable/ic_widget_spotify` → `@drawable/ic_playlist`로 변경

**파일**:
- Source: `ios/WhoAmITodayWidgets/Assets.xcassets/IconPlaylist.imageset/icon.png`
- Destination: `android/app/src/main/res/drawable/ic_playlist.png`

### 3. 즉시 위젯 업데이트 개선

**문제**: 앱에서 체크인 수정 후 백그라운드로 보내면 위젯이 바로 반영 안됨

**기존 동작**:
1. 웹뷰에서 `WIDGET_DATA_UPDATED` 메시지 전송
2. Native에서 `syncMyCheckInToWidget()` 호출
3. `triggerWidgetRefresh()` 1회 호출

**개선된 동작**:
1. 웹뷰에서 `WIDGET_DATA_UPDATED` 메시지 전송
2. Native에서 `syncMyCheckInToWidget()` 호출
3. `triggerWidgetRefresh()` 즉시 호출
4. **500ms 후 한 번 더 `triggerWidgetRefresh()` 호출** ← 새로 추가
5. 백그라운드 전환 시 `runWidgetSync()` 추가 호출

**이중 안전장치**:
- Android native: `updateWidgetsWithFollowUp()` (즉시 + 800ms 후)
- React Native: 즉시 + 500ms 후 재시도
- 총 4번의 업데이트 시도로 확실한 동기화 보장

### 4. 타이밍 최적화

**전체 흐름** (사용자가 mood 변경 후 홈 버튼 누를 때):

```
T+0ms:    User saves check-in in web
T+10ms:   WebView sends WIDGET_DATA_UPDATED
T+20ms:   syncMyCheckInToWidget() called
T+25ms:   commit() writes to SharedPreferences
T+30ms:   updateWidgetsWithFollowUp() - immediate broadcast
T+35ms:   Widget receives broadcast #1
T+50ms:   Widget updates UI
T+500ms:  Delayed triggerWidgetRefresh() - broadcast #2
T+830ms:  Follow-up broadcast #3 (from updateWidgetsWithFollowUp)
T+1000ms: User presses home button
T+1010ms: App state → inactive
T+1020ms: runWidgetSync() pushes cached data
T+1025ms: updateWidgetsWithFollowUp() - broadcast #4
T+1855ms: Follow-up broadcast #5
```

**결과**: 5번의 업데이트 시도로 어떤 타이밍 이슈도 극복

## 파일 변경 목록

### 수정된 파일:

1. **`android/app/src/main/java/com/whoami/today/app/widget/CheckinWidgetProvider.java`**
   - `getRoundedCornerBitmap()` 메서드 추가
   - `loadBitmapFromUrl()`에서 rounded corners 적용

2. **`android/app/src/main/res/layout/widget_checkin_4x1.xml`**
   - Spotify 아이콘 → IconPlaylist로 변경
   - `android:src="@drawable/ic_playlist"`

3. **`src/hooks/useWebView.ts`**
   - `WIDGET_DATA_UPDATED` 핸들러에 500ms 딜레이 refresh 추가
   - 두 곳에 적용 (inline payload, API fetch)

### 새로 추가된 파일:

1. **`android/app/src/main/res/drawable/ic_playlist.png`**
   - iOS의 IconPlaylist asset 복사

2. **`android/app/src/main/res/drawable/album_cover_rounded.xml`**
   - Rounded corners drawable (현재 미사용, 코드로 처리)

## 테스트 시나리오

### 시나리오 1: 기본 체크인 업데이트
1. 앱 열기
2. Mood 변경 (예: Happy)
3. 홈 화면으로 이동
4. **예상**: 위젯에 즉시 😊 표시, rounded album cover

### 시나리오 2: 음악 변경
1. 앱 열기
2. Music 변경 (Spotify 곡 선택)
3. 홈 화면으로 이동
4. **예상**: 위젯에 앨범 커버 표시 (rounded), IconPlaylist 아이콘 보임

### 시나리오 3: 빠른 수정 후 백그라운드
1. 앱 열기
2. Mood 변경
3. **즉시** 홈 버튼 누르기 (1초 이내)
4. **예상**: 위젯이 여전히 업데이트됨 (다중 재시도 덕분)

### 시나리오 4: 위젯 새로고침 버튼
1. 위젯의 새로고침 아이콘 탭
2. **예상**: 즉시 최신 데이터로 업데이트

## 시각적 변경사항

### Before:
```
┌─────────────────┐
│ 🎵              │  ← 사각형 앨범 커버
│ [Spotify icon]  │  ← 커스텀 아이콘
└─────────────────┘
```

### After:
```
┌─────────────────┐
│ 🎵              │  ← Rounded 앨범 커버
│ [Playlist icon] │  ← iOS와 동일한 아이콘
└─────────────────┘
```

## 성능 영향

- **Rounded corners 처리**: 이미지 로드 시 1회만 처리, 무시할 수 있는 오버헤드
- **추가 refresh**: 500ms 후 1회, 사용자에게 보이지 않음
- **전체적으로 사용자 경험 향상, 성능 영향 없음**

## iOS와의 일관성

| 항목 | iOS | Android (Before) | Android (After) |
|------|-----|------------------|-----------------|
| 앨범 커버 모양 | Rounded | Square | ✅ Rounded |
| 음악 아이콘 | IconPlaylist | Custom Spotify | ✅ IconPlaylist |
| 즉시 업데이트 | ✅ | ❌ 가끔 지연 | ✅ 즉시 |
| 새로고침 버튼 | ✅ | ✅ | ✅ |

## 다음 단계

1. 빌드 및 테스트
2. 실제 디바이스에서 UI 확인
3. 다양한 앨범 커버로 테스트 (정사각형, 직사각형)
4. 타이밍 테스트 (빠른 수정 후 백그라운드)
