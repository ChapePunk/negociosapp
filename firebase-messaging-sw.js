// firebase-messaging-sw.js

importScripts('https://www.gstatic.com/firebasejs/9.6.1/firebase-app-compat.js');
importScripts('https://www.gstatic.com/firebasejs/9.6.1/firebase-messaging-compat.js');

firebase.initializeApp({
  apiKey: "AIzaSyDQXY-scmR5EDXD-t69tyXA-r9T-PqrFYo",
  authDomain: "tiendasdb-dd848.firebaseapp.com",
  projectId: "tiendasdb-dd848",
  storageBucket: "tiendasdb-dd848.appspot.com",
  messagingSenderId: "53919436427",
  appId: "1:53919436427:web:9fd6fb71f9ea37813f4e8e"
});

const messaging = firebase.messaging();

messaging.onBackgroundMessage((payload) => {
  console.log('[firebase-messaging-sw.js] Mensaje en segundo plano:', payload);
  const notificationTitle = payload.notification.title;
  const notificationOptions = {
    body: payload.notification.body,
    icon: '/img/icono-notificacion.png' // Puedes personalizarlo
  };

  self.registration.showNotification(notificationTitle, notificationOptions);
});

