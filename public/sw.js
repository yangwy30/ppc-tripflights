/* ============================================
   PPC: Delay No More — Service Worker
   Listens for Web Push Notifications from Supabase Edge Functions
   ============================================ */

self.addEventListener('push', function (event) {
    console.log('[Service Worker] Push Received.');

    let notificationData = {
        title: 'Flight Update',
        body: 'There is an update to your flight.',
        icon: '/icons/icon-192.png'
    };

    if (event.data) {
        try {
            notificationData = event.data.json();
        } catch (e) {
            notificationData.body = event.data.text();
        }
    }

    const title = notificationData.title || 'PPC: Delay No More';
    const options = {
        body: notificationData.body,
        icon: notificationData.icon || '/icons/icon-192.png',
        badge: '/icons/icon-192.png',
        tag: notificationData.tag || 'flight-update',
        requireInteraction: true,
        data: notificationData.data || {}
    };

    event.waitUntil(
        self.registration.showNotification(title, options)
    );
});

self.addEventListener('notificationclick', function (event) {
    console.log('[Service Worker] Notification click Received.');
    event.notification.close();
    event.waitUntil(
        clients.matchAll({ type: 'window', includeUncontrolled: true }).then(function (clientList) {
            if (clientList.length > 0) {
                let client = clientList[0];
                for (let i = 0; i < clientList.length; i++) {
                    if (clientList[i].focused) {
                        client = clientList[i];
                    }
                }
                return client.focus();
            }
            return clients.openWindow('/');
        })
    );
});
