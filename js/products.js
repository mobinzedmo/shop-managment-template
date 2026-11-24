'use strict';
/* قالب فروشگاه | محصولات، دسته‌بندی‌ها و برندها */
const Products = {
  tab: 'products',
  f: { q: '', cat: '', brand: '', status: '', min: '', max: '', archived: false, sort: 'code', dir: 1 },
  async render(c) {
    c.innerHTML = `<div class="page-head"><div><h2>محصولات</h2><p class="muted">مدیریت کالاها، دسته‌بندی‌ها و برندها</p></div><div class="actions" id="head-act"></div></div>
      <div class="tabs"><button data-tab="products">محصولات</button><button data-tab="categories">دسته‌بندی‌ها</button><button data-tab="brands">برندها</button></div><div id="pbody"></div>`;
    c.querySelectorAll('[data-tab]').forEach(b => { b.classList.toggle('on', b.dataset.tab === this.tab); b.onclick = () => { this.tab = b.dataset.tab; this.render(c); }; });
    const body = c.querySelector('#pbody');
    if (this.tab === 'products') await this.list(body, c.querySelector('#head-act'));
    else await this.simple(body, c.querySelector('#head-act'), this.tab);
  },
  nextCode(prods) { const pf = App.settings.productPrefix || 'P-'; const re = new RegExp('^' + pf.replace(/[.*+?^${}()|[\]\\]/g, '\\$&') + '(\\d+)$', 'i'); let mx = 0; prods.forEach(p => { const m = re.exec(p.code); if (m) mx = Math.max(mx, +m[1]); }); return pf + String(mx + 1).padStart(3, '0'); },
  sortVal(p, k) { return k === 'profit' ? (U.profitPct(p.buyPrice, p.sellPrice) ?? -1e9) : k === 'status' ? ({ ok: 2, low: 1, out: 0 })[Inv.status(p)] : p[k]; },
  async list(body, head) {
    const [prods, cats, brands] = await Promise.all([DB.all('products'), DB.all('categories'), DB.all('brands')]);
    head.innerHTML = `<button class="btn primary" id="add">${U.icon('plus')} افزودن محصول</button>`;
    head.querySelector('#add').onclick = () => this.form(null, prods, cats, brands);
    const f = this.f;
    body.innerHTML = `<div class="toolbar wrap"><input class="inp grow" id="q" placeholder="جستجو: نام، کد، برند یا دسته‌بندی..." value="${U.esc(f.q)}">
      <select class="inp" id="cat"><option value="">همه دسته‌ها</option>${cats.map(x => `<option value="${x.id}" ${f.cat === x.id ? 'selected' : ''}>${U.esc(x.name)}</option>`).join('')}</select>
      <select class="inp" id="brand"><option value="">همه برندها</option>${brands.map(x => `<option value="${x.id}" ${f.brand === x.id ? 'selected' : ''}>${U.esc(x.name)}</option>`).join('')}</select>
      <select class="inp" id="st"><option value="">همه وضعیت‌ها</option>${Object.entries(Inv.statusLabel).map(([k, v]) => `<option value="${k}" ${f.status === k ? 'selected' : ''}>${v}</option>`).join('')}</select>
      <input class="inp sm" id="min" inputmode="numeric" placeholder="حداقل قیمت" value="${U.esc(f.min)}"><input class="inp sm" id="max" inputmode="numeric" placeholder="حداکثر قیمت" value="${U.esc(f.max)}">
      <label class="chk"><input type="checkbox" id="arch" ${f.archived ? 'checked' : ''}> بایگانی‌شده‌ها</label></div>
      <div class="table-wrap"><table class="tbl"><thead><tr><th>ردیف</th>${[['code', 'کد محصول'], ['name', 'نام محصول'], ['sellPrice', 'قیمت فروش'], ['buyPrice', 'قیمت خرید'], ['profit', 'سود'], ['stock', 'موجودی'], ['status', 'وضعیت']].map(([k, l]) => `<th class="sortable" data-sort="${k}">${l}<i>${f.sort === k ? (f.dir > 0 ? '▲' : '▼') : ''}</i></th>`).join('')}<th>عملیات</th></tr></thead><tbody id="rows"></tbody></table></div><div class="muted small" id="cnt"></div>`;
    const rows = body.querySelector('#rows');
    const draw = () => {
      const q = f.q.trim().toLowerCase(), mn = U.num(f.min), mx = U.num(f.max);
      const nm = (arr, id) => (arr.find(x => x.id === id) || {}).name || '';
      let list = prods.filter(p => !!p.archived === f.archived && (!q || `${p.code} ${p.name} ${nm(brands, p.brandId)} ${nm(cats, p.categoryId)}`.toLowerCase().includes(q)) && (!f.cat || p.categoryId === f.cat) && (!f.brand || p.brandId === f.brand) && (!f.status || Inv.status(p) === f.status) && (!f.min || p.sellPrice >= mn) && (!f.max || p.sellPrice <= mx));
      list.sort((a, b) => { const x = this.sortVal(a, f.sort), y = this.sortVal(b, f.sort); return (typeof x === 'string' ? x.localeCompare(y, 'fa', { numeric: true }) : x - y) * f.dir; });
      body.querySelector('#cnt').textContent = `${U.fa(list.length)} محصول`;
      rows.innerHTML = list.length ? list.map((p, i) => { const pp = U.profitPct(p.buyPrice, p.sellPrice); return `<tr><td>${U.fa(i + 1)}</td><td class="ltr">${U.esc(p.code)}</td><td><a href="#" data-d="${p.id}">${U.esc(p.name)}</a></td><td>${U.fmt(p.sellPrice)}</td><td>${U.fmt(p.buyPrice)}</td><td class="${pp != null && pp < 0 ? 'neg' : 'pos'}">${U.pct(pp)}</td><td>${U.fa(p.stock)}</td><td>${p.archived ? '<span class="badge arch">بایگانی</span>' : Inv.badge(p)}</td>
        <td class="ops"><button class="icon-btn" title="جزئیات" data-d="${p.id}">${U.icon('eye')}</button><button class="icon-btn" title="ویرایش" data-e="${p.id}">${U.icon('edit')}</button>${p.archived ? `<button class="icon-btn" title="بازیابی از بایگانی" data-r="${p.id}">${U.icon('restore')}</button>` : `<button class="icon-btn" title="بایگانی / حذف" data-a="${p.id}">${U.icon('archive')}</button>`}</td></tr>`; }).join('') : '<tr><td colspan="9" class="empty">محصولی یافت نشد.</td></tr>';
    };
    draw();
    const on = (id, ev, fn) => body.querySelector(id).addEventListener(ev, fn);
    on('#q', 'input', U.debounce(e => { f.q = e.target.value; draw(); }, 120));
    on('#cat', 'change', e => { f.cat = e.target.value; draw(); }); on('#brand', 'change', e => { f.brand = e.target.value; draw(); }); on('#st', 'change', e => { f.status = e.target.value; draw(); });
    on('#min', 'input', U.debounce(e => { f.min = e.target.value; draw(); }, 200)); on('#max', 'input', U.debounce(e => { f.max = e.target.value; draw(); }, 200));
    on('#arch', 'change', e => { f.archived = e.target.checked; draw(); });
    body.querySelectorAll('[data-sort]').forEach(th => th.onclick = () => { f.dir = f.sort === th.dataset.sort ? -f.dir : 1; f.sort = th.dataset.sort; this.list(body, head); });
    rows.onclick = e => {
      const el = e.target.closest('[data-d],[data-e],[data-a],[data-r]'); if (!el) return; e.preventDefault();
      const id = el.dataset.d || el.dataset.e || el.dataset.a || el.dataset.r; const p = prods.find(x => x.id === id);
      if (el.dataset.d) this.details(p, cats, brands); else if (el.dataset.e) this.form(p, prods, cats, brands); else if (el.dataset.a) this.archive(p); else this.restore(p);
    };
  },
  form(p, prods, cats, brands) {
    const isNew = !p; const d = p || { code: this.nextCode(prods), name: '', brandId: '', categoryId: '', buyPrice: 0, sellPrice: 0, stock: 0, minStock: App.settings.defaultMinStock, unit: 'عدد', description: '', image: '' };
    let image = d.image || '';
    const opt = (arr, v) => arr.map(x => `<option value="${x.id}" ${x.id === v ? 'selected' : ''}>${U.esc(x.name)}</option>`).join('');
    const m = U.modal({ wide: true, title: isNew ? 'افزودن محصول' : 'ویرایش محصول', body: `<div class="form grid2">
      <label>کد محصول<input class="inp ltr" id="code" value="${U.esc(d.code)}"></label><label>نام محصول *<input class="inp" id="name" value="${U.esc(d.name)}"></label>
      <label>برند<select class="inp" id="brand"><option value="">— بدون برند —</option>${opt(brands, d.brandId)}</select></label><label>دسته‌بندی<select class="inp" id="cat"><option value="">— انتخاب —</option>${opt(cats, d.categoryId)}</select></label>
      <label>قیمت خرید (${U.cur()})<input class="inp" id="buy" inputmode="numeric" value="${U.fmt(d.buyPrice)}"></label><label>قیمت فروش (${U.cur()})<input class="inp" id="sell" inputmode="numeric" value="${U.fmt(d.sellPrice)}"></label>
      <label>درصد سود (خودکار)<input class="inp" id="pf" readonly></label><label>واحد شمارش<input class="inp" id="unit" value="${U.esc(d.unit)}"></label>
      ${isNew ? `<label>موجودی اولیه<input class="inp" id="stock" inputmode="numeric" value="۰"></label>` : `<label>موجودی فعلی<input class="inp" value="${U.fa(d.stock)}" readonly title="برای تغییر موجودی از بخش انبار استفاده کنید"></label>`}
      <label>حداقل موجودی (هشدار)<input class="inp" id="min" inputmode="numeric" value="${U.fa(d.minStock)}"></label>
      <label>تاریخ ثبت<input class="inp" value="${U.jStr((d.createdAt || U.nowIso()).slice(0, 10))}" readonly></label>
      <label class="full">توضیحات<textarea class="inp" id="desc" rows="2">${U.esc(d.description)}</textarea></label>
      <div class="full imgbox"><img id="pimg" ${image ? `src="${image}"` : 'hidden'} alt=""><div><label class="btn">${U.icon('upload')} انتخاب تصویر<input type="file" id="file" accept="image/*" hidden></label> <button class="btn ghost" id="rmimg" type="button">حذف تصویر</button></div></div></div>`,
      footer: '<button class="btn" data-x>انصراف</button><button class="btn primary" data-ok>ذخیره</button>' });
    const $ = s => m.el.querySelector(s);
    ['#buy', '#sell', '#min', '#stock'].forEach(s => $(s) && U.bindNum($(s)));
    const calc = () => { const pp = U.profitPct(U.num($('#buy').value), U.num($('#sell').value)); $('#pf').value = pp == null ? (U.num($('#buy').value) === 0 ? 'قیمت خرید صفر است' : '—') : U.pct(pp); };
    ['#buy', '#sell'].forEach(s => $(s).addEventListener('input', calc)); calc();
    $('#file').onchange = async e => { const f = e.target.files[0]; if (!f) return; try { image = await U.readImage(f); $('#pimg').src = image; $('#pimg').hidden = false; } catch { U.toast('خواندن تصویر ممکن نشد.', 'err'); } };
    $('#rmimg').onclick = () => { image = ''; $('#pimg').hidden = true; };
    $('[data-x]').onclick = m.close;
    const ok = $('[data-ok]');
    ok.onclick = async () => {
      const code = $('#code').value.trim(), name = $('#name').value.trim(), buy = U.num($('#buy').value), sell = U.num($('#sell').value);
      if (!name) return U.toast('نام محصول را وارد کنید.', 'err'); if (!code) return U.toast('کد محصول را وارد کنید.', 'err');
      if (buy < 0 || sell < 0) return U.toast('قیمت نمی‌تواند منفی باشد.', 'err');
      if (prods.some(x => x.id !== (p && p.id) && x.code.toLowerCase() === code.toLowerCase())) return U.toast('این کد محصول قبلاً ثبت شده است.', 'err');
      const rec = Object.assign({}, p || { id: U.uid('p'), stock: 0, createdAt: U.nowIso(), archived: false }, { code, name, brandId: $('#brand').value, categoryId: $('#cat').value, buyPrice: buy, sellPrice: sell, unit: $('#unit').value.trim() || 'عدد', minStock: U.num($('#min').value), description: $('#desc').value.trim(), image });
      ok.disabled = true;
      try {
        await DB.run(['products', 'inventoryTransactions', 'invoices'], 'readwrite', async t => {
          const init = isNew ? Math.max(0, U.num($('#stock').value)) : 0;
          if (isNew) { const ex = (await t.all('products')).some(x => x.code.toLowerCase() === code.toLowerCase()); if (ex) throw new Error('این کد محصول قبلاً ثبت شده است.'); }
          if (isNew) { rec.stock = 0; await t.put('products', rec); if (init > 0) await Inv.move(t, rec, init, 'initial', 'موجودی اولیه', null); }
          else { const cur = await t.get('products', rec.id); rec.stock = cur.stock; await t.put('products', rec); }
        });
        U.toast(isNew ? 'محصول با موفقیت ثبت شد.' : 'محصول با موفقیت ویرایش شد.'); m.close(); App.refresh();
      } catch (e) { U.toast(e.message, 'err'); ok.disabled = false; }
    };
  },
  async details(p, cats, brands) {
    const txs = (await DB.byIndexAll('inventoryTransactions', 'productId', p.id)).sort((a, b) => b.date.localeCompare(a.date));
    const items = (await DB.byIndexAll('invoiceItems', 'productId', p.id));
    const nm = (arr, id) => (arr.find(x => x.id === id) || {}).name || '—'; const pp = U.profitPct(p.buyPrice, p.sellPrice);
    U.modal({ wide: true, title: U.esc(p.name), body: `<div class="detail">${p.image ? `<img class="pimg" src="${p.image}" alt="">` : ''}<dl>
      <dt>کد</dt><dd class="ltr">${U.esc(p.code)}</dd><dt>برند</dt><dd>${U.esc(nm(brands, p.brandId))}</dd><dt>دسته‌بندی</dt><dd>${U.esc(nm(cats, p.categoryId))}</dd>
      <dt>قیمت خرید</dt><dd>${U.money(p.buyPrice)}</dd><dt>قیمت فروش</dt><dd>${U.money(p.sellPrice)}</dd><dt>سود هر واحد</dt><dd>${U.money(p.sellPrice - p.buyPrice)} (${U.pct(pp)})</dd>
      <dt>موجودی</dt><dd>${U.fa(p.stock)} ${U.esc(p.unit)} ${p.archived ? '' : Inv.badge(p)}</dd><dt>حداقل موجودی</dt><dd>${U.fa(p.minStock)}</dd><dt>تعداد فروش‌شده</dt><dd>${U.fa(items.reduce((s, i) => s + i.qty, 0))}</dd><dt>تاریخ ثبت</dt><dd>${U.jStr((p.createdAt || '').slice(0, 10))}</dd>
      ${p.description ? `<dt>توضیحات</dt><dd>${U.esc(p.description)}</dd>` : ''}</dl></div>
      <h4>آخرین تراکنش‌های انبار</h4><div class="table-wrap"><table class="tbl"><thead><tr><th>تاریخ</th><th>نوع</th><th>تعداد</th><th>موجودی بعد</th><th>توضیحات</th></tr></thead><tbody>${txs.slice(0, 15).map(t => `<tr><td>${U.jTime(t.date)}</td><td>${Inv.TYPES[t.type]}</td><td class="${t.qty > 0 ? 'pos' : 'neg'}">${t.qty > 0 ? '+' : '−'}${U.fa(Math.abs(t.qty))}</td><td>${U.fa(t.balance)}</td><td>${U.esc(t.note)}</td></tr>`).join('') || '<tr><td colspan="5" class="empty">تراکنشی نیست.</td></tr>'}</tbody></table></div>` });
  },
  async archive(p) {
    const used = (await DB.byIndexAll('invoiceItems', 'productId', p.id)).length > 0;
    if (used) {
      if (!await U.confirm(`«${U.esc(p.name)}» سابقه فروش دارد و حذف کامل آن تاریخچه فاکتورها را خراب می‌کند. آیا از بایگانی این محصول اطمینان دارید؟`, { ok: 'بایگانی' })) return;
      p.archived = true; await DB.put('products', p); U.toast('محصول بایگانی شد.');
    } else {
      if (!await U.confirm(`آیا از حذف «${U.esc(p.name)}» اطمینان دارید؟ این محصول سابقه فروش ندارد و برای همیشه حذف می‌شود.`, { ok: 'حذف', danger: true })) return;
      await DB.run(['products', 'inventoryTransactions'], 'readwrite', async t => { for (const x of await t.byIndex('inventoryTransactions', 'productId', p.id)) await t.del('inventoryTransactions', x.id); await t.del('products', p.id); });
      U.toast('محصول حذف شد.');
    }
    App.refresh();
  },
  async restore(p) { p.archived = false; await DB.put('products', p); U.toast('محصول از بایگانی خارج شد.'); App.refresh(); },

  /* ---------- دسته‌بندی‌ها و برندها ---------- */
  async simple(body, head, kind) {
    const isCat = kind === 'categories', store = kind, label = isCat ? 'دسته‌بندی' : 'برند', key = isCat ? 'categoryId' : 'brandId';
    const [rows, prods] = await Promise.all([DB.all(store), DB.all('products')]);
    head.innerHTML = `<button class="btn primary" id="add">${U.icon('plus')} افزودن ${label}</button>`;
    head.querySelector('#add').onclick = () => this.nameForm(store, label, null);
    rows.sort((a, b) => a.name.localeCompare(b.name, 'fa'));
    body.innerHTML = `<div class="table-wrap"><table class="tbl"><thead><tr><th>ردیف</th><th>نام ${label}</th><th>تعداد محصولات</th><th>عملیات</th></tr></thead><tbody>${rows.map((r, i) => `<tr><td>${U.fa(i + 1)}</td><td>${U.esc(r.name)}</td><td>${U.fa(prods.filter(p => p[key] === r.id && !p.archived).length)}</td><td class="ops"><button class="icon-btn" title="مشاهده محصولات" data-v="${r.id}">${U.icon('eye')}</button><button class="icon-btn" title="ویرایش" data-e="${r.id}">${U.icon('edit')}</button><button class="icon-btn" title="حذف" data-x="${r.id}">${U.icon('trash')}</button></td></tr>`).join('') || `<tr><td colspan="4" class="empty">موردی ثبت نشده است.</td></tr>`}</tbody></table></div>`;
    body.onclick = async e => {
      const b = e.target.closest('button'); if (!b) return; const id = b.dataset.v || b.dataset.e || b.dataset.x; const r = rows.find(x => x.id === id);
      if (b.dataset.v) { this.f.cat = isCat ? id : ''; this.f.brand = isCat ? '' : id; this.f.archived = false; this.tab = 'products'; App.refresh(); }
      else if (b.dataset.e) this.nameForm(store, label, r);
      else { const n = prods.filter(p => p[key] === id).length; if (n) return U.toast(`این ${label} برای ${U.fa(n)} محصول استفاده شده و قابل حذف نیست.`, 'err'); if (await U.confirm(`آیا از حذف ${label} «${U.esc(r.name)}» اطمینان دارید؟`, { ok: 'حذف', danger: true })) { await DB.del(store, id); U.toast(`${label} حذف شد.`); App.refresh(); } }
    };
  },
  nameForm(store, label, r) {
    const m = U.modal({ title: r ? `ویرایش ${label}` : `افزودن ${label}`, body: `<div class="form"><label>نام ${label}<input class="inp" id="n" value="${U.esc(r ? r.name : '')}"></label></div>`, footer: '<button class="btn" data-x>انصراف</button><button class="btn primary" data-ok>ذخیره</button>' });
    m.el.querySelector('[data-x]').onclick = m.close; m.el.querySelector('#n').focus();
    const go = async () => {
      const name = m.el.querySelector('#n').value.trim(); if (!name) return U.toast('نام را وارد کنید.', 'err');
      const all = await DB.all(store); if (all.some(x => x.id !== (r && r.id) && x.name.toLowerCase() === name.toLowerCase())) return U.toast('این نام قبلاً ثبت شده است.', 'err');
      await DB.put(store, Object.assign({}, r || { id: U.uid(store === 'brands' ? 'b' : 'c') }, { name })); U.toast(`${label} با موفقیت ثبت شد.`); m.close(); App.refresh();
    };
    m.el.querySelector('[data-ok]').onclick = go; m.el.querySelector('#n').onkeydown = e => { if (e.key === 'Enter') go(); };
  }
};
