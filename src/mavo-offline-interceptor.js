(function () {
  let $ = window.Bliss
  let Mavo = window.Mavo

  Mavo.Backend.register($.Class({
    extends: Mavo.Backend,
    id: 'Pouchbd',
    constructor: function (url, o) {
      let backendUrl = url.split('offline-interceptor?')[1]
      let Backend = Mavo.Backend.types.filter(Backend => Backend.test(backendUrl))[0]

      this.backend = new Backend(backendUrl, o)
      this.permissions = this.backend.permissions
      this.key = this.backend.key

      this.online = false
      this.loading = false

      this.offlineStatusElem = $('.offline-status', this.mavo.element)

      if (this.offlineStatusElem && this.backend.onStatusChange) {
        addOfflineStatusElemStyles()
        this.updateStatus()

        this.backend.onStatusChange(isOnline => {
          this.online = isOnline
          this.updateStatus()
        })
      }

      if (this.backend.onNewData) {
        // Monkeypatch onNewData and store it to localStorage
        let backendOnNewData = this.backend.onNewData.bind(this.backend)
        this.backend.onNewData = data => {
          this.updateStorage(data)
          backendOnNewData(data)
        }
      }

      // Listen do database changes if backend supports it
      if (this.backend.setListenForChanges) {
        this.backend.setListenForChanges(true)
      }

      if (this.backend.upload) {
        this.upload = this.backend.upload.bind(this.backend)
      }
    },

    load: function () {
      this.loading = true
      this.updateStatus()

      let storageData = this.storageGet('data')

      if (!storageData) {
        return this.loadTry().then(data => {
          this.loading = false
          this.updateStatus()

          this.updateStorage(data)
          return data
        })
      }

      this.loadTry().then(data => {
        this.loading = false
        this.updateStatus()

        if (this.isNewData(data)) {
          this.updateStorage(data)

          this.mavo.render(data)
          this.mavo.setUnsavedChanges(false)
        } else if (this.storageGet('modified') && !this.storing) {
          return this.store(this.storageGet('data'), true)
        }
      })

      return Promise.resolve(storageData)
    },

    isNewData: function (data) {
      return this.backend.compareDocRevs(this.storageGet('data'), data) === 1
    },

    loadTry: function () {
      return this.loadTrying || (this.loadTrying = this.backend.load().catch(err => {
        if (err.status === 0) {
          return delay(5000).then(() => this.backend.load())
        }
        return Promise.reject(err)
      }).then(data => {
        delete this.loadTrying
        return data
      }))
    },

    updateStorage: function (data) {
      this.storageSet('data', data)
      this.storageSet('modified', false)
    },

    store: function (data, overrideUnsavedChanges) {
      this.storeData = data

      if ((!this.mavo.unsavedChanges && !overrideUnsavedChanges) || this.storing) {
        return Promise.resolve()
      }

      this.loading = true
      this.updateStatus()

      this.storing = true

      this.storageSet('data', data)
      this.storageSet('modified', true)

      this.storeTry().then(response => {
        // Updated
        this.storageSet('modified', false)
      }).catch(err => {
        this.mavo.error('Problem loading data', err)
      }).then(() => {
        this.loading = false
        this.updateStatus()

        this.storing = false
      })

      return Promise.resolve()
    },

    storeTry: function (data) {
      if (this.storeData) {
        data = this.storeData
        delete this.storeData
      }

      return this.backend.store(data).catch(err => {
        switch (err.status) {
          case 0:
            return delay(5000).then(() => this.storeTry(data))
          case 409:
            // TODO: resolve conflict
        }

        return Promise.reject(err)
      }).then(response => this.storeData ? this.storeTry() : response)
    },

    login: function () {
      return this.backend.login()
    },

    logout: function () {
      return this.backend.logout()
    },

    storageSet: function (key, value) {
      try {
        window.localStorage[`offline-interceptor-${this.key}-${key}`] = JSON.stringify(value)
      } catch (err) {}
    },
    storageGet: function (key) {
      try {
        return JSON.parse(window.localStorage[`offline-interceptor-${this.key}-${key}`])
      } catch (err) {}
    },

    updateStatus: function () {
      if (!this.offlineStatusElem || !this.backend.onStatusChange) {
        return
      }

      let status

      if (!this.online) {
        status = 'offline'
      } else {
        status = this.loading ? 'loading' : 'updated'
      }

      this.offlineStatusElem.setAttribute('status', status)

      let text = 'Offline'
      switch (status) {
        case 'updated':
          text = 'Up to date'
          break
        case 'loading':
          text = 'Loading'
      }

      this.offlineStatusElem.textContent = text
    },

    static: {
      test: value => {
        return /offline-interceptor/.test(value)
      }
    }
  }))

  function delay (ms) {
    return new Promise(resolve => {
      setTimeout(resolve, ms)
    })
  }

  function addOfflineStatusElemStyles () {
    var styleElem = document.createElement('style')
    styleElem.type = 'text/css'
    var rules = document.createTextNode(`
      .offline-status {
        font-size: 12px;
        padding: 9px;
        margin-left: auto;
      }

      .offline-status:after {
        display: inline-block;
        margin-left: 5px;
        border: 3px solid #FC006B;
        border-radius: 50%;
        width: 8px;
        height: 8px;
        content: '';
        padding: 1px;
        vertical-align: top;
      }

      .offline-status[status=loading]:after {
        border-color: #f3f3f3;
        border-top-color: #13A0F2;
        animation: spin 1s linear infinite;
      }

      .offline-status[status=updated]:after {
        border-color: #6AC715;
      }

      @keyframes spin {
        0% { transform: rotate(0deg); }
        100% { transform: rotate(360deg); }
      }
    `)

    styleElem.appendChild(rules)
    document.getElementsByTagName('head')[0].appendChild(styleElem)
  }
})()
