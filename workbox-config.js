module.exports = {
  globDirectory: 'dist/',
  globPatterns: [
    '**/*.{js,css,html,ico,png,svg,woff,woff2,ttf}'
  ],
  swDest: 'dist/service-worker.js',
  swSrc: 'public/service-worker.js',
  // Don't allow workbox to modify your service worker file
  // We're using our custom one
  injectManifest: {
    swSrc: 'public/service-worker.js',
    swDest: 'dist/service-worker.js',
    globDirectory: 'dist/',
    globPatterns: [
      '**/*.{js,css,html,ico,png,svg,woff,woff2,ttf}'
    ],
  },
  clientsClaim: true,
  skipWaiting: true
};