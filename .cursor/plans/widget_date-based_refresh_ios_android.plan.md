---
name: Widget date-based refresh (iOS + Android)
overview: iOS·Android 위젯 모두 날짜가 바뀔 때(자정) 데이터를 새로고침하도록 합니다. iOS는 Timeline policy를 "다음 날 자정"으로, Android는 AlarmManager로 자정 알람을 걸어 위젯 갱신을 트리거합니다.
todos:
  - id: ios-timeline-midnight
    content: iOS WhoAmITodayWidgetExtension - getTimeline에서 nextUpdate를 다음 날 자정으로 설정
  - id: android-alarm-receiver
    content: Android - 자정 알람 수신 BroadcastReceiver 추가 및 AndroidManifest 등록
  - id: android-schedule-midnight
    content: Android - 위젯 onEnabled/onUpdate 시 다음 자정 AlarmManager 스케줄, 알람 시 위젯 갱신 후 다음 자정 재스케줄
isProject: false
---

# 위젯 날짜 변경 시 데이터 새로고침 (iOS + Android)

## 결론: 가능합니다 (양쪽 모두 반영)

- **iOS**: WidgetKit `Timeline`의 `policy`를 **다음 날 자정**으로 설정하면, 그 시점에 `getTimeline`이 다시 호출되어 API에서 새 데이터를 가져옵니다.
- **Android**: `updatePeriodMillis`만으로는 정확한 자정 갱신이 불가하므로, **AlarmManager**로 "다음 날 자정"에 알람을 걸고, 알람 수신 시 위젯 갱신(기존 `WidgetUpdateService`) 후 다음 자정 알람을 다시 스케줄합니다.

---

## iOS

### 현재 동작

- **WhoAmITodayWidgetExtension** ([ios/WhoAmITodayWidgetExtension/WhoAmITodayWidget.swift](ios/WhoAmITodayWidgetExtension/WhoAmITodayWidget.swift)): `nextUpdate`를 **1초 후**로 설정.
- **WhoAmITodayWidget** (다른 타깃): 30분마다 갱신.

### 구현 방향 (iOS)

- `getTimeline` 완료 시 **다음 날 자정** 계산 후 `policy: .after(startOfNextDay)` 사용.
- `Calendar.current` → 사용자 로컬 타임존 기준 자정.

```swift
let cal = Calendar.current
let now = Date()
let startOfToday = cal.startOfDay(for: now)
let startOfNextDay = cal.date(byAdding: .day, value: 1, to: startOfToday)!
let timeline = Timeline(entries: [entry], policy: .after(startOfNextDay))
```

### 수정할 파일 (iOS)

- [ios/WhoAmITodayWidgetExtension/WhoAmITodayWidget.swift](ios/WhoAmITodayWidgetExtension/WhoAmITodayWidget.swift): `nextUpdate` 계산을 "다음 날 자정"으로 변경.
- (선택) [ios/WhoAmITodayWidget/WhoAmITodayWidget.swift](ios/WhoAmITodayWidget/WhoAmITodayWidget.swift): 동일 자정 로직 적용 가능.

### 참고 (iOS)

- WidgetKit은 정확한 시각을 보장하지 않음. 앱의 `WidgetCenter.shared.reloadTimelines` / `refreshWidgets` 호출은 그대로 두면 사용자 행동 후 즉시 갱신 가능.

---

## Android

### 현재 동작

- [android/app/src/main/res/xml/widget_info_large.xml](android/app/src/main/res/xml/widget_info_large.xml): `updatePeriodMillis="1800000"` (30분).
- [WhoAmIWidgetProvider](android/app/src/main/java/com/whoami/today/app/widget/WhoAmIWidgetProvider.java): `onUpdate` 시 `WidgetUpdateService`로 API fetch 후 UI 갱신. **자정 고정 갱신은 없음.**

### 구현 방향 (Android)

1. **AlarmManager**로 "다음 날 00:00" (로컬 타임존)에 알람 등록. `Calendar`로 다음 자정 `timeInMillis` 계산 후 `AlarmManager.set()` 또는 `setAndAllowWhileIdle()` 사용.
2. **BroadcastReceiver** 신규(예: `WidgetMidnightReceiver`): 알람 액션 수신 시 위젯 갱신 트리거(기존 `WidgetUpdateService` 또는 `APPWIDGET_UPDATE`) 후 **다음 자정** 알람 재스케줄.
3. **스케줄 시점**: `WhoAmIWidgetProvider.onEnabled()`, `onUpdate()`에서 "다음 자정 알람" 등록.
4. **updatePeriodMillis**: 30분 유지(자정 + 주기) 또는 24시간으로 늘리고 자정 + 앱 수동 갱신만 사용.

### 수정/추가할 파일 (Android)

- **신규** `WidgetMidnightReceiver.java`: 알람 수신 → 위젯 갱신 → 다음 자정 알람 재등록.
- **신규** `WidgetMidnightScheduler.java` (또는 Provider 내 static): 다음 자정 계산 및 AlarmManager 스케줄.
- [android/app/src/main/AndroidManifest.xml](android/app/src/main/AndroidManifest.xml): `WidgetMidnightReceiver` 등록.
- [WhoAmIWidgetProvider.java](android/app/src/main/java/com/whoami/today/app/widget/WhoAmIWidgetProvider.java): `onEnabled`/`onUpdate`에서 `WidgetMidnightScheduler.scheduleNextMidnight(context)` 호출.

### 참고 (Android)

- Android 12+ 정확 알람 제한. `setAndAllowWhileIdle` / `setExactAndAllowWhileIdle` 사용 시 완화 가능. 기존 앱/수동 갱신은 유지.

---

## 요약

| 플랫폼 | 방법 | 수정 포인트 |
|--------|------|-------------|
| iOS | Timeline policy | `getTimeline`에서 `policy: .after(다음_날_자정)` |
| Android | AlarmManager + BroadcastReceiver | 자정 알람 스케줄 → 수신 시 위젯 갱신 + 다음 자정 재스케줄 |
