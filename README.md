# WhoAmIToday App

## Introduction

Welcome to the repository for the WhoAmIToday App, a dedicated platform for delivering the WhoAmIToday service.

## Tech Stack

This project is crafted with:

- React Native
- TypeScript
- React Navigation
- Styled Components
- React Native Firebase
- ESLint & Prettier
- Husky & lint-staged

## Getting Started

### Prerequisites

Ensure you have the following installed:

- Node: v16.14.0 or later
- Yarn: 1.22.19 or later

### Setup Instructions

#### For iOS

```bash
brew install node
brew install watchman
brew install cocoapods
```

```bash
brew install rbenv
rbenv install 2.7.6
rbenv global 2.7.6
rbenv rehash
gem install bundler
```

#### For Android

```
(nothing special)
```

### Installing

#### iOS

```bash
yarn install
cd ios
pod install
```

#### Android

```bash
yarn install
cd android
./gradlew clean
```

### Running the App

#### For Both iOS and Android

```bash
yarn start --reset-cache
```

## Additional Technical Implements

- Integrates Firebase Cloud Messaging for notifications (utilizing notifee and react-native-firebase/messaging).
- Employs React Native Webview for delivering the WhoAmI Today service through this React Native-based application.

## Contact

For inquiries or assistance, please reach out to us:

- Email: team.whoami.today@gmail.com
