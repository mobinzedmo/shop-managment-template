'use strict';
/* قالب فروشگاه | هستهٔ برنامه: مسیریابی، تم، جستجوی سریع، اعلان‌ها */
Object.assign(App, {
  routes: {
    dashboard: { title: 'داشبورد', icon: 'dashboard', m: () => Dashboard }, products: { title: 'محصولات', icon: 'products', m: () => Products },
    inventory: { title: 'انبار', icon: 'inventory', m: () => Inventory }, invoices: { title: 'فاکتورها', icon: 'invoices', m: () => Invoices },
    invoice: { title: 'فاکتورها', icon: 'invoices', m: () => Invoices, hide: true }, customers: { title: 'مشتریان', icon: 'customers', m: () => Customers },
    reports: { title: 'گزارش‌ها', icon: 'reports', m: () => Reports }, settings: { title: 'تنظیمات', icon: 'settings', m: () => Settings }
  },
  THEMES: [
    { id: 'light', name: 'روشن (رزگلد)', bg: '#faf6f3', c1: '#a8574f', c2: '#c9a66b' }, { id: 'dark', name: 'تاریک', bg: '#1c1819', c1: '#d49a92', c2: '#d3b27a' },
    { id: 'ocean', name: 'اقیانوس', bg: '#f2f7fa', c1: '#1f6f9f', c2: '#4fb0c6' }, { id: 'forest', name: 'جنگل', bg: '#f3f7f3', c1: '#2f7d4f', c2: '#b7a14a' },
    { id: 'violet', name: 'بنفش', bg: '#f7f4fb', c1: '#6d4aa8', c2: '#d29ae0' }, { id: 'sunset', name: 'غروب', bg: '#fdf6f0', c1: '#d2622a', c2: '#e3a52f' }
  ],
  applyTheme() { const th = this.THEMES.some(x => x.id === this.settings.theme) ? this.settings.theme : 'light'; document.documentElement.dataset.theme = th; const b = U.$('#theme-btn'); if (b) b.innerHTML = U.icon(th === 'dark' ? 'sun' : 'moon'); const m = U.$('meta[name=theme-color]'); if (m) m.content = getComputedStyle(document.documentElement).getPropertyValue('--bg').trim() || '#faf6f3'; },
  applyBrand() { U.$$('[data-shop]').forEach(e => e.textContent = this.settings.shopName); U.$$('[data-slogan]').forEach(e => e.textContent = this.settings.slogan); document.title = `${this.settings.shopName} | سیستم مدیریت فروشگاه`; },
  parse() { const h = location.hash.replace(/^#\/?/, '') || 'dashboard'; const [name, ...params] = h.split('/'); return { name: this.routes[name] ? name : 'dashboard', params }; },
  async refresh() { const { name, params } = this.parse(); const r = this.routes[name]; const c = U.$('#view'); try { await r.m().render(c, params); } catch (e) { console.error(e); c.innerHTML = `<div class="panel"><p class="empty">خطایی رخ داد: ${U.esc(e.message)}</p></div>`; } this.badge(); },
  async go() {
    const { name } = this.parse(), r = this.routes[name];
    U.$$('[data-nav]').forEach(a => a.classList.toggle('on', a.dataset.nav === (name === 'invoice' ? 'invoices' : name)));
    U.$('#page-title').textContent = r.title; U.$('#view').scrollTop = 0; window.scrollTo(0, 0); U.$$('.modal-wrap').forEach(m => m.remove());
    await this.refresh();
  },
  async badge() { const prods = (await DB.all('products')).filter(p => !p.archived); this._alerts = prods.filter(p => Inv.status(p) !== 'ok'); const b = U.$('#bell-n'); b.textContent = U.fa(this._alerts.length); b.hidden = !this._alerts.length; },
  bell() {
    const l = this._alerts || []; const m = U.modal({ title: 'اعلان‌ها', body: l.length ? `<ul class="plain">${l.map(p => `<li><span>${U.esc(p.name)}</span><span>${U.fa(p.stock)} ${U.esc(p.unit)} ${Inv.badge(p)}</span></li>`).join('')}</ul>` : '<p class="empty">اعلان جدیدی وجود ندارد.</p>', footer: '<button class="btn primary" data-go>رفتن به انبار</button>' });
    m.el.querySelector('[data-go]').onclick = () => { m.close(); location.hash = '#/inventory'; };
  },
  initSearch() {
    const inp = U.$('#gs'), box = U.$('#gs-res');
    const run = U.debounce(async () => {
      const q = U.en(inp.value).trim().toLowerCase(); if (!q) { box.hidden = true; return; }
      const [p, c, i] = await Promise.all([DB.all('products'), DB.all('customers'), DB.all('invoices')]); const out = [];
      p.filter(x => `${x.code} ${x.name}`.toLowerCase().includes(q)).slice(0, 4).forEach(x => out.push(['محصول', `${x.code} — ${x.name}`, '#/products', () => { Products.tab = 'products'; Products.f.q = x.code; }]));
      c.filter(x => x.name.toLowerCase().includes(q) || U.en(x.phone || '').includes(q)).slice(0, 3).forEach(x => out.push(['مشتری', x.name, '#/customers', () => { Customers.q = x.name; }]));
      i.filter(x => x.number.toLowerCase().includes(q) || (x.customerName || '').toLowerCase().includes(q)).slice(0, 4).forEach(x => out.push(['فاکتور', `${x.number} — ${x.customerName || ''}`, '#/invoices', () => { Invoices.f.q = x.number; }]));
      box.innerHTML = out.length ? out.map((o, k) => `<a href="${o[2]}" data-k="${k}"><small>${o[0]}</small> ${U.esc(o[1])}</a>`).join('') : '<div class="pick-empty">نتیجه‌ای یافت نشد.</div>'; box._o = out; box.hidden = false;
    }, 150);
    inp.addEventListener('input', run); inp.addEventListener('blur', () => setTimeout(() => box.hidden = true, 200));
    box.addEventListener('mousedown', e => { const a = e.target.closest('a[data-k]'); if (a) { box._o[+a.dataset.k][3](); inp.value = ''; if (location.hash === box._o[+a.dataset.k][2]) setTimeout(() => this.refresh(), 0); } });
  },
  async init() {
    try {
      await DB.open(); await DB.loadSettings(); await DB.seed(); await DB.loadSettings();
    } catch (e) { document.body.innerHTML = `<div style="padding:40px;font-family:Tahoma;direction:rtl">خطا در راه‌اندازی پایگاه داده: ${U.esc(e.message)}<br>اگر در حالت ناشناس (Private) هستید، از پنجرهٔ عادی مرورگر استفاده کنید.</div>`; return; }
    this.applyTheme(); this.applyBrand();
    U.$('#theme-btn').onclick = async () => { await DB.saveSettings({ theme: document.documentElement.dataset.theme === 'dark' ? 'light' : 'dark' }); this.applyTheme(); if (this.parse().name === 'settings') this.refresh(); };
    U.$('#bell').onclick = () => this.bell();
    U.$('#bell').insertAdjacentHTML('afterbegin', U.icon('bell')); U.$('#gs-ic').innerHTML = U.icon('search');
    U.$$('[data-nav]').forEach(a => { const r = this.routes[a.dataset.nav]; a.insertAdjacentHTML('afterbegin', U.icon(r.icon, 20)); });
    this.initSearch();
    document.addEventListener('keydown', e => { if (e.key === 'Escape') { const m = U.$$('.modal-wrap').pop(); if (m) m.querySelector('[data-close]').click(); } });
    window.addEventListener('hashchange', () => this.go());
    if (navigator.storage && navigator.storage.persist) navigator.storage.persist().catch(() => { });
    if ('serviceWorker' in navigator) navigator.serviceWorker.register('sw.js').catch(() => { });
    await this.go();
  }
});
document.addEventListener('DOMContentLoaded', () => App.init());
