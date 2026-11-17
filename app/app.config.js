// Native map keys are build-time settings, not server credentials. Restrict the key
// to your Android package/signing certificate in Google Cloud before release.
module.exports = ({ config }) => {
  const mapsKey = process.env.GOOGLE_MAPS_ANDROID_API_KEY?.trim();
  return {
    ...config,
    extra: { ...config.extra, mapsAndroidConfigured: !!mapsKey },
    plugins: [
      ...(config.plugins ?? []),
      ["react-native-maps", mapsKey ? { androidGoogleMapsApiKey: mapsKey } : {}],
    ],
    android: {
      ...config.android,
      ...(mapsKey
        ? { config: { ...config.android?.config, googleMaps: { apiKey: mapsKey } } }
        : {}),
    },
  };
};
