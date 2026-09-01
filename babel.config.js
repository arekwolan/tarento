module.exports = function (api) {
  api.cache(true);

  return {
    presets: [
      ['babel-preset-expo', { jsxImportSource: 'nativewind' }],
      'nativewind/babel',
    ],
    env: {
      production: {
        // W buildzie produkcyjnym wycinamy wszystkie console.* poza błędami.
        // Nie chodzi o hałas, tylko o to, żeby przypadkowy log z danymi
        // użytkownika nie wylądował w logcat ani w konsoli urządzenia.
        plugins: [['transform-remove-console', { exclude: ['error'] }]],
      },
    },
  };
};
