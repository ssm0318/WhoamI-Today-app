module.exports = {
  presets: ['module:metro-react-native-babel-preset'],
  plugins: [
    'react-native-reanimated/plugin',
    [
      'babel-plugin-inline-import',
      {
        extensions: ['.svg'],
      },
    ],
    ['babel-plugin-styled-components'],
    ['@babel/plugin-proposal-export-namespace-from'],
    [
      'module-resolver',
      {
        root: ['./'],
        extensions: [
          '.ios.ts',
          '.android.ts',
          '.ts',
          '.ios.tsx',
          '.android.tsx',
          '.tsx',
          '.jsx',
          '.js',
          '.json',
        ],
        alias: {
          '@config': './src/config',
          '@constants': './src/constants',
          '@hooks': './src/hooks',
          '@observables': './src/observables',
          '@types': './src/types',
          '@utils': './src/utils',
          '@apis': './src/apis',
          '@components': './src/components',
          '@libs': './src/libs',
          '@screens': './src/screens',
          '@routes': './src/routes',
          '@navigation': './src/navigation',
          '@contexts': './src/contexts',
          '@design-system': './design-system',
          '@recoil': './src/recoil',
          '@storage': './src/storage',
          '@react-query': './src/react-query',
          '@tools': './src/tools',
        },
      },
    ],
  ],
};
