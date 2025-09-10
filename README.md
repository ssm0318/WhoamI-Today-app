# WhoAmIToday App

## 📱 Overview

WhoAmIToday is a React Native mobile application that enables users to discover and express themselves through an innovative social platform delivered via an integrated web experience.

## 🛠 Tech Stack

- **Framework**: React Native 0.71.7
- **Language**: TypeScript
- **Navigation**: React Navigation v6
- **Styling**: Styled Components
- **Backend Integration**: React Native WebView
- **Push Notifications**: Firebase Cloud Messaging + Notifee
- **Analytics**: Firebase Analytics
- **Error Tracking**: Sentry
- **Code Quality**: ESLint, Prettier, Husky, lint-staged

## 🚀 Getting Started

### Prerequisites

Make sure you have the following tools installed:

- **Node.js**: v16.14.0 or later
- **Yarn**: 1.22.19 or later
- **React Native CLI**: Latest version
- **Xcode**: Latest version (for iOS development)
- **Android Studio**: Latest version (for Android development)

### Environment Setup

#### iOS Development

```bash
# Install Homebrew dependencies
brew install node watchman cocoapods

# Install Ruby version manager for Fastlane
brew install rbenv
rbenv install 2.7.6
rbenv global 2.7.6
rbenv rehash
gem install bundler
```

#### Android Development

Ensure you have Android Studio installed with the latest SDK and build tools.

### Installation

1. **Clone the repository**

   ```bash
   git clone <repository-url>
   cd WhoAmI-Today-app
   ```

2. **Install dependencies**

   ```bash
   yarn install
   ```

3. **iOS Setup**

   ```bash
   cd ios
   pod install
   cd ..
   ```

4. **Android Setup**

   ```bash
   cd android
   ./gradlew clean
   cd ..
   ```

5. **Firebase Configuration** (Required)
   - Add your `GoogleService-Info.plist` to the `ios/` directory
   - Add your `google-services.json` to the `android/app/` directory
   - These files are gitignored for security reasons

### Running the Application

#### Start Metro bundler

```bash
yarn start --reset-cache
```

#### Run on iOS

```bash
yarn ios
```

#### Run on Android

```bash
yarn android
```

## 📁 Project Structure

```
src/
├── apis/           # API service layer
├── components/     # Reusable UI components
├── constants/      # App constants and configuration
├── hooks/          # Custom React hooks
├── i18n/          # Internationalization
├── libs/          # Utility libraries
├── navigation/    # Navigation configuration
├── screens/       # Screen components
├── tools/         # Helper utilities
├── types/         # TypeScript type definitions
└── utils/         # Utility functions
```

## 🔧 Key Features

- **WebView Integration**: Seamless integration with the WhoAmIToday web service
- **Push Notifications**: Firebase Cloud Messaging for real-time notifications
- **Multi-language Support**: i18next integration for internationalization
- **Camera Integration**: Native camera functionality for photo capture
- **Cross-platform**: Supports both iOS and Android platforms
- **Error Tracking**: Comprehensive error monitoring with Sentry

## 🔐 Security Notes

- Firebase configuration files are excluded from version control
- Sensitive API keys and tokens are stored securely
- All authentication tokens are handled through secure storage

## 📝 Development

### Code Quality

The project uses several tools to maintain code quality:

- **ESLint**: Code linting
- **Prettier**: Code formatting
- **Husky**: Git hooks
- **lint-staged**: Run linters on staged files

### Available Scripts

- `yarn start`: Start Metro bundler with cache reset
- `yarn ios`: Run on iOS simulator
- `yarn android`: Run on Android emulator
- `yarn test`: Run tests
- `yarn lint`: Run ESLint
- `yarn typescript`: Type checking

## 🚀 Deployment

The app uses Fastlane for automated deployment to both iOS App Store and Google Play Store.

## 🤝 Contributing

1. Fork the repository
2. Create your feature branch
3. Commit your changes
4. Push to the branch
5. Create a Pull Request

## 📄 License

This project is private and proprietary.
