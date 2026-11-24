'use strict';
/* قالب فروشگاه | فاکتورها: فهرست، فرم، ثبت اتمیک، ابطال، پرداخت و پیش‌نمایش */
const Invoices = {
  f: { q: '', status: '' }, saving: false,
  payStatus(total, paid) { return paid >= total && total >= 0 ? 'paid' : paid <= 0 ? 'unpaid' : 'partial'; },
  statusBadge(i) { if (i.status === 'canceled') return '<span class="badge arch">ابطال‌شده</span>'; const m = { paid: ['ok', 'پرداخت شده'], partial: ['low', 'پرداخت ناقص'], unpaid: ['out', 'پرداخت نشده'] }[i.paymentStatus]; return `<span class="badge ${m[0]}">${m[1]}</span>`; },
  /* محاسبهٔ دقیق مبالغ */
  calc(items, discount, vatRate) {
    const rows = items.map(it => { const lineTotal = it.qty * it.unitPrice, disc = Math.min(it.discount || 0, lineTotal), base = lineTotal - disc, vat = Math.round(base * vatRate / 100); return { lineTotal, disc, vat, final: base + vat }; });
    const subtotal = rows.reduce((s, r) => s + r.lineTotal, 0), lineDisc = rows.reduce((s, r) => s + r.disc, 0), afterLine = subtotal - lineDisc;
    const gd = Math.min(Math.max(discount || 0, 0), afterLine), net = afterLine - gd, vat = Math.round(net * vatRate / 100);
    return { rows, subtotal, lineDisc, discount: gd, net, vat, total: net + vat };
  },
  async render(c, params) { if (params[0] === 'new') return this.form(c, null); if (params[0] === 'edit') return this.form(c, params[1]); return this.list(c); },

  async list(c) {
    const invoices = (await DB.all('invoices')).sort((a, b) => b.date.localeCompare(a.date) || b.number.localeCompare(a.number)); const f = this.f;
    c.innerHTML = `<div class="page-head"><div><h2>فاکتورها</h2><p class="muted">فاکتورهای فروش و وضعیت پرداخت</p></div><div class="actions"><a class="btn primary" href="#/invoice/new">${U.icon('plus')} فاکتور جدید</a></div></div>
      <div class="toolbar wrap"><input class="inp grow" id="q" placeholder="جستجو: شماره فاکتور، نام مشتری یا تاریخ (۱۴۰۵/۰۸/۲۹)..." value="${U.esc(f.q)}">
      <select class="inp" id="st"><option value="">همه وضعیت‌ها</option><option value="paid">پرداخت شده</option><option value="partial">پرداخت ناقص</option><option value="unpaid">پرداخت نشده</option><option value="canceled">ابطال‌شده</option></select></div>
      <div class="table-wrap"><table class="tbl"><thead><tr><th>ردیف</th><th>شماره فاکتور</th><th>تاریخ</th><th>مشتری</th><th>مبلغ نهایی</th><th>پرداخت‌شده</th><th>باقی‌مانده</th><th>وضعیت</th><th>عملیات</th></tr></thead><tbody id="rows"></tbody></table></div>`;
    c.querySelector('#st').value = f.status; const rows = c.querySelector('#rows');
    const draw = () => {
      const q = U.en(f.q).trim().toLowerCase();
      const list = invoices.filter(i => (!q || i.number.toLowerCase().includes(q) || (i.customerName || '').toLowerCase().includes(q) || U.en(U.jStr(i.date)).includes(q) || i.date.includes(q)) && (!f.status || (f.status === 'canceled' ? i.status === 'canceled' : i.status !== 'canceled' && i.paymentStatus === f.status)));
      rows.innerHTML = list.length ? list.map((i, k) => { const rem = i.status === 'canceled' ? 0 : i.total - i.paid; return `<tr class="${i.status === 'canceled' ? 'dim' : ''}"><td>${U.fa(k + 1)}</td><td class="ltr"><a href="#" data-v="${i.id}">${i.number}</a></td><td>${U.jStr(i.date)}</td><td>${U.esc(i.customerName || 'مشتری متفرقه')}</td><td>${U.money(i.total)}</td><td>${U.money(i.paid)}</td><td class="${rem > 0 ? 'neg' : ''}">${U.money(rem)}</td><td>${this.statusBadge(i)}</td>
        <td class="ops"><button class="icon-btn" title="پیش‌نمایش و خروجی" data-v="${i.id}">${U.icon('eye')}</button>${i.status !== 'canceled' ? `<a class="icon-btn" title="ویرایش" href="#/invoice/edit/${i.id}">${U.icon('edit')}</a>${rem > 0 ? `<button class="icon-btn" title="ثبت پرداخت" data-p="${i.id}">${U.icon('wallet')}</button>` : ''}<button class="icon-btn" title="ابطال فاکتور" data-c="${i.id}">${U.icon('ban')}</button>` : ''}</td></tr>`; }).join('') : '<tr><td colspan="9" class="empty">فاکتوری یافت نشد.</td></tr>';
    };
    draw(); c.querySelector('#q').oninput = U.debounce(e => { f.q = e.target.value; draw(); }, 120); c.querySelector('#st').onchange = e => { f.status = e.target.value; draw(); };
    rows.onclick = async e => {
      const el = e.target.closest('[data-v],[data-p],[data-c]'); if (!el) return; e.preventDefault(); const inv = invoices.find(i => i.id === (el.dataset.v || el.dataset.p || el.dataset.c));
      if (el.dataset.v) this.open(inv.id); else if (el.dataset.p) this.payForm(inv); else this.cancel(inv);
    };
  },
  async open(id) { const inv = await DB.get('invoices', id); const items = (await DB.byIndexAll('invoiceItems', 'invoiceId', id)).sort((a, b) => a.row - b.row); this.preview(inv, items); },
  async cancel(inv) {
    if (!await U.confirm(`آیا از ابطال فاکتور ${inv.number} اطمینان دارید؟ موجودی کالاها به انبار بازگردانده می‌شود.`, { ok: 'ابطال فاکتور', danger: true })) return;
    try {
      await DB.run(['products', 'invoices', 'invoiceItems', 'inventoryTransactions'], 'readwrite', async t => {
        const cur = await t.get('invoices', inv.id); if (!cur || cur.status === 'canceled') throw new Error('این فاکتور قبلاً ابطال شده است.');
        for (const it of await t.byIndex('invoiceItems', 'invoiceId', inv.id)) { const p = await t.get('products', it.productId); if (p) await Inv.move(t, p, it.qty, 'cancel', 'ابطال فاکتور ' + cur.number, cur.id); }
        cur.status = 'canceled'; cur.canceledAt = U.nowIso(); await t.put('invoices', cur);
      });
      U.toast('فاکتور ابطال و موجودی بازگردانده شد.'); App.refresh();
    } catch (e) { U.toast(e.message, 'err'); }
  },
  payForm(inv) {
    const rem = inv.total - inv.paid;
    const m = U.modal({ title: 'ثبت پرداخت — ' + inv.number, body: `<div class="form"><p>مبلغ باقی‌مانده: <b>${U.money(rem)}</b></p><label>مبلغ پرداخت جدید (${U.cur()})<input class="inp" id="amt" inputmode="numeric" value="${U.fmt(rem)}"></label></div>`, footer: '<button class="btn" data-x>انصراف</button><button class="btn primary" data-ok>ثبت پرداخت</button>' });
    U.bindNum(m.el.querySelector('#amt')); m.el.querySelector('[data-x]').onclick = m.close;
    m.el.querySelector('[data-ok]').onclick = async () => {
      const a = U.num(m.el.querySelector('#amt').value); if (!(a > 0)) return U.toast('مبلغ پرداخت معتبر نیست.', 'err'); if (a > rem) return U.toast('مبلغ پرداخت بیشتر از باقی‌مانده است.', 'err');
      await DB.run(['invoices'], 'readwrite', async t => { const cur = await t.get('invoices', inv.id); cur.paid = Math.min(cur.total, cur.paid + a); cur.paymentStatus = this.payStatus(cur.total, cur.paid); await t.put('invoices', cur); });
      U.toast('پرداخت با موفقیت ثبت شد.'); m.close(); App.refresh();
    };
  },
  preview(inv, items) {
    const m = U.modal({ wide: true, title: `پیش‌نمایش فاکتور ${inv.number}`, body: `<div class="preview-box"><div class="preview-scale"></div></div>`, footer: `<button class="btn" data-x>بستن</button><button class="btn" data-ex="print">${U.icon('printer')} چاپ</button><button class="btn" data-ex="pdf">${U.icon('download')} PDF</button><button class="btn" data-ex="png">${U.icon('download')} PNG</button><button class="btn" data-ex="jpg">${U.icon('download')} JPG</button>` });
    m.el.querySelector('.modal').classList.add('preview');
    const box = m.el.querySelector('.preview-box'), sc = m.el.querySelector('.preview-scale'); sc.innerHTML = InvoiceSheet.html(inv, items);
    const fit = () => { const k = Math.min(1, (box.clientWidth - 2) / 1123); sc.style.transform = `scale(${k})`; sc.style.height = (sc.firstElementChild.offsetHeight * k) + 'px'; sc.style.width = '1123px'; box.style.height = (sc.firstElementChild.offsetHeight * k + 2) + 'px'; };
    requestAnimationFrame(fit); const ro = () => fit(); window.addEventListener('resize', ro); const old = m.close;
    new MutationObserver(() => { if (!m.el.isConnected) window.removeEventListener('resize', ro); }).observe(document.getElementById('modal-root'), { childList: true });
    m.el.querySelector('[data-x]').onclick = m.close;
    m.el.querySelectorAll('[data-ex]').forEach(b => b.onclick = async () => { b.disabled = true; try { await Exporter[b.dataset.ex](inv, items); } catch (e) { console.error(e); U.toast('خروجی گرفتن ناموفق بود. از «چاپ» و ذخیره به‌صورت PDF استفاده کنید.', 'err'); } b.disabled = false; });
  },

  /* ---------- فرم فاکتور ---------- */
  async form(c, editId) {
    const [prods, brands, custs] = await Promise.all([DB.all('products'), DB.all('brands'), DB.all('customers')]);
    let old = null, oldItems = [];
    if (editId) { old = await DB.get('invoices', editId); if (!old) { c.innerHTML = '<p class="empty">فاکتور یافت نشد.</p>'; return; } if (old.status === 'canceled') { c.innerHTML = '<p class="empty">فاکتور ابطال‌شده قابل ویرایش نیست.</p>'; return; } oldItems = (await DB.byIndexAll('invoiceItems', 'invoiceId', editId)).sort((a, b) => a.row - b.row); }
    const oldQty = {}; oldItems.forEach(i => oldQty[i.productId] = (oldQty[i.productId] || 0) + i.qty);
    const S = App.settings;
    const st = { customerId: old ? old.customerId || '' : '', date: old ? old.date : U.todayKey(), terms: old ? old.terms : 'cash', discount: old ? old.discount : 0, vatRate: old ? old.vatRate : S.vatRate, payStatus: old ? old.paymentStatus : 'paid', paid: old ? old.paid : 0, notes: old ? old.notes : S.invoiceFooter,
      items: oldItems.map(i => ({ productId: i.productId, code: i.code, name: i.name, unit: i.unit, qty: i.qty, unitPrice: i.unitPrice, discount: i.discount })) };
    const avail = pid => { const p = prods.find(x => x.id === pid); return p ? p.stock + (oldQty[pid] || 0) : 0; };
    c.innerHTML = `<div class="page-head"><div><h2>${editId ? 'ویرایش فاکتور ' + old.number : 'فاکتور جدید'}</h2><p class="muted">موجودی فقط هنگام «ذخیره فاکتور» تغییر می‌کند؛ پیش‌نمایش روی موجودی اثری ندارد.</p></div><div class="actions"><a class="btn" href="#/invoices">بازگشت</a></div></div>
    <div class="inv-layout"><div class="panel">
      <div class="form grid3"><label>تاریخ (شمسی)<input class="inp" id="date" value="${U.jStr(st.date)}" placeholder="۱۴۰۵/۰۸/۲۹"></label>
        <label>مشتری<div class="row-gap"><select class="inp" id="cust"></select><button class="btn" id="newc" type="button" title="مشتری جدید">${U.icon('plus')}</button></div></label>
        <label>شرایط فروش<select class="inp" id="terms"><option value="cash">نقدی</option><option value="credit">غیر نقدی</option></select></label></div>
      <label class="block">افزودن محصول<div class="rel"><input class="inp" id="pk" placeholder="جستجوی نام یا کد محصول و انتخاب..." autocomplete="off"></div></label>
      <div class="table-wrap"><table class="tbl items-edit"><thead><tr><th>ردیف</th><th>محصول</th><th>تعداد</th><th>قیمت واحد</th><th>تخفیف ردیف</th><th>مبلغ</th><th></th></tr></thead><tbody id="irows"></tbody></table></div></div>
    <div class="panel side"><h4>خلاصه فاکتور</h4><dl class="sum" id="sum"></dl>
      <label>تخفیف کلی (${U.cur()})<input class="inp" id="disc" inputmode="numeric" value="${U.fmt(st.discount)}"></label>
      <label>درصد ارزش افزوده<input class="inp" id="vat" inputmode="decimal" value="${U.fa(st.vatRate)}"></label>
      <label>وضعیت پرداخت<select class="inp" id="ps"><option value="paid">پرداخت شده</option><option value="partial">پرداخت ناقص</option><option value="unpaid">پرداخت نشده</option></select></label>
      <label id="paidw">مبلغ پرداخت‌شده (${U.cur()})<input class="inp" id="paid" inputmode="numeric" value="${U.fmt(st.paid)}"></label><div class="muted" id="remain"></div>
      <label>توضیحات<textarea class="inp" id="notes" rows="2">${U.esc(st.notes)}</textarea></label>
      <div class="actions col"><button class="btn primary lg" id="save">${U.icon('check')} ذخیره فاکتور</button><button class="btn" id="prev">${U.icon('eye')} پیش‌نمایش</button></div></div></div>`;
    const $ = s => c.querySelector(s);
    const custSel = $('#cust'); const fillCust = (sel) => { custSel.innerHTML = '<option value="">مشتری متفرقه (بدون ثبت)</option>' + custs.map(x => `<option value="${x.id}">${U.esc(x.name)}${x.phone ? ' — ' + U.fa(U.esc(x.phone)) : ''}</option>`).join(''); custSel.value = sel || ''; };
    fillCust(st.customerId); $('#terms').value = st.terms; $('#ps').value = st.payStatus;
    ['#disc', '#paid'].forEach(s => U.bindNum($(s)));
    $('#newc').onclick = () => Customers.form(null, rec => { custs.push(rec); fillCust(rec.id); });
    Pick.attach($('#pk'), () => Pick.productItems(prods, brands), id => addItem(id));
    const addItem = id => {
      const p = prods.find(x => x.id === id); if (!p) return; const ex = st.items.find(i => i.productId === id);
      if (ex) ex.qty += 1; else st.items.push({ productId: id, code: p.code, name: p.name, unit: p.unit, qty: 1, unitPrice: p.sellPrice, discount: 0 });
      drawItems();
    };
    const drawItems = () => {
      $('#irows').innerHTML = st.items.length ? st.items.map((it, i) => `<tr data-i="${i}"><td>${U.fa(i + 1)}</td><td>${U.esc(it.name)}<small class="muted ltr"> ${U.esc(it.code)}</small><div class="warn-line" hidden></div></td><td><input class="inp xs" data-f="qty" inputmode="numeric" value="${U.fa(it.qty)}"></td><td><input class="inp sm" data-f="unitPrice" inputmode="numeric" value="${U.fmt(it.unitPrice)}"></td><td><input class="inp sm" data-f="discount" inputmode="numeric" value="${U.fmt(it.discount)}"></td><td class="lt">—</td><td><button class="icon-btn" data-rm="${i}" title="حذف ردیف">${U.icon('trash')}</button></td></tr>`).join('') : '<tr><td colspan="7" class="empty">هنوز محصولی به فاکتور اضافه نشده است.</td></tr>';
      $('#irows').querySelectorAll('input').forEach(inp => U.bindNum(inp)); recalc();
    };
    const read = () => { st.discount = U.num($('#disc').value); st.vatRate = Math.max(0, U.num($('#vat').value)); st.ps = $('#ps').value; st.notes = $('#notes').value; st.terms = $('#terms').value; st.customerId = custSel.value; };
    const recalc = () => {
      read(); const r = this.calc(st.items, st.discount, st.vatRate);
      $('#irows').querySelectorAll('tr[data-i]').forEach((tr, i) => { tr.querySelector('.lt').textContent = U.fmt(r.rows[i].final - r.rows[i].vat + 0); const w = tr.querySelector('.warn-line'), a = avail(st.items[i].productId); const bad = st.items[i].qty > a; w.hidden = !bad; w.textContent = bad ? `موجودی کافی نیست (موجودی: ${U.fa(a)})` : ''; tr.classList.toggle('bad', bad); });
      $('#sum').innerHTML = `<dt>جمع کل</dt><dd>${U.money(r.subtotal)}</dd><dt>تخفیف ردیف‌ها</dt><dd>${U.money(r.lineDisc)}</dd><dt>تخفیف کلی</dt><dd>${U.money(r.discount)}</dd>${st.vatRate > 0 ? `<dt>ارزش افزوده</dt><dd>${U.money(r.vat)}</dd>` : ''}<dt class="big">مبلغ نهایی</dt><dd class="big">${U.money(r.total)}</dd>`;
      const ps = $('#ps').value; $('#paidw').hidden = ps !== 'partial'; if (ps === 'paid') st.paid = r.total; else if (ps === 'unpaid') st.paid = 0; else st.paid = U.num($('#paid').value);
      $('#remain').textContent = ps === 'unpaid' ? `باقی‌مانده: ${U.money(r.total)}` : ps === 'partial' ? `باقی‌مانده: ${U.money(r.total - st.paid)}` : '';
      return r;
    };
    $('#irows').addEventListener('input', e => { const inp = e.target.closest('[data-f]'); if (!inp) return; const it = st.items[+inp.closest('tr').dataset.i]; it[inp.dataset.f] = Math.max(0, U.num(inp.value)); recalc(); });
    $('#irows').addEventListener('click', e => { const b = e.target.closest('[data-rm]'); if (b) { st.items.splice(+b.dataset.rm, 1); drawItems(); } });
    ['#disc', '#vat', '#ps', '#paid', '#notes', '#terms', '#cust'].forEach(s => $(s).addEventListener('input', recalc)); drawItems();

    const validate = () => {
      const date = U.parseJ($('#date').value); if (!date) { U.toast('تاریخ شمسی معتبر نیست. نمونه: ۱۴۰۵/۰۸/۲۹', 'err'); return null; }
      if (!st.items.length) { U.toast('حداقل یک محصول به فاکتور اضافه کنید.', 'err'); return null; }
      if (st.items.some(i => !(i.qty > 0))) { U.toast('تعداد همه محصولات باید بزرگ‌تر از صفر باشد.', 'err'); return null; }
      const bad = st.items.find(i => i.qty > avail(i.productId)); if (bad) { U.toast(`موجودی «${bad.name}» کافی نیست. (موجودی: ${U.fa(avail(bad.productId))})`, 'err'); return null; }
      const r = recalc(); if (r.total < 0) { U.toast('مبلغ نهایی نمی‌تواند منفی باشد.', 'err'); return null; }
      if (st.ps === 'partial' && !(st.paid > 0 && st.paid < r.total)) { U.toast('در پرداخت ناقص، مبلغ پرداخت‌شده باید بیشتر از صفر و کمتر از مبلغ نهایی باشد.', 'err'); return null; }
      return { date, r };
    };
    const customerSnap = () => { const cu = custs.find(x => x.id === st.customerId); return cu ? { customerId: cu.id, customerName: cu.name, customerPhone: cu.phone || '', customerAddress: cu.address || '', customerNationalId: cu.nationalId || '' } : { customerId: '', customerName: 'مشتری متفرقه', customerPhone: '', customerAddress: '', customerNationalId: '' }; };
    $('#prev').onclick = () => {
      const v = validate(); if (!v) return; const r = v.r, ps = st.ps;
      const inv = Object.assign({ number: old ? old.number : this.peekNumber ? '(پیش‌نویس)' : '—', date: v.date, terms: st.terms, subtotal: r.subtotal, discount: r.discount, vatRate: st.vatRate, vat: r.vat, total: r.total, paid: ps === 'paid' ? r.total : ps === 'unpaid' ? 0 : st.paid, paymentStatus: ps, notes: st.notes, status: 'active' }, customerSnap());
      const items = st.items.map((it, i) => ({ code: it.code, name: it.name, unit: it.unit, qty: it.qty, unitPrice: it.unitPrice, lineTotal: r.rows[i].lineTotal, discount: r.rows[i].disc, vat: r.rows[i].vat, final: r.rows[i].final }));
      if (!old) this.nextNumber().then(n => { inv.number = n; this.preview(inv, items); }); else this.preview(inv, items);
    };
    const saveBtn = $('#save');
    saveBtn.onclick = async () => {
      if (this.saving) return; const v = validate(); if (!v) return;
      this.saving = true; saveBtn.disabled = true;
      try {
        const saved = await this.save(st, v, customerSnap(), old, oldItems);
        U.toast('فاکتور با موفقیت ذخیره شد.'); location.hash = '#/invoices'; setTimeout(() => this.open(saved.id), 350);
      } catch (e) { U.toast(e.message, 'err'); saveBtn.disabled = false; }
      finally { this.saving = false; }
    };
  },
  async nextNumber() {
    const [meta, invs] = await Promise.all([DB.get('settings', 'meta:invoiceSeq'), DB.all('invoices')]); const used = new Set(invs.map(i => i.number));
    let seq = Math.max((meta && meta.value) || 1, +App.settings.invoiceStart || 1); while (used.has(this.fmtNum(seq))) seq++; return this.fmtNum(seq);
  },
  fmtNum(seq) { return (App.settings.invoicePrefix || '') + String(seq).padStart(6, '0'); },
  /* ثبت نهایی در یک تراکنش اتمیک: فاکتور + ردیف‌ها + موجودی + تاریخچه انبار */
  save(st, v, cust, old, oldItems) {
    const r = v.r, ps = st.ps;
    return DB.run(['products', 'invoices', 'invoiceItems', 'inventoryTransactions', 'settings'], 'readwrite', async t => {
      if (old) { const cur = await t.get('invoices', old.id); if (!cur || cur.status === 'canceled') throw new Error('فاکتور ابطال‌شده قابل ویرایش نیست.'); }
      const oldNow = old ? await t.byIndex('invoiceItems', 'invoiceId', old.id) : [];
      const delta = {}, oldQ = {}, oldBuy = {};
      oldNow.forEach(i => { delta[i.productId] = (delta[i.productId] || 0) + i.qty; oldQ[i.productId] = (oldQ[i.productId] || 0) + i.qty; oldBuy[i.productId] = i.buyPrice; });
      st.items.forEach(i => { delta[i.productId] = (delta[i.productId] || 0) - i.qty; });
      const prods = {};
      for (const pid of Object.keys(delta)) {
        const p = await t.get('products', pid); if (!p) throw new Error('یکی از محصولات فاکتور یافت نشد.'); prods[pid] = p;
        if (p.stock + delta[pid] < 0) throw new Error(`موجودی «${p.name}» کافی نیست. (موجودی قابل فروش: ${U.fa(p.stock + (oldQ[pid] || 0))})`);
      }
      let inv;
      if (old) inv = Object.assign({}, await t.get('invoices', old.id));
      else {
        const meta = await t.get('settings', 'meta:invoiceSeq'); const used = new Set((await t.all('invoices')).map(i => i.number));
        let seq = Math.max((meta && meta.value) || 1, +App.settings.invoiceStart || 1); while (used.has(this.fmtNum(seq))) seq++;
        await t.put('settings', { key: 'meta:invoiceSeq', value: seq + 1 }); inv = { id: U.uid('inv'), number: this.fmtNum(seq), seq, createdAt: U.nowIso(), status: 'active' };
      }
      for (const it of oldNow) await t.del('invoiceItems', it.id);
      let cost = 0; const recs = [];
      st.items.forEach((it, i) => { const buy = oldBuy[it.productId] != null ? oldBuy[it.productId] : prods[it.productId].buyPrice; cost += buy * it.qty; recs.push({ id: U.uid('ii'), invoiceId: inv.id, row: i, productId: it.productId, code: it.code, name: it.name, unit: it.unit, qty: it.qty, unitPrice: it.unitPrice, buyPrice: buy, discount: r.rows[i].disc, lineTotal: r.rows[i].lineTotal, vat: r.rows[i].vat, final: r.rows[i].final }); });
      for (const x of recs) await t.put('invoiceItems', x);
      const paid = ps === 'paid' ? r.total : ps === 'unpaid' ? 0 : st.paid;
      Object.assign(inv, cust, { date: v.date, terms: st.terms, subtotal: r.subtotal, lineDiscount: r.lineDisc, discount: r.discount, vatRate: st.vatRate, vat: r.vat, net: r.net, total: r.total, paid, paymentStatus: this.payStatus(r.total, paid), notes: st.notes, cost, profit: r.net - cost, updatedAt: U.nowIso() });
      await t.put('invoices', inv);
      for (const [pid, d] of Object.entries(delta)) if (d !== 0) await Inv.move(t, prods[pid], d, old ? 'edit' : 'sale', (old ? 'ویرایش فاکتور ' : 'فاکتور فروش ') + inv.number, inv.id);
      return inv;
    });
  }
};
