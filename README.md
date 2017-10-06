# Mavo-offline-interceptor

A backend interceptor for [Mavo](https://mavo.io).

## Examples

These examples have 4-way data-binding (View - Model - LocalStorage - DB) so if you open the examples in multiple windows, the data will be synchronized between them.

- To-Do List (PouchDB) - ([DEMO](https://valterkraemer.github.io/mavo-offline-interceptor/examples/todo-pouchdb/))
- To-Do List (Firebase) - ([DEMO](https://valterkraemer.github.io/mavo-offline-interceptor/examples/todo-firebase/))

## Features

- Enables the backend to push data to Mavo on server changes (3-way data-binding).
- Caches data in LocalStorage, both when retrieving data from server and when saving data.

Tested to work with:

- [mavo-pouchdb](https://github.com/valterkraemer/mavo-pouchdb)
- [mavo-firebase](https://github.com/valterkraemer/mavo-firebase)

## Setup mavo-offline-interceptor

Add mavo-offline-interceptor

    <script src="path/to/mavo-offline-interceptor.js"></script>

Add `offline-interceptor?` before your expression in `mv-storage`

E.g.
```
<main mv-app="todo"
  mv-storage="offline-interceptor?pouchdb=http://localhost:5984/mavo">

  ...
```
