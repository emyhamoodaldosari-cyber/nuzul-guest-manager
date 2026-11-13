module.exports = function (api) {
  api.cache(true);
  // babel-preset-expo 58 transforms import.meta and adds the worklets plugin on its own.
  return {
    presets: ['babel-preset-expo'],
  };
};
