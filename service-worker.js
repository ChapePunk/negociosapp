self.addEventListener('install', e => {
  console.log('📦 Service Worker instalado');
  self.skipWaiting();
});

self.addEventListener('activate', e => {
  console.log('🚀 Service Worker activo');
});

self.addEventListener('fetch', e => {
  // Este SW solo responde por estar presente, no cachea aún
});
