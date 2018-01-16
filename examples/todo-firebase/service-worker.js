console.log('[ServiceWorker]')

this.addEventListener('fetch', event => {
  console.log('[ServiceWorker]: url')

  if (!event.request.url.startsWith(this.origin)) {
    return
  }

  event.respondWith(
    caches.open('v1').then(cache => {
      return cache.match(event.request).then(cacheResponse => {
        return cacheResponse || fetch(event.request).then(fetchResponse => {
          if (event.request.url.startsWith(this.origin)) {
            cache.put(event.request, fetchResponse.clone())
          }
          return fetchResponse
        })
      })
    }).catch(err => {
      console.error('[ServiceWorker]: Cache error', err)
    })
  )
})
