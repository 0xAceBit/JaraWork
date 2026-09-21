/* JaraWork Service Worker — handles Web Push notifications */

self.addEventListener('push', (event) => {
  if (!event.data) return
  let data = {}
  try { data = event.data.json() } catch { data = { title: 'JaraWork', body: event.data.text() } }

  const title = data.title ?? 'New JaraWork Order'
  const options = {
    body: data.body ?? 'A new order is available. Open JaraWork to claim it.',
    icon: '/icon-192.png',
    badge: '/icon-192.png',
    tag: `order-${data.orderId ?? Date.now()}`,
    data: { url: data.url ?? '/' },
    actions: [
      { action: 'open', title: 'View Order' },
      { action: 'dismiss', title: 'Dismiss' },
    ],
    requireInteraction: true,
  }

  event.waitUntil(self.registration.showNotification(title, options))
})

self.addEventListener('notificationclick', (event) => {
  event.notification.close()
  if (event.action === 'dismiss') return
  const url = event.notification.data?.url ?? '/'
  event.waitUntil(
    clients.matchAll({ type: 'window', includeUncontrolled: true }).then(list => {
      const existing = list.find(c => c.url.includes(self.location.origin))
      if (existing) { existing.focus(); return }
      return clients.openWindow(url)
    })
  )
})
