/* Push em segundo plano do Controle de Pedidos MTX. */
importScripts('https://www.gstatic.com/firebasejs/10.8.0/firebase-app-compat.js');
importScripts('https://www.gstatic.com/firebasejs/10.8.0/firebase-messaging-compat.js');

firebase.initializeApp({
    apiKey: 'AIzaSyB0_kv4kQfcTdT7D5_Imf5NrG4EvY1p0lQ',
    authDomain: 'base-de-dados-pedidos-mtx.firebaseapp.com',
    projectId: 'base-de-dados-pedidos-mtx',
    storageBucket: 'base-de-dados-pedidos-mtx.firebasestorage.app',
    messagingSenderId: '702134531011',
    appId: '1:702134531011:web:debe80ae3577602aec8376'
});

const messaging = firebase.messaging();
const SITE_URL = 'https://conferenciamotormax25-ship-it.github.io/MTX/';

messaging.onBackgroundMessage((payload) => {
    const dados = payload.data || {};
    const titulo = dados.title || '🔔 Lembrete MTX';
    const opcoes = {
        body: dados.body || 'Existe um pedido aguardando entrada.',
        tag: dados.tag || 'mtx-pedidos-pendentes',
        renotify: true,
        requireInteraction: true,
        data: { url: dados.url || SITE_URL }
    };

    return self.registration.showNotification(titulo, opcoes);
});

self.addEventListener('notificationclick', (event) => {
    event.notification.close();
    const destino = event.notification.data?.url || SITE_URL;

    event.waitUntil(
        clients.matchAll({ type: 'window', includeUncontrolled: true }).then(async (janelas) => {
            for(const janela of janelas) {
                if('navigate' in janela) await janela.navigate(destino);
                if('focus' in janela) return janela.focus();
            }
            if(clients.openWindow) return clients.openWindow(destino);
            return undefined;
        })
    );
});

self.addEventListener('install', () => self.skipWaiting());
self.addEventListener('activate', (event) => event.waitUntil(clients.claim()));
