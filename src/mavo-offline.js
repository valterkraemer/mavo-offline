(function () {
  let $ = window.Bliss
  let Mavo = window.Mavo

  Mavo.Backend.register($.Class({
    extends: Mavo.Backend,
    id: 'Pouchbd',
    constructor: function (url, o) {
      let backendUrl = url.split('offline?')[1]
      let Backend = Mavo.Backend.types.filter(Backend => Backend.test(backendUrl))[0] || Mavo.Backend.Remote

      this.backend = new Backend(backendUrl, o)
      this.permissions = this.backend.permissions

      this.online = false
      this.loading = false
      this.storing = false

      this.ready = Promise.resolve()

      this.offlineStatusElem = $('.offline-status', this.mavo.element)

      if (this.offlineStatusElem) {
        addOfflineStatusElemStyles()
        this.updateStatus()

        if (this.backend.onStatusChange) {
          this.backend.onStatusChange(isOnline => {
            this.online = isOnline
            this.updateStatus()
          })
        }
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
      this.ready = this.ready.then(() => this.loadTry())

      let storageData = this.storageGet('data')

      if (storageData) {
        this.ready.then(data => {
          if (this.isNewData(data)) {
            this.mavo.render(data)
            this.mavo.setUnsavedChanges(false)
            this.updateStorage(data)
            return
          }

          if (this.storageGet('modified')) {
            return this.store(this.storageGet('data'))
          }
        })

        return Promise.resolve(storageData)
      }

      return this.ready.then(data => {
        this.updateStorage(data)
        return data
      })
    },

    loadTry: function () {
      this.loading = true
      this.updateStatus()

      return helper.call(this).then(data => {
        this.loading = false
        this.updateStatus()

        return data || {}
      })

      function helper () {
        return this.backend.load().catch(err => {
          if (err.status === 0) {
            return delay(5000).then(() => helper())
          }
          return Promise.reject(err)
        })
      }
    },

    isNewData: function (data) {
      if (!this.backend.compareDocRevs) {
        return true
      }

      return this.backend.compareDocRevs(this.storageGet('data'), data) === 1
    },

    updateStorage: function (data) {
      this.storageSet('data', data)
      this.storageSet('modified', false)
    },

    store: function (data) {
      if (!this.mavo.unsavedChanges) {
        return Promise.resolve()
      }

      this.storageSet('data', data)
      this.storageSet('modified', true)

      this.storeData = data

      if (!this.storing) {
        this.storing = true
        this.updateStatus()

        this.ready = this.ready.then(() => this.storeTry()).then(() => {
          this.storing = false
          this.updateStatus()
        })
      }

      return Promise.resolve()
    },

    storeTry: function (data) {
      data = this.storeData || data
      delete this.storeData

      return this.backend.store(data).catch(err => {
        switch (err.status) {
          case 0:
            return delay(5000).then(() => this.storeTry(data))
          case 409:
            // TODO: resolve conflict
        }

        return Promise.reject(err)
      }).then(() => {
        if (this.storeData) {
          return this.storeTry()
        }
      })
    },

    login: function () {
      return this.backend.login()
    },

    logout: function () {
      return this.backend.logout()
    },

    storageSet: function (key, value) {
      try {
        window.localStorage[`offline-${this.mavo.id || 'default'}-${key}`] = JSON.stringify(value)
      } catch (err) {}
    },
    storageGet: function (key) {
      try {
        return JSON.parse(window.localStorage[`offline-${this.mavo.id || 'default'}-${key}`])
      } catch (err) {}
    },

    updateStatus: function () {
      if (!this.offlineStatusElem) {
        return
      }

      let status = getStatus(this)

      this.offlineStatusElem.setAttribute('status', status)
      this.offlineStatusElem.textContent = status
    },

    static: {
      test: value => {
        return /offline/.test(value)
      }
    }
  }))

  function delay (ms) {
    return new Promise(resolve => {
      setTimeout(resolve, ms)
    })
  }

  function getStatus (_this) {
    // 0: Offline
    // 1: Up to date
    // 2: Loading
    // 3: Storing

    if (_this.backend.onStatusChange) {
      if (!_this.online) {
        return 'Offline'
      }

      if (!_this.storing && !_this.loading) {
        return 'Up to date'
      }
    }

    if (_this.loading) {
      return 'Loading'
    }

    if (_this.storing) {
      return 'Storing'
    }

    return 'Done'
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

      .offline-status[status="Up to date"]:after {
        border-color: #6AC715;
      }

      .offline-status[status="Done"]:after {
        border-color: #6AC715;
      }

      .offline-status[status="Loading"]:after, .offline-status[status="Storing"]:after {
        border-color: #f3f3f3;
        border-top-color: #13A0F2;
        animation: spin 1s linear infinite;
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
