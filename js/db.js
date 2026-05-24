const DB_NAME = 'ReviewAppDB';
const DB_VERSION = 1;

function openDB() {
  return new Promise((resolve, reject) => {
    const req = indexedDB.open(DB_NAME, DB_VERSION);

    req.onupgradeneeded = (e) => {
      const db = e.target.result;
      if (!db.objectStoreNames.contains('categories')) {
        db.createObjectStore('categories', { keyPath: 'id', autoIncrement: true });
      }
      if (!db.objectStoreNames.contains('files')) {
        const fs = db.createObjectStore('files', { keyPath: 'id', autoIncrement: true });
        fs.createIndex('categoryId', 'categoryId', { unique: false });
      }
    };

    req.onsuccess = (e) => { const db = e.target.result; resolve(db); };
    req.onerror = (e) => reject(e.target.error);
    req.onblocked = () => reject(new Error('数据库被占用，请关闭其他标签页'));
  });
}

function dbOp(storeName, mode, callback) {
  return new Promise((resolve, reject) => {
    const openReq = indexedDB.open(DB_NAME, DB_VERSION);

    openReq.onupgradeneeded = (e) => {
      const db = e.target.result;
      if (!db.objectStoreNames.contains('categories')) {
        db.createObjectStore('categories', { keyPath: 'id', autoIncrement: true });
      }
      if (!db.objectStoreNames.contains('files')) {
        const fs = db.createObjectStore('files', { keyPath: 'id', autoIncrement: true });
        fs.createIndex('categoryId', 'categoryId', { unique: false });
      }
    };

    openReq.onsuccess = (e) => {
      const db = e.target.result;
      const tx = db.transaction(storeName, mode);
      const store = tx.objectStore(storeName);
      let reqResult;

      try {
        reqResult = callback(store);
      } catch (err) {
        db.close();
        reject(err);
        return;
      }

      tx.oncomplete = () => {
        db.close();
        resolve(reqResult instanceof IDBRequest ? reqResult.result : reqResult);
      };

      tx.onerror = () => { db.close(); reject(tx.error || new Error('事务失败')); };
      tx.onabort = () => { db.close(); reject(new Error('事务被中止')); };
    };

    openReq.onerror = (e) => reject(e.target.error);
    openReq.onblocked = () => reject(new Error('数据库被占用'));
  });
}

// Category operations
async function addCategory(name, color) {
  return dbOp('categories', 'readwrite', (s) => s.add({ name, color, createdAt: Date.now() }));
}

async function getCategories() {
  return dbOp('categories', 'readonly', (s) => s.getAll());
}

async function deleteCategory(id) {
  return dbOp('categories', 'readwrite', (s) => s.delete(id));
}

// File operations
async function addFile(name, categoryId, type, data, size) {
  return dbOp('files', 'readwrite', (s) => s.add({ name, categoryId, type, data, size, createdAt: Date.now() }));
}

async function getFiles(categoryId) {
  const all = await dbOp('files', 'readonly', (s) => s.getAll());
  if (categoryId) return all.filter(f => f.categoryId === categoryId);
  return all;
}

async function getFileById(id) {
  return dbOp('files', 'readonly', (s) => s.get(id));
}

async function deleteFile(id) {
  return dbOp('files', 'readwrite', (s) => s.delete(id));
}

async function updateFileName(id, newName) {
  return new Promise((resolve, reject) => {
    var openReq = indexedDB.open(DB_NAME, DB_VERSION);
    openReq.onsuccess = function(e) {
      var db = e.target.result;
      var tx = db.transaction('files', 'readwrite');
      var store = tx.objectStore('files');
      var getReq = store.get(id);
      getReq.onsuccess = function() {
        var file = getReq.result;
        if (!file) { db.close(); reject(new Error('文件不存在')); return; }
        file.name = newName;
        store.put(file);
      };
      getReq.onerror = function() { db.close(); reject(getReq.error); };
      tx.oncomplete = function() { db.close(); resolve(); };
      tx.onerror = function() { db.close(); reject(tx.error); };
    };
    openReq.onerror = function(e) { reject(e.target.error); };
  });
}
