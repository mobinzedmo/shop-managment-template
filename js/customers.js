'use strict';
/* قالب فروشگاه | مشتریان */
const Customers = {
  q: '',
  stats(cust, invoices) {
    const mine = invoices.filter(i => i.customerId === cust.id && i.status !== 'canceled');
    return { n: mine.length, total: mine.reduce((s, i) => s + i.total, 0), last: mine.reduce((m, i) => i.date > m ? i.date : m, ''), debt: mine.reduce((s, i) => s + (i.total - i.paid), 0) };
  },
  async render(c) {
    const [custs, invoices] = await Promise.all([DB.all('customers'), DB.all('invoices')]);
    c.innerHTML = `<div class="page-head"><div><h2>مشتریان</h2><p class="muted">اطلاعات مشتریان و تاریخچه خرید</p></div><div class="actions"><button class="btn primary" id="add">${U.icon('plus')} افزودن مشتری</button></div></div>
      <div class="toolbar"><input class="inp grow" id="q" placeholder="جستجو با نام یا شماره تلفن..." value="${U.esc(this.q)}"></div>
      <div class="table-wrap"><table class="tbl"><thead><tr><th>ردیف</th><th>نام و نام خانوادگی</th><th>شماره تلفن</th><th>تعداد فاکتور</th><th>مجموع خرید</th><th>بدهی</th><th>آخرین خرید</th><th>عملیات</th></tr></thead><tbody id="rows"></tbody></table></div>`;
    c.querySelector('#add').onclick = () => this.form(null);
    const rows = c.querySelector('#rows');
    const draw = () => {
      const q = U.en(this.q).trim().toLowerCase();
      const list = custs.filter(x => !q || x.name.toLowerCase().includes(q) || U.en(x.phone || '').includes(q)).sort((a, b) => a.name.localeCompare(b.name, 'fa'));
      rows.innerHTML = list.length ? list.map((x, i) => { const s = this.stats(x, invoices); return `<tr><td>${U.fa(i + 1)}</td><td><a href="#" data-v="${x.id}">${U.esc(x.name)}</a></td><td>${U.fa(U.esc(x.phone || '—'))}</td><td>${U.fa(s.n)}</td><td>${U.money(s.total)}</td><td class="${s.debt > 0 ? 'neg' : ''}">${s.debt > 0 ? U.money(s.debt) : '—'}</td><td>${s.last ? U.jStr(s.last) : '—'}</td>
        <td class="ops"><button class="icon-btn" title="تاریخچه خرید" data-v="${x.id}">${U.icon('eye')}</button><button class="icon-btn" title="ویرایش" data-e="${x.id}">${U.icon('edit')}</button><button class="icon-btn" title="حذف" data-x="${x.id}">${U.icon('trash')}</button></td></tr>`; }).join('') : '<tr><td colspan="8" class="empty">مشتری‌ای یافت نشد.</td></tr>';
    };
    draw(); c.querySelector('#q').oninput = U.debounce(e => { this.q = e.target.value; draw(); }, 120);
    rows.onclick = async e => {
      const el = e.target.closest('[data-v],[data-e],[data-x]'); if (!el) return; e.preventDefault();
      const id = el.dataset.v || el.dataset.e || el.dataset.x, x = custs.find(k => k.id === id);
      if (el.dataset.v) this.details(x, invoices); else if (el.dataset.e) this.form(x);
      else { if (invoices.some(i => i.customerId === id)) return U.toast('این مشتری فاکتور ثبت‌شده دارد و قابل حذف نیست.', 'err'); if (await U.confirm(`آیا از حذف «${U.esc(x.name)}» اطمینان دارید؟`, { ok: 'حذف', danger: true })) { await DB.del('customers', id); U.toast('مشتری حذف شد.'); App.refresh(); } }
    };
  },
  form(x, cb) {
    const d = x || { name: '', phone: '', description: '', address: '', nationalId: '' };
    const m = U.modal({ title: x ? 'ویرایش مشتری' : 'افزودن مشتری', body: `<div class="form grid2"><label>نام و نام خانوادگی *<input class="inp" id="n" value="${U.esc(d.name)}"></label><label>شماره تلفن<input class="inp" id="p" inputmode="tel" value="${U.esc(d.phone)}"></label>
      <label>کد ملی / شناسه ملی<input class="inp" id="nid" value="${U.esc(d.nationalId || '')}"></label><label>نشانی<input class="inp" id="a" value="${U.esc(d.address || '')}"></label><label class="full">توضیحات<textarea class="inp" id="d" rows="2">${U.esc(d.description)}</textarea></label></div>`, footer: '<button class="btn" data-x>انصراف</button><button class="btn primary" data-ok>ذخیره</button>' });
    m.el.querySelector('[data-x]').onclick = m.close; m.el.querySelector('#n').focus();
    m.el.querySelector('[data-ok]').onclick = async () => {
      const name = m.el.querySelector('#n').value.trim(); if (!name) return U.toast('نام مشتری را وارد کنید.', 'err');
      const rec = Object.assign({}, x || { id: U.uid('u'), createdAt: U.nowIso() }, { name, phone: m.el.querySelector('#p').value.trim(), nationalId: m.el.querySelector('#nid').value.trim(), address: m.el.querySelector('#a').value.trim(), description: m.el.querySelector('#d').value.trim() });
      await DB.put('customers', rec); U.toast('مشتری با موفقیت ثبت شد.'); m.close(); cb ? cb(rec) : App.refresh();
    };
  },
  details(x, invoices) {
    const s = this.stats(x, invoices); const mine = invoices.filter(i => i.customerId === x.id).sort((a, b) => b.date.localeCompare(a.date) || b.number.localeCompare(a.number));
    const m = U.modal({ wide: true, title: U.esc(x.name), body: `<div class="cards c4 mini"><div class="stat"><span>تعداد فاکتور</span><b>${U.fa(s.n)}</b></div><div class="stat"><span>مجموع خرید</span><b>${U.money(s.total)}</b></div><div class="stat ${s.debt > 0 ? 'danger' : ''}"><span>بدهی</span><b>${U.money(s.debt)}</b></div><div class="stat"><span>آخرین خرید</span><b>${s.last ? U.jStr(s.last) : '—'}</b></div></div>
      <p class="muted">تلفن: ${U.fa(U.esc(x.phone || '—'))} • ثبت: ${U.jStr((x.createdAt || '').slice(0, 10))}${x.description ? ' • ' + U.esc(x.description) : ''}</p>
      <h4>تاریخچه فاکتورها</h4><div class="table-wrap"><table class="tbl"><thead><tr><th>شماره</th><th>تاریخ</th><th>مبلغ نهایی</th><th>وضعیت</th><th></th></tr></thead><tbody>${mine.map(i => `<tr><td class="ltr">${i.number}</td><td>${U.jStr(i.date)}</td><td>${U.money(i.total)}</td><td>${Invoices.statusBadge(i)}</td><td class="ops"><button class="icon-btn" data-inv="${i.id}" title="مشاهده فاکتور">${U.icon('eye')}</button></td></tr>`).join('') || '<tr><td colspan="5" class="empty">فاکتوری ثبت نشده است.</td></tr>'}</tbody></table></div>` });
    m.body.onclick = e => { const b = e.target.closest('[data-inv]'); if (b) Invoices.open(b.dataset.inv); };
  }
};
