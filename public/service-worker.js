// Service Worker for Inventory Management System PWA
importScripts('https://storage.googleapis.com/workbox-cdn/releases/7.0.0/workbox-sw.js');

// Set workbox log level
workbox.setConfig({ debug: false });

// Custom service worker logic for handling app versioning
const APP_CACHE_VERSION = 'v1.0.0';
const CACHE_PREFIX = 'inventory-app-';
const APP_CACHE_NAME = `${CACHE_PREFIX}${APP_CACHE_VERSION}`;

// App shell files to precache
const APP_SHELL = [
  '/',
  '/index.html',
  '/offline.html',
  '/manifest.json',
  '/pwa-64x64.png',
  '/pwa-192x192.png',
  '/pwa-512x512.png',
  '/maskable-icon-512x512.png'
];

// Clean up old caches on activation
self.addEventListener('activate', (event) => {
  event.waitUntil(
    caches.keys().then((cacheNames) => {
      return Promise.all(
        cacheNames
          .filter((cacheName) => {
            return cacheName.startsWith(CACHE_PREFIX) && cacheName !== APP_CACHE_NAME;
          })
          .map((cacheName) => {
            return caches.delete(cacheName);
          })
      );
    })
  );
});

// Pre-cache app shell files
workbox.precaching.precacheAndRoute([
  { url: '/', revision: APP_CACHE_VERSION },
  { url: '/index.html', revision: APP_CACHE_VERSION },
  { url: '/offline.html', revision: APP_CACHE_VERSION },
  { url: '/manifest.json', revision: APP_CACHE_VERSION }
]);

// Cache the app shell and other static assets
workbox.routing.registerRoute(
  ({ request }) => {
    return APP_SHELL.includes(request.url) || 
           request.destination === 'script' || 
           request.destination === 'style';
  },
  new workbox.strategies.CacheFirst({
    cacheName: `${CACHE_PREFIX}static-assets`,
    plugins: [
      new workbox.expiration.ExpirationPlugin({
        maxEntries: 50,
        maxAgeSeconds: 7 * 24 * 60 * 60, // 1 week
      }),
    ],
  })
);

// Cache API calls (Firestore) with a network-first strategy
workbox.routing.registerRoute(
  ({ url }) => {
    return url.hostname.includes('firestore.googleapis.com') || 
           url.hostname.includes('firebase');
  },
  new workbox.strategies.NetworkFirst({
    cacheName: `${CACHE_PREFIX}api-cache`,
    plugins: [
      new workbox.expiration.ExpirationPlugin({
        maxEntries: 100,
        maxAgeSeconds: 24 * 60 * 60, // 1 day
      }),
    ],
  })
);

// WooCommerce API calls - network first
workbox.routing.registerRoute(
  ({ url }) => {
    return url.pathname.includes('/wp-json/wc/') || 
           url.hostname.includes('woocommerce');
  },
  new workbox.strategies.NetworkFirst({
    cacheName: `${CACHE_PREFIX}woocommerce-cache`,
    plugins: [
      new workbox.expiration.ExpirationPlugin({
        maxEntries: 50,
        maxAgeSeconds: 60 * 60, // 1 hour
      }),
    ],
  })
);

// Page navigation - network first, fallback to cache, then offline page
workbox.routing.registerRoute(
  ({ request }) => request.mode === 'navigate',
  async ({ event }) => {
    try {
      // Try to use the network
      const networkResponse = await fetch(event.request);
      return networkResponse;
    } catch (error) {
      const cache = await caches.open(APP_CACHE_NAME);
      
      // Check if the requested page is in the cache
      const cachedResponse = await cache.match(event.request);
      if (cachedResponse) {
        return cachedResponse;
      }
      
      // If not in cache, show the offline page
      return cache.match('/offline.html');
    }
  }
);

// Cache images and other static content with stale-while-revalidate
workbox.routing.registerRoute(
  ({ request }) => 
    request.destination === 'image' || 
    request.destination === 'font' ||
    request.url.includes('.svg') || 
    request.url.includes('.png'),
  new workbox.strategies.StaleWhileRevalidate({
    cacheName: `${CACHE_PREFIX}images-fonts`,
    plugins: [
      new workbox.expiration.ExpirationPlugin({
        maxEntries: 60,
        maxAgeSeconds: 30 * 24 * 60 * 60, // 30 days
      }),
    ],
  })
);

// Background sync for failed API requests
const bgSyncPlugin = new workbox.backgroundSync.BackgroundSyncPlugin('api-queue', {
  maxRetentionTime: 24 * 60 // Retry for up to 24 hours (in minutes)
});

// Register route for failed API calls to retry later
workbox.routing.registerRoute(
  ({ url }) => 
    url.hostname.includes('firestore.googleapis.com') || 
    url.pathname.includes('/wp-json/wc/'),
  new workbox.strategies.NetworkOnly({
    plugins: [bgSyncPlugin]
  }),
  'POST'
);

// Listen for push notifications
self.addEventListener('push', (event) => {
  if (event.data) {
    const data = event.data.json();
    const options = {
      body: data.body || 'New notification',
      icon: '/pwa-192x192.png',
      badge: '/pwa-64x64.png',
      data: data.data || {},
      vibrate: [100, 50, 100],
      actions: data.actions || []
    };
    
    event.waitUntil(
      self.registration.showNotification(data.title || 'Inventory Management System', options)
    );
  }
});

// Handle notification click
self.addEventListener('notificationclick', (event) => {
  event.notification.close();
  
  // Navigate to the appropriate page based on the notification
  if (event.notification.data && event.notification.data.url) {
    event.waitUntil(
      clients.openWindow(event.notification.data.url)
    );
  } else {
    // Default: Open the main app
    event.waitUntil(
      clients.openWindow('/')
    );
  }
});