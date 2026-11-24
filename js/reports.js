'use strict';
/* قالب فروشگاه | نمودارها (SVG محلی)، داشبورد و گزارش‌ها */
const Charts = {
  compact(v) { const a = Math.abs(v); if (a >= 1e9) return U.fa((v / 1e9).toFixed(1).replace(/\.0$/, '')) + ' م‌م'; if (a >= 1e6) return U.fa((v / 1e6).toFixed(1).replace(/\.0$/, '')) + ' م'; if (a >= 1e3) return U.fa(Math.round(v / 1e3)) + ' ه'; return U.fa(Math.round(v)); },
  nice(m) { if (m <= 0) return 1; const p = Math.pow(10, Math.floor(Math.log10(m))), n = m / p; return (n <= 1 ? 1 : n <= 2 ? 2 : n <= 5 ? 5 : 10) * p; },
  /* نمودار میله‌ای/خطی. series: [{name,values,color}] */
  draw({ labels, series, type = 'bar', h = 230 }) {
    if (!labels.length || !series.some(s => s.values.some(v => v))) return '<div class="empty chart-empty">برای نمایش نمودار داده‌ای ثبت نشده است.</div>';
    const W = 640, pl = 54, pr = 10, pt = 12, pb = 32, iw = W - pl - pr, ih = h - pt - pb;
    const mx = this.nice(Math.max(...series.flatMap(s => s.values), 1)), mn = Math.min(0, ...series.flatMap(s => s.values)), lo = mn < 0 ? -this.nice(-mn) : 0, rng = mx - lo;
    const y = v => pt + ih - ((v - lo) / rng) * ih, n = labels.length, step = iw / n, every = Math.ceil(n / 10);
    let g = ''; for (let i = 0; i <= 4; i++) { const v = lo + rng * i / 4, yy = y(v); g += `<line x1="${pl}" x2="${W - pr}" y1="${yy}" y2="${yy}" class="grid"/><text x="${pl - 6}" y="${yy + 4}" text-anchor="end" class="ax">${this.compact(v)}</text>`; }
    labels.forEach((l, i) => { if (i % every === 0) g += `<text x="${pl + step * (i + .5)}" y="${h - 10}" text-anchor="middle" class="ax">${U.esc(l)}</text>`; });
    const ns = series.length;
    if (type === 'bar') series.forEach((s, si) => s.values.forEach((v, i) => { const bw = Math.min(34, step * .7 / ns), x = pl + step * i + (step - bw * ns) / 2 + bw * si, y0 = y(0), yy = y(v); g += `<rect x="${x}" y="${Math.min(y0, yy)}" width="${bw}" height="${Math.max(1, Math.abs(y0 - yy))}" rx="3" style="fill:${s.color}"><title>${U.esc(s.name)}: ${U.fmt(v)}</title></rect>`; }));
    else series.forEach(s => { const pts = s.values.map((v, i) => `${pl + step * (i + .5)},${y(v)}`); g += `<polyline points="${pts.join(' ')}" fill="none" style="stroke:${s.color}" stroke-width="2.5" stroke-linejoin="round"/>` + s.values.map((v, i) => `<circle cx="${pl + step * (i + .5)}" cy="${y(v)}" r="3.5" style="fill:${s.color}"><title>${U.esc(s.name)}: ${U.fmt(v)}</title></circle>`).join(''); });
    const legend = series.length > 1 ? `<div class="legend">${series.map(s => `<span><i style="background:${s.color}"></i>${U.esc(s.name)}</span>`).join('')}</div>` : '';
    return `<svg viewBox="0 0 ${W} ${h}" class="chart" role="img" preserveAspectRatio="xMidYMid meet">${g}</svg>${legend}`;
  }
};

/* داده‌های مشترک گزارش‌ها */
const Data = {
  async load() { const [invs, items, prods, cats, custs] = await Promise.all([DB.all('invoices'), DB.all('invoiceItems'), DB.all('products'), DB.all('categories'), DB.all('customers')]); const act = invs.filter(i => i.status !== 'canceled'); const ids = new Set(act.map(i => i.id)); return { invs, act, items: items.filter(i => ids.has(i.invoiceId)), prods, cats, custs }; },
  sum(list) { return { n: list.length, sales: list.reduce((s, i) => s + i.total, 0), cost: list.reduce((s, i) => s + (i.cost || 0), 0), profit: list.reduce((s, i) => s + (i.profit || 0), 0) }; },
  byMonth(list) { const m = {}; list.forEach(i => { const k = U.jMonthKey(i.date); (m[k] = m[k] || []).push(i); }); return m; },
  byDay(list) { const m = {}; list.forEach(i => { (m[i.date] = m[i.date] || []).push(i); }); return m; }
};
const C1 = 'var(--accent)', C2 = 'var(--gold)';

