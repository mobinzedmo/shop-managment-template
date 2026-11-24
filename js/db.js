'use strict';
/* قالب فروشگاه | لایه ذخیره‌سازی IndexedDB (نسخه‌بندی‌شده) */
const DB = (() => {
  const NAME = 'shop-template-db', VER = 1;
  const STORES = { products: 'id', categories: 'id', brands: 'id', customers: 'id', invoices: 'id', invoiceItems: 'id', inventoryTransactions: 'id', settings: 'key' };
  let db;
  const DEFAULTS = {
    shopName: 'نام فروشگاه', slogan: '', productPrefix: 'P-', phone: '', address: '', instagram: '', website: '', currency: 'تومان',
    invoicePrefix: 'INV-', invoiceStart: 1, defaultMinStock: 5, invoiceFooter: 'از خرید شما سپاسگزاریم.', vatRate: 0,
    theme: 'light', economicCode: '', nationalId: '', province: '', city: '', postalCode: '', tplSeller: true, tplSignatures: true, tplBuyer: true
  };

  function open() {
    return new Promise((res, rej) => {
      if (!window.indexedDB) return rej(new Error('این مرورگر از IndexedDB پشتیبانی نمی‌کند.'));
      const r = indexedDB.open(NAME, VER);
      r.onupgradeneeded = () => {
        const d = r.result;
        for (const [n, kp] of Object.entries(STORES)) {
          if (d.objectStoreNames.contains(n)) continue;
          const s = d.createObjectStore(n, { keyPath: kp });
          if (n === 'invoiceItems') s.createIndex('invoiceId', 'invoiceId');
          if (n === 'inventoryTransactions') s.createIndex('productId', 'productId');
          if (n === 'invoices') s.createIndex('customerId', 'customerId');
        }
      };
      r.onsuccess = () => { db = r.result; db.onversionchange = () => db.close(); res(); };
      r.onerror = () => rej(r.error);
    });
  }
  const p = rq => new Promise((res, rej) => { rq.onsuccess = () => res(rq.result); rq.onerror = () => rej(rq.error); });

  /* اجرای اتمیک: همه نوشتن‌ها در یک تراکنش؛ با خطا همه برگشت می‌خورند */
  function run(stores, mode, fn) {
    return new Promise((res, rej) => {
      const tx = db.transaction(stores, mode);
      const api = {
        get: (s, k) => p(tx.objectStore(s).get(k)), all: s => p(tx.objectStore(s).getAll()),
        put: (s, v) => p(tx.objectStore(s).put(v)), del: (s, k) => p(tx.objectStore(s).delete(k)),
        clear: s => p(tx.objectStore(s).clear()), byIndex: (s, i, k) => p(tx.objectStore(s).index(i).getAll(k))
      };
      let out, failed = false;
      tx.oncomplete = () => res(out);
      tx.onabort = () => { if (!failed) rej(tx.error || new Error('عملیات ناموفق بود.')); };
      Promise.resolve().then(() => fn(api)).then(v => { out = v; }).catch(e => { failed = true; try { tx.abort(); } catch (_) {} rej(e); });
    });
  }
  const all = s => run([s], 'readonly', t => t.all(s));
  const get = (s, k) => run([s], 'readonly', t => t.get(s, k));
  const put = (s, v) => run([s], 'readwrite', t => t.put(s, v));
  const byIndexAll = (s, i, k) => run([s], 'readonly', t => t.byIndex(s, i, k));
  const del = (s, k) => run([s], 'readwrite', t => t.del(s, k));

  async function loadSettings() {
    const rows = await all('settings'); const s = Object.assign({}, DEFAULTS);
    rows.forEach(r => { if (!r.key.startsWith('meta:')) s[r.key] = r.value; });
    App.settings = s; return s;
  }
  async function saveSettings(patch) {
    Object.assign(App.settings, patch);
    await run(['settings'], 'readwrite', async t => { for (const [k, v] of Object.entries(patch)) await t.put('settings', { key: k, value: v }); });
  }

  /* داده‌های نمونه برای اولین اجرا */
  async function seed() {
    const meta = await get('settings', 'meta:seeded'); if (meta) return false;
    const cats = ['عمومی', 'لوازم خانه', 'پوشاک', 'خوراکی', 'لوازم‌التحریر', 'کالای دیجیتال', 'سایر'].map(n => ({ id: U.uid('c'), name: n }));
    const cid = n => cats.find(c => c.name === n).id;
    const brands = [{ id: U.uid('b'), name: 'برند نمونه' }];
    const pf = (App.settings.productPrefix || 'P-');
    const now = U.nowIso();
    const prods = [
      ['001', 'محصول نمونه ۱', 'عمومی', 450000, 300000, 12, 5], ['002', 'محصول نمونه ۲', 'لوازم خانه', 280000, 190000, 3, 5],
      ['003', 'محصول نمونه ۳', 'پوشاک', 350000, 220000, 0, 5], ['004', 'محصول نمونه ۴', 'کالای دیجیتال', 1200000, 800000, 8, 3]
    ].map(a => ({ id: U.uid('p'), code: pf + a[0], name: a[1], brandId: brands[0].id, categoryId: cid(a[2]), sellPrice: a[3], buyPrice: a[4], stock: 0, minStock: a[6], unit: 'عدد', description: '', image: '', createdAt: now, archived: false, sample: true, _init: a[5] }));
    const cust = [{ id: U.uid('u'), name: 'مشتری نمونه', phone: '09120000000', description: 'مشتری آزمایشی', address: '', nationalId: '', createdAt: now, sample: true }];
    await run(Object.keys(STORES), 'readwrite', async t => {
      for (const c of cats) await t.put('categories', c);
      for (const b of brands) await t.put('brands', b);
      for (const c of cust) await t.put('customers', c);
      for (const pr of prods) {
        const init = pr._init; delete pr._init; await t.put('products', pr);
        if (init > 0) await Inv.move(t, pr, init, 'initial', 'موجودی اولیه (داده نمونه)', null);
      }
      await t.put('settings', { key: 'meta:seeded', value: true });
      await t.put('settings', { key: 'meta:sampleNotice', value: true });
    });
    return true;
  }
  return { open, run, all, get, put, del, byIndexAll, loadSettings, saveSettings, seed, STORES, DEFAULTS };
})();
