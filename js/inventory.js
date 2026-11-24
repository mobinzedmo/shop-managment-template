'use strict';
/* قالب فروشگاه | انبار: هستهٔ تراکنش موجودی + صفحه انبار + انتخابگر محصول */
const Inv = {
  TYPES: { initial: 'موجودی اولیه', in: 'ورود کالا', out: 'خروج کالا', adjust: 'اصلاح موجودی', sale: 'فروش', cancel: 'ابطال فاکتور (بازگشت)', edit: 'ویرایش فاکتور' },
  status(p) { const s = p.stock || 0; return s <= 0 ? 'out' : (s <= (p.minStock || 0) ? 'low' : 'ok'); },
  statusLabel: { ok: 'موجود', low: 'موجودی کم', out: 'ناموجود' },
  badge(p) { const s = Inv.status(p); return `<span class="badge ${s}">${Inv.statusLabel[s]}</span>`; },
  /* تنها راه تغییر موجودی: همیشه همراه با ثبت تراکنش (داخل تراکنش IndexedDB فراخوانی شود) */
  async move(t, p, delta, type, note, ref) {
    p.stock = (p.stock || 0) + delta;
    await t.put('products', p);
    await t.put('inventoryTransactions', { id: U.uid('tx'), productId: p.id, productCode: p.code, productName: p.name, type, qty: delta, balance: p.stock, note: note || '', ref: ref || null, date: U.nowIso() });
  },
  async record({ productId, type, qty, note }) {
    return DB.run(['products', 'inventoryTransactions'], 'readwrite', async t => {
      const p = await t.get('products', productId); if (!p) throw new Error('محصول یافت نشد.');
      let delta;
      if (type === 'in') delta = qty; else if (type === 'out') delta = -qty; else delta = qty - (p.stock || 0);
      if (type !== 'adjust' && !(qty > 0)) throw new Error('تعداد باید بزرگ‌تر از صفر باشد.');
      if (type === 'adjust' && qty < 0) throw new Error('موجودی نمی‌تواند منفی باشد.');
      if ((p.stock || 0) + delta < 0) throw new Error('موجودی این محصول کافی نیست.');
      if (delta === 0) throw new Error('تغییری در موجودی ایجاد نشده است.');
      await Inv.move(t, p, delta, type, note, null); return p;
    });
  }
};

/* انتخابگر جستجوپذیر محصول */
const Pick = {
  attach(input, getItems, onPick) {
    const box = document.createElement('div'); box.className = 'pick-list'; box.hidden = true;
    input.parentElement.style.position = 'relative'; input.parentElement.appendChild(box);
    const show = () => {
      const q = input.value.trim().toLowerCase(); const items = getItems().filter(i => !q || i.text.toLowerCase().includes(q)).slice(0, 30);
      box.innerHTML = items.length ? items.map(i => `<div class="pick-item" data-id="${i.id}"><b>${U.esc(i.label)}</b><small>${U.esc(i.sub || '')}</small></div>`).join('') : '<div class="pick-empty">موردی یافت نشد.</div>';
      box.hidden = false; box._items = items;
    };
    input.addEventListener('input', show); input.addEventListener('focus', show);
    input.addEventListener('keydown', e => { if (e.key === 'Enter') { e.preventDefault(); const f = box._items && box._items[0]; if (f) choose(f.id); } if (e.key === 'Escape') box.hidden = true; });
    const choose = id => { box.hidden = true; input.value = ''; onPick(id); };
    box.addEventListener('mousedown', e => { const it = e.target.closest('.pick-item'); if (it) { e.preventDefault(); choose(it.dataset.id); } });
    input.addEventListener('blur', () => setTimeout(() => { box.hidden = true; }, 150));
  },
  productItems(prods, brands) {
    const bn = id => (brands.find(b => b.id === id) || {}).name || '';
    return prods.filter(p => !p.archived).map(p => ({ id: p.id, label: `${p.code} — ${p.name}`, sub: `موجودی: ${U.fa(p.stock)} • ${U.money(p.sellPrice)}`, text: `${p.code} ${p.name} ${bn(p.brandId)}` }));
  }
};