const Dashboard = {
  async render(c) {
    const d = await Data.load(); const prods = d.prods.filter(p => !p.archived);
    const today = U.todayKey(), tj = U.toJ(today), ms = U.jMonthStart(tj.jy, tj.jm); const month = d.act.filter(i => i.date >= ms && i.date <= today);
    const low = prods.filter(p => Inv.status(p) === 'low'), out = prods.filter(p => Inv.status(p) === 'out');
    const mSum = Data.sum(month), tSum = Data.sum(d.act.filter(i => i.date === today)); const value = prods.reduce((s, p) => s + p.stock * p.buyPrice, 0);
    const cards = [['تعداد کل محصولات', U.fa(prods.length), 'products'], ['ارزش کل موجودی انبار', U.money(value), 'inventory'], ['محصولات موجود', U.fa(prods.filter(p => p.stock > 0).length), 'check'], ['محصولات کم‌موجود', U.fa(low.length), 'alert', 'warn'], ['محصولات ناموجود', U.fa(out.length), 'ban', 'danger'], ['فاکتورهای ثبت‌شده', U.fa(d.act.length), 'invoices'], ['فروش امروز', U.money(tSum.sales), 'wallet'], ['فروش ماه جاری', U.money(mSum.sales), 'reports'], ['سود ناخالص ماه جاری', U.money(mSum.profit), 'dashboard']];
    // ۶ ماه اخیر
    const months = []; let y = tj.jy, m = tj.jm; for (let i = 0; i < 6; i++) { months.unshift(`${y}/${U.pad(m)}`); m--; if (m < 1) { m = 12; y--; } }
    const bm = Data.byMonth(d.act); const ms6 = months.map(k => Data.sum(bm[k] || []));
    const labels = months.map(k => U.jMonths[+k.split('/')[1] - 1]);
    const sold = {}; d.items.forEach(i => { const s = sold[i.productId] || (sold[i.productId] = { name: i.name, qty: 0, rev: 0 }); s.qty += i.qty; s.rev += i.final; }); const top = Object.values(sold).sort((a, b) => b.qty - a.qty).slice(0, 5); const tmax = Math.max(1, ...top.map(t => t.qty));
    const recent = d.invs.slice().sort((a, b) => b.createdAt.localeCompare(a.createdAt)).slice(0, 6); const txs = (await DB.all('inventoryTransactions')).sort((a, b) => b.date.localeCompare(a.date)).slice(0, 6);
    const notice = (await DB.get('settings', 'meta:sampleNotice')) && prods.some(p => p.sample) ? `<div class="alert-box info">${U.icon('alert')}<div>محصولات و مشتری فعلی <b>داده‌های نمونه</b> هستند و فقط برای آشنایی با امکانات ساخته شده‌اند. هر زمان بخواهید از «تنظیمات ← داده‌ها» حذفشان کنید.</div><button class="btn sm" id="dismiss">متوجه شدم</button></div>` : '';
    c.innerHTML = `<div class="page-head"><div><h2>داشبورد</h2><p class="muted">امروز ${U.jStr(today)} — خلاصهٔ وضعیت فروشگاه</p></div><div class="actions"><a class="btn primary" href="#/invoice/new">${U.icon('plus')} فاکتور جدید</a></div></div>${notice}
    <div class="cards c3">${cards.map(k => `<div class="stat ${k[3] || ''}"><div class="si">${U.icon(k[2], 20)}</div><div><span>${k[0]}</span><b>${k[1]}</b></div></div>`).join('')}</div>
    <div class="grid-2"><div class="panel"><h4>نمودار فروش ماهانه</h4>${Charts.draw({ labels, series: [{ name: 'فروش', values: ms6.map(x => x.sales), color: C1 }] })}</div>
      <div class="panel"><h4>نمودار سود ناخالص</h4>${Charts.draw({ labels, type: 'line', series: [{ name: 'سود', values: ms6.map(x => x.profit), color: C2 }] })}</div></div>
    <div class="grid-2"><div class="panel"><h4>پرفروش‌ترین محصولات</h4>${top.length ? top.map(t => `<div class="hbar"><span>${U.esc(t.name)}</span><div><i style="width:${t.qty / tmax * 100}%"></i></div><b>${U.fa(t.qty)}</b></div>`).join('') : '<p class="empty">هنوز فروشی ثبت نشده است.</p>'}</div>
      <div class="panel"><h4>محصولات رو به اتمام</h4>${[...out, ...low].length ? `<ul class="plain">${[...out, ...low].slice(0, 7).map(p => `<li><span>${U.esc(p.name)}</span><span>${U.fa(p.stock)} ${U.esc(p.unit)} ${Inv.badge(p)}</span></li>`).join('')}</ul>` : '<p class="empty">همهٔ محصولات موجودی کافی دارند.</p>'}</div></div>
    <div class="grid-2"><div class="panel"><h4>آخرین فاکتورهای فروش</h4>${recent.length ? `<ul class="plain">${recent.map(i => `<li><a href="#" data-inv="${i.id}" class="ltr">${i.number}</a><span>${U.esc(i.customerName || 'مشتری متفرقه')}</span><b>${U.money(i.total)}</b></li>`).join('')}</ul>` : '<p class="empty">فاکتوری ثبت نشده است.</p>'}</div>
      <div class="panel"><h4>آخرین تراکنش‌های انبار</h4>${txs.length ? `<ul class="plain">${txs.map(t => `<li><span>${U.esc(t.productName)}</span><span>${Inv.TYPES[t.type]}</span><b class="${t.qty > 0 ? 'pos' : 'neg'}">${t.qty > 0 ? '+' : '−'}${U.fa(Math.abs(t.qty))}</b></li>`).join('')}</ul>` : '<p class="empty">تراکنشی ثبت نشده است.</p>'}</div></div>`;
    c.querySelectorAll('[data-inv]').forEach(a => a.onclick = e => { e.preventDefault(); Invoices.open(a.dataset.inv); });
    const dm = c.querySelector('#dismiss'); if (dm) dm.onclick = async () => { await DB.put('settings', { key: 'meta:sampleNotice', value: false }); dm.closest('.alert-box').remove(); };
  }
};

