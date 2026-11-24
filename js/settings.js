'use strict';
/* قالب فروشگاه | تنظیمات + پشتیبان‌گیری و بازیابی */
const Backup = {
  VERSION: 1,
  async export() {
    const data = {}; for (const s of Object.keys(DB.STORES)) data[s] = await DB.all(s);
    const j = U.toJ(U.todayKey()); const name = `backup-${j.jy}-${U.pad(j.jm)}-${U.pad(j.jd)}.json`;
    const payload = { app: 'SHOP-TEMPLATE', version: this.VERSION, exportedAt: U.nowIso(), data };
    U.download(new Blob([JSON.stringify(payload)], { type: 'application/json' }), name); U.toast('نسخهٔ پشتیبان با موفقیت ذخیره شد.');
  },
  validate(obj) {
    if (!obj || obj.app !== 'SHOP-TEMPLATE' || !obj.data || typeof obj.data !== 'object') throw new Error('این فایل، نسخهٔ پشتیبان معتبر این برنامه نیست.');
    if (obj.version > this.VERSION) throw new Error('این نسخهٔ پشتیبان با نسخهٔ جدیدتری از برنامه ساخته شده است.');
    for (const s of Object.keys(DB.STORES)) { if (!Array.isArray(obj.data[s])) throw new Error(`بخش «${s}» در فایل وجود ندارد یا ناقص است.`); const kp = DB.STORES[s], seen = new Set(); for (const r of obj.data[s]) { if (!r || typeof r !== 'object' || r[kp] == null) throw new Error(`رکورد نامعتبر در بخش «${s}».`); if (seen.has(r[kp])) throw new Error(`رکورد تکراری در بخش «${s}».`); seen.add(r[kp]); } }
    const d = obj.data, codes = new Set(), pids = new Set(d.products.map(p => p.id)), iids = new Set(d.invoices.map(i => i.id));
    for (const p of d.products) { if (typeof p.name !== 'string' || typeof p.code !== 'string' || !isFinite(p.stock) || !isFinite(p.buyPrice) || !isFinite(p.sellPrice)) throw new Error('اطلاعات محصولات ناقص یا نامعتبر است.'); const c = p.code.toLowerCase(); if (codes.has(c)) throw new Error(`کد محصول تکراری: ${p.code}`); codes.add(c); }
    const nums = new Set(); for (const i of d.invoices) { if (!i.number || !isFinite(i.total) || !i.date) throw new Error('اطلاعات فاکتورها ناقص یا نامعتبر است.'); if (nums.has(i.number)) throw new Error(`شمارهٔ فاکتور تکراری: ${i.number}`); nums.add(i.number); }
    for (const it of d.invoiceItems) { if (!iids.has(it.invoiceId) || !isFinite(it.qty)) throw new Error('ردیف‌های فاکتور با فاکتورها هم‌خوانی ندارد.'); }
    for (const t of d.inventoryTransactions) if (!pids.has(t.productId)) throw new Error('تراکنش انبار مربوط به محصول ناشناس در فایل وجود دارد.');
    return d;
  },
  async restore(file) {
    let obj; try { obj = JSON.parse(await file.text()); } catch { throw new Error('فایل انتخاب‌شده JSON معتبر نیست.'); }
    const d = this.validate(obj);
    const cnt = `${U.fa(d.products.length)} محصول، ${U.fa(d.customers.length)} مشتری و ${U.fa(d.invoices.length)} فاکتور`;
    if (!await U.confirm(`فایل معتبر است و شامل ${cnt} می‌باشد.<br><b>با بازیابی، تمام اطلاعات فعلی این مرورگر جایگزین می‌شود.</b> پیشنهاد می‌شود ابتدا از اطلاعات فعلی پشتیبان بگیرید. ادامه می‌دهید؟`, { ok: 'بازیابی اطلاعات', danger: true })) return false;
    await DB.run(Object.keys(DB.STORES), 'readwrite', async t => { for (const s of Object.keys(DB.STORES)) { await t.clear(s); for (const r of d[s]) await t.put(s, r); } });
    await DB.loadSettings(); return true;
  }
};