const Inventory = {
  tab: 'stock', f: { q: '', cat: '', status: '' }, h: { q: '', type: '' },
  async render(c) {
    const [prods, cats, brands] = await Promise.all([DB.all('products'), DB.all('categories'), DB.all('brands')]);
    const act = prods.filter(p => !p.archived);
    const low = act.filter(p => Inv.status(p) === 'low'), out = act.filter(p => Inv.status(p) === 'out');
    const value = act.reduce((s, p) => s + p.stock * p.buyPrice, 0);
    c.innerHTML = `
    <div class="page-head"><div><h2>مدیریت انبار</h2><p class="muted">ورود و خروج کالا، اصلاح موجودی و تاریخچه تغییرات</p></div>
      <div class="actions"><button class="btn primary" data-mv="in">${U.icon('arrowIn')} ورود کالا</button><button class="btn" data-mv="out">${U.icon('arrowOut')} خروج کالا</button><button class="btn" data-mv="adjust">${U.icon('sliders')} اصلاح موجودی</button></div></div>
    <div class="cards c4">
      <div class="stat"><span>تعداد محصولات</span><b>${U.fa(act.length)}</b></div>
      <div class="stat"><span>ارزش موجودی (به قیمت خرید)</span><b>${U.money(value)}</b></div>
      <div class="stat warn"><span>موجودی کم</span><b>${U.fa(low.length)}</b></div>
      <div class="stat danger"><span>ناموجود</span><b>${U.fa(out.length)}</b></div></div>
    ${(low.length + out.length) ? `<div class="alert-box">${U.icon('alert')}<div><b>هشدار موجودی:</b> ${out.length ? `${U.fa(out.length)} محصول ناموجود` : ''}${out.length && low.length ? ' و ' : ''}${low.length ? `${U.fa(low.length)} محصول کم‌موجود` : ''} — ${[...out, ...low].slice(0, 6).map(p => U.esc(p.name)).join('، ')}${low.length + out.length > 6 ? ' ...' : ''}</div></div>` : ''}
    <div class="tabs"><button data-tab="stock" class="${this.tab === 'stock' ? 'on' : ''}">موجودی فعلی</button><button data-tab="hist" class="${this.tab === 'hist' ? 'on' : ''}">تاریخچه تراکنش‌ها</button></div>
    <div id="inv-body"></div>`;
    c.querySelectorAll('[data-mv]').forEach(b => b.onclick = () => this.moveForm(b.dataset.mv, prods, brands));
    c.querySelectorAll('[data-tab]').forEach(b => b.onclick = () => { this.tab = b.dataset.tab; this.render(c); });
    const body = c.querySelector('#inv-body');
    if (this.tab === 'stock') this.stockTable(body, act, cats, brands, c); else await this.history(body, prods);
  },
  stockTable(body, act, cats, brands, c) {
    const f = this.f;
    body.innerHTML = `<div class="toolbar"><input class="inp" id="q" placeholder="جستجوی نام یا کد محصول..." value="${U.esc(f.q)}">
      <select class="inp" id="cat"><option value="">همه دسته‌ها</option>${cats.map(x => `<option value="${x.id}" ${f.cat === x.id ? 'selected' : ''}>${U.esc(x.name)}</option>`).join('')}</select>
      <select class="inp" id="st"><option value="">همه وضعیت‌ها</option>${Object.entries(Inv.statusLabel).map(([k, v]) => `<option value="${k}" ${f.status === k ? 'selected' : ''}>${v}</option>`).join('')}</select></div>
      <div class="table-wrap"><table class="tbl"><thead><tr><th>ردیف</th><th>کد</th><th>نام محصول</th><th>دسته‌بندی</th><th>موجودی</th><th>حداقل</th><th>ارزش موجودی</th><th>وضعیت</th><th>عملیات</th></tr></thead><tbody id="rows"></tbody></table></div>`;
    const rows = body.querySelector('#rows');
    const draw = () => {
      const q = f.q.trim().toLowerCase();
      const list = act.filter(p => (!q || (p.code + ' ' + p.name).toLowerCase().includes(q)) && (!f.cat || p.categoryId === f.cat) && (!f.status || Inv.status(p) === f.status));
      rows.innerHTML = list.length ? list.map((p, i) => `<tr><td>${U.fa(i + 1)}</td><td class="ltr">${U.esc(p.code)}</td><td>${U.esc(p.name)}</td><td>${U.esc((cats.find(x => x.id === p.categoryId) || {}).name || '—')}</td><td><b>${U.fa(p.stock)}</b> ${U.esc(p.unit || '')}</td><td>${U.fa(p.minStock)}</td><td>${U.money(p.stock * p.buyPrice)}</td><td>${Inv.badge(p)}</td>
        <td class="ops"><button class="icon-btn" title="ورود کالا" data-in="${p.id}">${U.icon('arrowIn')}</button><button class="icon-btn" title="خروج کالا" data-out="${p.id}">${U.icon('arrowOut')}</button><button class="icon-btn" title="اصلاح موجودی" data-adj="${p.id}">${U.icon('sliders')}</button></td></tr>`).join('') : '<tr><td colspan="9" class="empty">محصولی یافت نشد.</td></tr>';
    };
    draw();
    body.querySelector('#q').oninput = U.debounce(e => { f.q = e.target.value; draw(); }, 120);
    body.querySelector('#cat').onchange = e => { f.cat = e.target.value; draw(); };
    body.querySelector('#st').onchange = e => { f.status = e.target.value; draw(); };
    rows.onclick = e => { const b = e.target.closest('button'); if (!b) return; const id = b.dataset.in || b.dataset.out || b.dataset.adj; this.moveForm(b.dataset.in ? 'in' : b.dataset.out ? 'out' : 'adjust', act, brands, id); };
  },
  async history(body, prods) {
    const h = this.h; const txs = (await DB.all('inventoryTransactions')).sort((a, b) => b.date.localeCompare(a.date));
    body.innerHTML = `<div class="toolbar"><input class="inp" id="q" placeholder="جستجوی کالا..." value="${U.esc(h.q)}"><select class="inp" id="ty"><option value="">همه تراکنش‌ها</option>${Object.entries(Inv.TYPES).map(([k, v]) => `<option value="${k}" ${h.type === k ? 'selected' : ''}>${v}</option>`).join('')}</select></div>
      <div class="table-wrap"><table class="tbl"><thead><tr><th>ردیف</th><th>تاریخ و ساعت</th><th>کالا</th><th>نوع تراکنش</th><th>تعداد</th><th>موجودی پس از تراکنش</th><th>توضیحات</th></tr></thead><tbody id="rows"></tbody></table></div>`;
    const rows = body.querySelector('#rows');
    const draw = () => {
      const q = h.q.trim().toLowerCase(); const list = txs.filter(t => (!q || (t.productCode + ' ' + t.productName).toLowerCase().includes(q)) && (!h.type || t.type === h.type)).slice(0, 300);
      rows.innerHTML = list.length ? list.map((t, i) => `<tr><td>${U.fa(i + 1)}</td><td>${U.jTime(t.date)}</td><td>${U.esc(t.productName)} <small class="ltr muted">${U.esc(t.productCode)}</small></td><td>${Inv.TYPES[t.type] || t.type}</td><td class="${t.qty > 0 ? 'pos' : 'neg'}">${t.qty > 0 ? '+' : '−'}${U.fa(Math.abs(t.qty))}</td><td>${U.fa(t.balance)}</td><td>${U.esc(t.note)}</td></tr>`).join('') : '<tr><td colspan="7" class="empty">تراکنشی ثبت نشده است.</td></tr>';
    };
    draw();
    body.querySelector('#q').oninput = U.debounce(e => { h.q = e.target.value; draw(); }, 120);
    body.querySelector('#ty').onchange = e => { h.type = e.target.value; draw(); };
  },
  moveForm(type, prods, brands, presetId) {
    const titles = { in: 'ورود کالا', out: 'خروج کالا', adjust: 'اصلاح موجودی' };
    const act = prods.filter(p => !p.archived); let sel = presetId ? act.find(p => p.id === presetId) : null;
    const m = U.modal({ title: titles[type], body: `<div class="form"><label>محصول<div class="rel"><input class="inp" id="pk" placeholder="جستجوی نام یا کد محصول..." autocomplete="off"></div></label><div id="info" class="info-line"></div>
      <label>${type === 'adjust' ? 'موجودی شمارش‌شده (جدید)' : 'تعداد'}<input class="inp" id="qty" inputmode="numeric" placeholder="۰"></label><label>توضیحات<input class="inp" id="note" placeholder="${type === 'in' ? 'مثلاً: خرید از تأمین‌کننده' : type === 'out' ? 'مثلاً: مرجوعی، خرابی، مصرف داخلی' : 'مثلاً: شمارش سالانه'}"></label></div>`,
      footer: '<button class="btn" data-x>انصراف</button><button class="btn primary" data-ok>ثبت</button>' });
    const info = m.el.querySelector('#info'), pk = m.el.querySelector('#pk');
    const setSel = p => { sel = p; info.innerHTML = p ? `انتخاب‌شده: <b>${U.esc(p.name)}</b> — موجودی فعلی: <b>${U.fa(p.stock)}</b> ${U.esc(p.unit || '')}` : ''; };
    setSel(sel); if (sel) pk.value = `${sel.code} — ${sel.name}`;
    Pick.attach(pk, () => Pick.productItems(act, brands), id => { const p = act.find(x => x.id === id); setSel(p); pk.value = `${p.code} — ${p.name}`; m.el.querySelector('#qty').focus(); });
    U.bindNum(m.el.querySelector('#qty'));
    m.el.querySelector('[data-x]').onclick = m.close;
    const ok = m.el.querySelector('[data-ok]');
    ok.onclick = async () => {
      if (!sel) return U.toast('ابتدا یک محصول انتخاب کنید.', 'err');
      const qty = U.num(m.el.querySelector('#qty').value);
      ok.disabled = true;
      try {
        await Inv.record({ productId: sel.id, type, qty, note: m.el.querySelector('#note').value.trim() });
        U.toast(type === 'in' ? 'ورود کالا با موفقیت ثبت شد.' : type === 'out' ? 'خروج کالا با موفقیت ثبت شد.' : 'موجودی با موفقیت اصلاح شد.');
        m.close(); App.refresh();
      } catch (e) { U.toast(e.message, 'err'); ok.disabled = false; }
    };
  }
};
