const { getDefaultConfig } = require('expo/metro-config');

const config = getDefaultConfig(__dirname);

// Web-specific configuration to avoid Jimp issues
if (process.env.EXPO_PLATFORM === 'web') {
  // Exclude problematic packages on web
  config.resolver.platforms = ['web', 'native', 'ios', 'android'];
  
  // Add web-specific resolver configuration
  config.resolver.alias = {
    ...config.resolver.alias,
    // Provide web-compatible alternatives for native-only packages
    'jimp-compact': false,
    '@expo/image-utils': false,
  };

  // Exclude native-only modules from web bundle
  config.resolver.blockList = [
    ...config.resolver.blockList || [],
    /node_modules\/jimp-compact\/.*/,
    /node_modules\/@expo\/image-utils\/.*/,
  ];
}

module.exports = config;
