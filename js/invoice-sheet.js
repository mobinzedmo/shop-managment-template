'use strict';
/* قالب فروشگاه | قالب فاکتور؛ بازسازی HTML فایل «faktor-2.xlsx» (صورت حساب فروش کالا و خدمات، A4 افقی) */
const InvoiceSheet = {
  PAYMENT: { paid: 'پرداخت شده', partial: 'پرداخت ناقص', unpaid: 'پرداخت نشده' },
  html(inv, items) {
    const s = App.settings, f = U.fmt, e = U.esc, cur = s.currency;
    const rows = []; const n = Math.max(6, items.length);
    for (let i = 0; i < n; i++) {
      const it = items[i];
      rows.push(it ? `<tr data-brk><td class="c b">${U.fa(i + 1)}</td><td class="c ltr">${e(it.code)}</td><td class="r">${e(it.name)}</td><td class="c">${U.fa(it.qty)}</td><td class="c">${e(it.unit || 'عدد')}</td><td class="c">${f(it.unitPrice)}</td><td class="c">${f(it.lineTotal)}</td><td class="c">${f(it.discount)}</td><td class="c">${f(it.vat)}</td><td class="c b">${f(it.final)}</td></tr>`
        : `<tr data-brk><td class="c b">${U.fa(i + 1)}</td>${'<td></td>'.repeat(9)}</tr>`);
    }
    const pay = inv.paymentStatus === 'partial' ? `پرداخت ناقص — پرداخت‌شده: ${U.money(inv.paid)} | باقی‌مانده: ${U.money(inv.total - inv.paid)}` : this.PAYMENT[inv.paymentStatus] || '';
    const cb = on => `<i class="cb ${on ? 'on' : ''}"></i>`;
    const cell = (l, v, cls = '') => `<div class="fld ${cls}"><span class="lb">${l}</span> <span class="vl">${v || ''}</span></div>`;
    const seller = s.tplSeller ? `
      <div class="bar">مشخصات فروشنده</div><div class="gap"></div>
      <div class="grid3" data-brk>${cell('نام شخص حقیقی /حقوقی :', e(s.shopName))}${cell('شماره اقتصادی :', U.fa(e(s.economicCode)))}${cell('شناسه ملی / شماره ملی :', U.fa(e(s.nationalId)))}
        ${cell('نشانی کامل : استان :', e(s.province) + '&nbsp;&nbsp;&nbsp;&nbsp;شهرستان : ' + e(s.city))}${cell('کد پستی 10 رقمی :', U.fa(e(s.postalCode)))}${cell('شهر :', e(s.city))}
        ${cell('نشانی :', e(s.address), 'span2')}${cell('شماره تلفن / نمابر :', U.fa(e(s.phone)))}</div><div class="gap"></div>` : '';
    const buyer = s.tplBuyer ? `
      <div class="bar">مشخصات خریدار</div><div class="gap"></div>
      <div class="grid3" data-brk>${cell('نام شخص حقیقی /حقوقی :', e(inv.customerName || 'مشتری متفرقه'))}${cell('شماره اقتصادی :', '')}${cell('شناسه ملی / شماره ملی :', U.fa(e(inv.customerNationalId || '')))}
        ${cell('نشانی کامل : استان :', '&nbsp;&nbsp;&nbsp;&nbsp;شهرستان : ')}${cell('کد پستی 10 رقمی :', '')}${cell('شهر :', '')}
        ${cell('نشانی :', e(inv.customerAddress || ''), 'span2')}${cell('شماره تلفن / نمابر :', U.fa(e(inv.customerPhone || '')))}</div><div class="gap"></div>` : '';
    return `<div class="inv-sheet" dir="rtl">
      <div class="bar title" data-brk>صورت حساب فروش کالا و خدمات</div>
      <div class="head" data-brk><div class="head-info"><div class="fld"><span class="lb">شماره سریال:</span> <b class="vl"><bdi dir="ltr">${e(inv.number)}</bdi></b></div><div class="fld"><span class="lb">تاریخ :</span> <b class="vl">${U.jStr(inv.date)}</b></div></div></div>
      ${seller}${buyer}
      <div class="bar">مشخصات کالا و خدمات مورد معامله</div>
      <table class="items"><colgroup><col style="width:4.2%"><col style="width:7%"><col style="width:26.8%"><col style="width:5%"><col style="width:5%"><col style="width:9%"><col style="width:10%"><col style="width:9%"><col style="width:9%"><col style="width:15%"></colgroup>
        <thead><tr><th>ردیف</th><th>کد کالا</th><th>شرح کالا یا خدمات</th><th>تعداد</th><th>واحد<br>اندازه گیری</th><th>مبلغ واحد<br>(${e(cur)})</th><th>مبلغ کل<br>(${e(cur)})</th><th>مبلغ تخفیف<br>(${e(cur)})</th><th>مبلغ<br>ارزش افزوده<br>(${e(cur)})</th><th>مبلغ کل پس از کسر<br>تخفیف و ارزش افزوده<br>(${e(cur)})</th></tr></thead>
        <tbody>${rows.join('')}</tbody></table>
      ${inv.discount > 0 ? `<div class="row tot sm" data-brk><span class="lb">تخفیف کلی فاکتور :</span> <b>${U.money(inv.discount)}</b></div>` : ''}
      <div class="row tot" data-brk><div><span class="lb">جمع کل (عدد):</span> <b>${U.money(inv.total)}</b></div><div class="paystat"><span class="lb">وضعیت پرداخت :</span> <b>${e(pay)}</b></div></div>
      <div class="row words" data-brk><span class="lb">جمع کل (حروف) :</span> <span>${U.words(inv.total)} ${e(cur)}</span></div>
      <div class="foot" data-brk><div class="terms"><span class="lb">شرایط و نحوه فروش :</span> <span class="opt">نقدی ${cb(inv.terms !== 'credit')}</span> <span class="opt">غیر نقدی ${cb(inv.terms === 'credit')}</span></div>
        <div class="notes"><span class="lb">توضیحات :</span> ${e(inv.notes || '')}</div></div>
      ${s.tplSignatures ? `<div class="sign" data-brk><div><span class="lb">مهر و امضاء فروشنده :</span></div><div><span class="lb">مهر و امضاء خریدار :</span></div></div>` : ''}
      ${inv.status === 'canceled' ? '<div class="stamp">ابطال شده</div>' : ''}
    </div>`;
  }
};