const Reports = {
  tab: 'sales', range: { preset: 'month', from: '', to: '' },
  resolve() {
    const r = this.range, today = U.todayKey(), tj = U.toJ(today);
    if (r.preset === 'custom') return { from: U.parseJ(r.from) || '0000-01-01', to: U.parseJ(r.to) || '9999-12-31' };
    if (r.preset === 'today') return { from: today, to: today }; if (r.preset === '7') return { from: U.addDays(today, -6), to: today };
    if (r.preset === 'month') return { from: U.jMonthStart(tj.jy, tj.jm), to: today }; if (r.preset === '90') return { from: U.addDays(today, -89), to: today };
    if (r.preset === 'year') return { from: U.jMonthStart(tj.jy, 1), to: today }; return { from: '0000-01-01', to: '9999-12-31' };
  },
  async render(c) {
    const d = await Data.load(); const { from, to } = this.resolve(); const invs = d.act.filter(i => i.date >= from && i.date <= to); const ids = new Set(invs.map(i => i.id)); const items = d.items.filter(i => ids.has(i.invoiceId));
    const tabs = [['sales', 'فروش'], ['profit', 'سود'], ['products', 'محصولات'], ['stock', 'موجودی انبار'], ['debt', 'بدهی و پرداخت']];
    const pre = [['today', 'امروز'], ['7', '۷ روز اخیر'], ['month', 'ماه جاری'], ['90', '۳ ماه اخیر'], ['year', 'سال جاری'], ['all', 'همه'], ['custom', 'بازه دلخواه']];
    c.innerHTML = `<div class="page-head"><div><h2>گزارش‌ها</h2><p class="muted">بر پایهٔ داده‌های واقعی ثبت‌شده (فاکتورهای ابطال‌شده محاسبه نمی‌شوند)</p></div></div>
      <div class="toolbar wrap"><select class="inp" id="pre">${pre.map(p => `<option value="${p[0]}" ${this.range.preset === p[0] ? 'selected' : ''}>${p[1]}</option>`).join('')}</select>
      <span id="cust" ${this.range.preset === 'custom' ? '' : 'hidden'}>از <input class="inp sm" id="rf" placeholder="۱۴۰۵/۰۱/۰۱" value="${U.esc(this.range.from)}"> تا <input class="inp sm" id="rt" placeholder="۱۴۰۵/۱۲/۲۹" value="${U.esc(this.range.to)}"></span></div>
      <div class="tabs">${tabs.map(t => `<button data-tab="${t[0]}" class="${this.tab === t[0] ? 'on' : ''}">${t[1]}</button>`).join('')}</div><div id="rbody"></div>`;
    const body = c.querySelector('#rbody'); const re = () => this.render(c);
    c.querySelector('#pre').onchange = e => { this.range.preset = e.target.value; re(); };
    const rf = c.querySelector('#rf'), rt = c.querySelector('#rt'); [rf, rt].forEach(x => x.onchange = () => { this.range.from = rf.value; this.range.to = rt.value; re(); });
    c.querySelectorAll('[data-tab]').forEach(b => b.onclick = () => { this.tab = b.dataset.tab; re(); });
    const S = Data.sum(invs); const cardsHtml = (a) => `<div class="cards c4">${a.map(x => `<div class="stat"><span>${x[0]}</span><b>${x[1]}</b></div>`).join('')}</div>`;
    const tbl = (head, rows) => `<div class="table-wrap"><table class="tbl"><thead><tr>${head.map(h => `<th>${h}</th>`).join('')}</tr></thead><tbody>${rows.length ? rows.join('') : `<tr><td colspan="${head.length}" class="empty">داده‌ای در این بازه وجود ندارد.</td></tr>`}</tbody></table></div>`;
    const tr = a => `<tr>${a.map(x => `<td>${x}</td>`).join('')}</tr>`;
    if (this.tab === 'sales' || this.tab === 'profit') {
      const isP = this.tab === 'profit', day = Data.byDay(invs), dkeys = Object.keys(day).sort(), mon = Data.byMonth(invs), mkeys = Object.keys(mon).sort(); const key = isP ? 'profit' : 'sales';
      body.innerHTML = cardsHtml([['تعداد فاکتور', U.fa(S.n)], [isP ? 'درآمد فروش' : 'مجموع فروش', U.money(S.sales)], ...(isP ? [['بهای تمام‌شدهٔ کالا', U.money(S.cost)], ['سود ناخالص', U.money(S.profit)]] : [['میانگین فاکتور', U.money(S.n ? S.sales / S.n : 0)]])]) +
        `<div class="panel"><h4>${isP ? 'سود روزانه' : 'فروش روزانه'}</h4>${Charts.draw({ labels: dkeys.map(k => U.fa(U.jStr(k).slice(5))), series: [{ name: isP ? 'سود' : 'فروش', values: dkeys.map(k => Data.sum(day[k])[key]), color: isP ? C2 : C1 }] })}</div>
        <div class="grid-2"><div><h4>${isP ? 'سود روزانه' : 'فروش روزانه'} (جدول)</h4>${tbl(isP ? ['تاریخ', 'فروش', 'بهای تمام‌شده', 'سود'] : ['تاریخ', 'تعداد فاکتور', 'فروش'], dkeys.slice().reverse().map(k => { const s = Data.sum(day[k]); return tr(isP ? [U.jStr(k), U.money(s.sales), U.money(s.cost), U.money(s.profit)] : [U.jStr(k), U.fa(s.n), U.money(s.sales)]); }))}</div>
        <div><h4>${isP ? 'سود ماهانه' : 'فروش ماهانه'}</h4>${tbl(isP ? ['ماه', 'فروش', 'بهای تمام‌شده', 'سود'] : ['ماه', 'تعداد فاکتور', 'فروش'], mkeys.slice().reverse().map(k => { const s = Data.sum(mon[k]); return tr(isP ? [U.jMonthLabel(k), U.money(s.sales), U.money(s.cost), U.money(s.profit)] : [U.jMonthLabel(k), U.fa(s.n), U.money(s.sales)]); }))}</div></div>`;
    } else if (this.tab === 'products') {
      const sold = {}; items.forEach(i => { const s = sold[i.productId] || (sold[i.productId] = { qty: 0, rev: 0 }); s.qty += i.qty; s.rev += i.final - i.vat; });
      const list = d.prods.filter(p => !p.archived).map(p => ({ p, qty: (sold[p.id] || {}).qty || 0, rev: (sold[p.id] || {}).rev || 0 }));
      const best = list.filter(x => x.qty > 0).sort((a, b) => b.qty - a.qty).slice(0, 15), worst = list.slice().sort((a, b) => a.qty - b.qty).slice(0, 15);
      const row = (x, i) => tr([U.fa(i + 1), U.esc(x.p.name), U.fa(x.qty), U.money(x.rev)]);
      body.innerHTML = `<div class="grid-2"><div><h4>پرفروش‌ترین محصولات</h4>${tbl(['ردیف', 'محصول', 'تعداد فروش', 'درآمد'], best.map(row))}</div><div><h4>کم‌فروش‌ترین محصولات</h4>${tbl(['ردیف', 'محصول', 'تعداد فروش', 'درآمد'], worst.map(row))}</div></div>`;
    } else if (this.tab === 'stock') {
      const act = d.prods.filter(p => !p.archived), bv = act.reduce((s, p) => s + p.stock * p.buyPrice, 0), sv = act.reduce((s, p) => s + p.stock * p.sellPrice, 0);
      const lowL = act.filter(p => Inv.status(p) === 'low'), outL = act.filter(p => Inv.status(p) === 'out');
      body.innerHTML = cardsHtml([['ارزش موجودی (خرید)', U.money(bv)], ['ارزش موجودی (فروش)', U.money(sv)], ['کم‌موجود', U.fa(lowL.length)], ['ناموجود', U.fa(outL.length)]]) +
        `<div class="grid-2"><div><h4>ارزش موجودی به تفکیک دسته‌بندی</h4>${tbl(['دسته‌بندی', 'تعداد کالا', 'ارزش (خرید)'], d.cats.map(ct => { const l = act.filter(p => p.categoryId === ct.id); return tr([U.esc(ct.name), U.fa(l.reduce((s, p) => s + p.stock, 0)), U.money(l.reduce((s, p) => s + p.stock * p.buyPrice, 0))]); }))}</div>
        <div><h4>محصولات کم‌موجود</h4>${tbl(['محصول', 'موجودی', 'حداقل'], lowL.map(p => tr([U.esc(p.name), U.fa(p.stock), U.fa(p.minStock)])))}<h4>محصولات ناموجود</h4>${tbl(['محصول', 'کد'], outL.map(p => tr([U.esc(p.name), `<span class="ltr">${U.esc(p.code)}</span>`])))}</div></div>`;
    } else {
      const st = { paid: [0, 0], partial: [0, 0], unpaid: [0, 0] }; invs.forEach(i => { st[i.paymentStatus][0]++; st[i.paymentStatus][1] += i.total; });
      const all = d.act, debts = d.custs.map(cu => { const l = all.filter(i => i.customerId === cu.id && i.total > i.paid); return { cu, n: l.length, debt: l.reduce((s, i) => s + i.total - i.paid, 0) }; }).filter(x => x.debt > 0).sort((a, b) => b.debt - a.debt);
      const anon = all.filter(i => !i.customerId && i.total > i.paid).reduce((s, i) => s + i.total - i.paid, 0); const totalDebt = debts.reduce((s, x) => s + x.debt, 0) + anon;
      body.innerHTML = cardsHtml([['مجموع بدهی مشتریان (کل)', U.money(totalDebt)], ['پرداخت شده', `${U.fa(st.paid[0])} فاکتور`], ['پرداخت ناقص', `${U.fa(st.partial[0])} فاکتور`], ['پرداخت نشده', `${U.fa(st.unpaid[0])} فاکتور`]]) +
        `<div class="grid-2"><div><h4>وضعیت پرداخت فاکتورها (در بازه)</h4>${tbl(['وضعیت', 'تعداد', 'مبلغ'], Object.entries(st).map(([k, v]) => tr([InvoiceSheet.PAYMENT[k], U.fa(v[0]), U.money(v[1])])))}</div>
        <div><h4>بدهی مشتریان</h4>${tbl(['مشتری', 'فاکتور باز', 'بدهی'], [...debts.map(x => tr([U.esc(x.cu.name), U.fa(x.n), U.money(x.debt)])), ...(anon ? [tr(['مشتری متفرقه', '—', U.money(anon)])] : [])])}</div></div>`;
    }
  }
};