const Settings = {
  async render(c) {
    const s = App.settings; const v = k => U.esc(s[k] ?? '');
    let est = ''; try { if (navigator.storage && navigator.storage.estimate) { const e = await navigator.storage.estimate(); est = `فضای مصرفی: ${U.fa((e.usage / 1048576).toFixed(1))} مگابایت`; } } catch { }
    const persisted = navigator.storage && navigator.storage.persisted ? await navigator.storage.persisted() : false;
    c.innerHTML = `<div class="page-head"><div><h2>تنظیمات</h2><p class="muted">اطلاعات فروشگاه، قالب فاکتور، ظاهر و داده‌ها</p></div><div class="actions"><button class="btn primary" id="save">${U.icon('check')} ذخیره تنظیمات</button></div></div>
    <div class="panel"><h4>اطلاعات فروشگاه</h4><div class="form grid3">
      <label>نام فروشگاه<input class="inp" id="shopName" value="${v('shopName')}"></label><label>شعار<input class="inp" id="slogan" value="${v('slogan')}"></label><label>شماره تماس<input class="inp" id="phone" value="${v('phone')}"></label>
      <label>آدرس اینستاگرام<input class="inp ltr" id="instagram" value="${v('instagram')}"></label><label>وب‌سایت<input class="inp ltr" id="website" value="${v('website')}"></label><label>واحد پول<input class="inp" id="currency" value="${v('currency')}"></label>
      <label>استان<input class="inp" id="province" value="${v('province')}"></label><label>شهر<input class="inp" id="city" value="${v('city')}"></label><label>کد پستی<input class="inp" id="postalCode" value="${v('postalCode')}"></label>
      <label>شماره اقتصادی<input class="inp" id="economicCode" value="${v('economicCode')}"></label><label>شناسه ملی / شماره ملی<input class="inp" id="nationalId" value="${v('nationalId')}"></label><label class="full3">آدرس<input class="inp" id="address" value="${v('address')}"></label></div></div>
    <div class="panel"><h4>فاکتور و انبار</h4><div class="form grid3">
      <label>پیشوند شماره فاکتور<input class="inp ltr" id="invoicePrefix" value="${v('invoicePrefix')}"></label><label>شمارهٔ شروع فاکتور<input class="inp" id="invoiceStart" inputmode="numeric" value="${U.fa(s.invoiceStart)}"></label><label>حداقل موجودی پیش‌فرض<input class="inp" id="defaultMinStock" inputmode="numeric" value="${U.fa(s.defaultMinStock)}"></label>
      <label>پیشوند کد محصول<input class="inp ltr" id="productPrefix" value="${v('productPrefix')}"></label>
      <label>درصد ارزش افزوده پیش‌فرض<input class="inp" id="vatRate" inputmode="decimal" value="${U.fa(s.vatRate)}"></label><label class="full3">متن پیش‌فرض پایین فاکتور (توضیحات)<input class="inp" id="invoiceFooter" value="${v('invoiceFooter')}"></label></div>
      <div class="checks"><label class="chk"><input type="checkbox" id="tplSeller" ${s.tplSeller ? 'checked' : ''}> نمایش بخش مشخصات فروشنده</label><label class="chk"><input type="checkbox" id="tplBuyer" ${s.tplBuyer ? 'checked' : ''}> نمایش بخش مشخصات خریدار</label><label class="chk"><input type="checkbox" id="tplSignatures" ${s.tplSignatures ? 'checked' : ''}> نمایش بخش مهر و امضا</label></div>
      <p class="muted small">شمارهٔ بعدی فاکتور همیشه بزرگ‌تر از بالاترین شمارهٔ ثبت‌شده است و تکراری ایجاد نمی‌شود.</p></div>
    <div class="panel"><h4>ظاهر و تم</h4><div class="themes">${App.THEMES.map(th => `<button type="button" data-th="${th.id}" class="theme-opt ${s.theme === th.id ? 'on' : ''}"><span class="sw" style="background:${th.bg}"><i style="background:${th.c1}"></i><i style="background:${th.c2}"></i></span>${th.name}</button>`).join('')}</div></div>
    <div class="panel"><h4>پشتیبان‌گیری و بازیابی</h4><p class="muted">اطلاعات فقط داخل همین مرورگر (IndexedDB) ذخیره می‌شود و به‌صورت خودکار بین دستگاه‌ها همگام نمی‌شود. به‌طور منظم پشتیبان بگیرید.</p>
      <div class="actions"><button class="btn primary" id="bk">${U.icon('download')} پشتیبان‌گیری از اطلاعات</button><label class="btn">${U.icon('upload')} بازیابی اطلاعات<input type="file" id="rs" accept="application/json,.json" hidden></label>${navigator.storage && navigator.storage.persist ? `<button class="btn" id="persist" ${persisted ? 'disabled' : ''}>${persisted ? 'ذخیره‌سازی پایدار فعال است' : 'درخواست ذخیره‌سازی پایدار'}</button>` : ''}</div><p class="muted small">${est}</p></div>
    <div class="panel"><h4>داده‌ها</h4><div class="actions"><button class="btn" id="delsample">حذف داده‌های نمونه</button><button class="btn danger" id="reset">پاک‌کردن تمام اطلاعات</button></div></div>`;
    const g = id => c.querySelector('#' + id);
    g('save').onclick = async () => {
      const patch = {}; ['shopName', 'slogan', 'phone', 'instagram', 'website', 'currency', 'province', 'city', 'postalCode', 'economicCode', 'nationalId', 'address', 'invoicePrefix', 'productPrefix', 'invoiceFooter'].forEach(k => patch[k] = g(k).value.trim());
      if (!patch.productPrefix) patch.productPrefix = 'P-'; if (!patch.shopName) return U.toast('نام فروشگاه را وارد کنید.', 'err'); if (!patch.currency) patch.currency = 'تومان';
      patch.invoiceStart = Math.max(1, Math.floor(U.num(g('invoiceStart').value))); patch.defaultMinStock = Math.max(0, U.num(g('defaultMinStock').value)); patch.vatRate = Math.max(0, U.num(g('vatRate').value));
      ['tplSeller', 'tplBuyer', 'tplSignatures'].forEach(k => patch[k] = g(k).checked);
      await DB.saveSettings(patch); App.applyBrand(); U.toast('تنظیمات با موفقیت ذخیره شد.');
    };
    c.querySelectorAll('[data-th]').forEach(b => b.onclick = async () => { await DB.saveSettings({ theme: b.dataset.th }); App.applyTheme(); this.render(c); });
    g('bk').onclick = () => Backup.export();
    g('rs').onchange = async e => { const f = e.target.files[0]; e.target.value = ''; if (!f) return; try { if (await Backup.restore(f)) { U.toast('اطلاعات با موفقیت بازیابی شد.'); App.applyTheme(); App.applyBrand(); App.refresh(); } } catch (err) { U.toast(err.message, 'err'); } };
    const pe = g('persist'); if (pe) pe.onclick = async () => { const ok = await navigator.storage.persist(); U.toast(ok ? 'ذخیره‌سازی پایدار فعال شد.' : 'مرورگر این درخواست را نپذیرفت.', ok ? 'ok' : 'err'); this.render(c); };
    g('delsample').onclick = async () => {
      if (!await U.confirm('محصولات و مشتریان نمونه (و فاکتورهایی که فقط شامل کالاهای نمونه‌اند) حذف می‌شوند. ادامه می‌دهید؟', { ok: 'حذف داده‌های نمونه', danger: true })) return;
      await DB.run(Object.keys(DB.STORES), 'readwrite', async t => {
        const prods = (await t.all('products')).filter(p => p.sample), pids = new Set(prods.map(p => p.id)), items = await t.all('invoiceItems'), byInv = {};
        items.forEach(i => (byInv[i.invoiceId] = byInv[i.invoiceId] || []).push(i));
        for (const [iid, list] of Object.entries(byInv)) if (list.every(i => pids.has(i.productId))) { for (const i of list) await t.del('invoiceItems', i.id); await t.del('invoices', iid); }
        for (const x of await t.all('inventoryTransactions')) if (pids.has(x.productId)) await t.del('inventoryTransactions', x.id);
        const remainingInv = await t.all('invoices');
        for (const p of prods) { if (items.some(i => i.productId === p.id && remainingInv.some(v => v.id === i.invoiceId))) { p.archived = true; await t.put('products', p); } else await t.del('products', p.id); }
        for (const cu of (await t.all('customers')).filter(x => x.sample)) if (!remainingInv.some(i => i.customerId === cu.id)) await t.del('customers', cu.id);
        await t.put('settings', { key: 'meta:sampleNotice', value: false });
      });
      U.toast('داده‌های نمونه حذف شد.'); App.refresh();
    };
    g('reset').onclick = async () => {
      if (!await U.confirm('<b>تمام اطلاعات (محصولات، فاکتورها، مشتریان و تنظیمات) برای همیشه پاک می‌شود.</b> ابتدا پشتیبان بگیرید. ادامه می‌دهید؟', { ok: 'پاک‌کردن همه چیز', danger: true })) return;
      await DB.run(Object.keys(DB.STORES), 'readwrite', async t => { for (const st of Object.keys(DB.STORES)) await t.clear(st); await t.put('settings', { key: 'meta:seeded', value: true }); });
      await DB.loadSettings(); App.applyTheme(); App.applyBrand(); U.toast('تمام اطلاعات پاک شد.'); App.refresh();
    };
  }
};
