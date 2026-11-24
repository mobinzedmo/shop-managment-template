'use strict';
/* قالب فروشگاه | ابزارهای عمومی: اعداد فارسی، تقویم شمسی، نمایش پیام و پنجره‌ها */
const App = { settings: {} };
const U = {};
(function () {
  const FA = '۰۱۲۳۴۵۶۷۸۹';
  U.fa = s => String(s).replace(/\d/g, d => FA[d]);
  U.en = s => String(s).replace(/[۰-۹]/g, d => FA.indexOf(d)).replace(/[٠-٩]/g, d => '٠١٢٣٤٥٦٧٨٩'.indexOf(d)).replace(/٫/g, '.');
  U.num = s => { const v = parseFloat(U.en(s).replace(/[,٬\s]/g, '').replace(/[^\d.\-]/g, '')); return isFinite(v) ? v : 0; };
  U.fmt = n => U.fa(Math.round(Number(n) || 0).toLocaleString('en-US'));
  U.cur = () => (App.settings && App.settings.currency) || 'تومان';
  U.money = n => U.fmt(n) + ' ' + U.cur();
  U.pct = p => p == null ? '—' : U.fa((Math.round(p * 10) / 10).toString()).replace('.', '٫') + '٪';
  U.esc = s => String(s == null ? '' : s).replace(/[&<>"']/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
  U.uid = p => p + Date.now().toString(36) + Math.random().toString(36).slice(2, 7);
  U.pad = n => String(n).padStart(2, '0');
  U.$ = (s, r = document) => r.querySelector(s);
  U.$$ = (s, r = document) => Array.from(r.querySelectorAll(s));
  U.debounce = (fn, ms = 200) => { let t; return (...a) => { clearTimeout(t); t = setTimeout(() => fn(...a), ms); }; };
  U.profitPct = (buy, sell) => buy > 0 ? ((sell - buy) / buy) * 100 : null;

  /* ---------- تقویم جلالی (الگوریتم jalaali) ---------- */
  const div = (a, b) => ~~(a / b), mod = (a, b) => a - ~~(a / b) * b;
  function jalCal(jy) {
    const br = [-61, 9, 38, 199, 426, 686, 756, 818, 1111, 1181, 1210, 1635, 2060, 2097, 2192, 2262, 2324, 2394, 2456, 3178];
    const gy = jy + 621; let leapJ = -14, jp = br[0], jm, jump, n, i;
    for (i = 1; i < br.length; i++) { jm = br[i]; jump = jm - jp; if (jy < jm) break; leapJ += div(jump, 33) * 8 + div(mod(jump, 33), 4); jp = jm; }
    n = jy - jp; leapJ += div(n, 33) * 8 + div(mod(n, 33) + 3, 4);
    if (mod(jump, 33) === 4 && jump - n === 4) leapJ += 1;
    const leapG = div(gy, 4) - div((div(gy, 100) + 1) * 3, 4) - 150, march = 20 + leapJ - leapG;
    if (jump - n < 6) n = n - jump + div(jump + 4, 33) * 33;
    let leap = mod(mod(n + 1, 33) - 1, 4); if (leap === -1) leap = 4;
    return { leap, gy, march };
  }
  const g2d = (gy, gm, gd) => { let d = div((gy + div(gm - 8, 6) + 100100) * 1461, 4) + div(153 * mod(gm + 9, 12) + 2, 5) + gd - 34840408; return d - div(div(gy + 100100 + div(gm - 8, 6), 100) * 3, 4) + 752; };
  const d2g = jdn => { let j = 4 * jdn + 139361631; j += div(div(4 * jdn + 183187720, 146097) * 3, 4) * 4 - 3908; const i = div(mod(j, 1461), 4) * 5 + 308; const gd = div(mod(i, 153), 5) + 1, gm = mod(div(i, 153), 12) + 1; return { gy: div(j, 1461) - 100100 + div(8 - gm, 6), gm, gd }; };
  const j2d = (jy, jm, jd) => { const r = jalCal(jy); return g2d(r.gy, 3, r.march) + (jm - 1) * 31 - div(jm, 7) * (jm - 7) + jd - 1; };
  const d2j = jdn => {
    const g = d2g(jdn); let jy = g.gy - 621; const r = jalCal(jy); const f = g2d(g.gy, 3, r.march); let k = jdn - f, jm, jd;
    if (k >= 0) { if (k <= 185) { return { jy, jm: 1 + div(k, 31), jd: mod(k, 31) + 1 }; } k -= 186; }
    else { jy -= 1; k += 179; if (r.leap === 1) k += 1; }
    jm = 7 + div(k, 30); jd = mod(k, 30) + 1; return { jy, jm, jd };
  };
  U.jMonths = ['فروردین', 'اردیبهشت', 'خرداد', 'تیر', 'مرداد', 'شهریور', 'مهر', 'آبان', 'آذر', 'دی', 'بهمن', 'اسفند'];
  U.nowIso = () => { const d = new Date(); return `${d.getFullYear()}-${U.pad(d.getMonth() + 1)}-${U.pad(d.getDate())}T${U.pad(d.getHours())}:${U.pad(d.getMinutes())}:${U.pad(d.getSeconds())}`; };
  U.todayKey = () => U.nowIso().slice(0, 10);
  U.toJ = key => { const [y, m, d] = key.slice(0, 10).split('-').map(Number); return d2j(g2d(y, m, d)); };
  U.fromJ = (jy, jm, jd) => { const g = d2g(j2d(jy, jm, jd)); return `${g.gy}-${U.pad(g.gm)}-${U.pad(g.gd)}`; };
  U.jStr = key => { if (!key) return '—'; const j = U.toJ(key); return U.fa(`${j.jy}/${U.pad(j.jm)}/${U.pad(j.jd)}`); };
  U.jStrEn = key => { const j = U.toJ(key); return `${j.jy}-${U.pad(j.jm)}-${U.pad(j.jd)}`; };
  U.jTime = iso => iso ? U.jStr(iso) + ' ' + U.fa(iso.slice(11, 16)) : '—';
  U.parseJ = s => {
    const m = U.en(s).trim().match(/^(\d{4})[\/\-.](\d{1,2})[\/\-.](\d{1,2})$/); if (!m) return null;
    const jy = +m[1], jm = +m[2], jd = +m[3];
    const max = jm <= 6 ? 31 : jm <= 11 ? 30 : (jalCal(jy).leap === 0 ? 30 : 29);
    if (jm < 1 || jm > 12 || jd < 1 || jd > max) return null; return U.fromJ(jy, jm, jd);
  };
  U.jMonthKey = key => { const j = U.toJ(key); return `${j.jy}/${U.pad(j.jm)}`; };
  U.jMonthStart = (jy, jm) => U.fromJ(jy, jm, 1);
  U.jMonthLabel = mk => { const [y, m] = mk.split('/').map(Number); return U.jMonths[m - 1] + ' ' + U.fa(y); };
  U.addDays = (key, n) => { const [y, m, d] = key.split('-').map(Number); const t = new Date(Date.UTC(y, m - 1, d + n)); return `${t.getUTCFullYear()}-${U.pad(t.getUTCMonth() + 1)}-${U.pad(t.getUTCDate())}`; };

  /* ---------- عدد به حروف ---------- */
  const ones = ['', 'یک', 'دو', 'سه', 'چهار', 'پنج', 'شش', 'هفت', 'هشت', 'نه', 'ده', 'یازده', 'دوازده', 'سیزده', 'چهارده', 'پانزده', 'شانزده', 'هفده', 'هجده', 'نوزده'];
  const tens = ['', '', 'بیست', 'سی', 'چهل', 'پنجاه', 'شصت', 'هفتاد', 'هشتاد', 'نود'];
  const hund = ['', 'یکصد', 'دویست', 'سیصد', 'چهارصد', 'پانصد', 'ششصد', 'هفتصد', 'هشتصد', 'نهصد'];
  const scales = ['', 'هزار', 'میلیون', 'میلیارد', 'تریلیون'];
  const w3 = n => { const h = ~~(n / 100), r = n % 100, p = []; if (h) p.push(hund[h]); if (r) { if (r < 20) p.push(ones[r]); else { const t = ~~(r / 10), o = r % 10; p.push(tens[t] + (o ? ' و ' + ones[o] : '')); } } return p.join(' و '); };
  U.words = n => { n = Math.round(n); if (n === 0) return 'صفر'; if (n < 0) return 'منفی ' + U.words(-n); const parts = []; let i = 0; while (n > 0) { const c = n % 1000; if (c) parts.unshift(w3(c) + (scales[i] ? ' ' + scales[i] : '')); n = Math.floor(n / 1000); i++; } return parts.join(' و '); };

  /* ---------- آیکون‌ها ---------- */
  const I = {
    dashboard: '<rect x="3" y="3" width="7" height="8" rx="1.5"/><rect x="14" y="3" width="7" height="5" rx="1.5"/><rect x="14" y="12" width="7" height="9" rx="1.5"/><rect x="3" y="15" width="7" height="6" rx="1.5"/>',
    products: '<path d="M21 8l-9-5-9 5v8l9 5 9-5z"/><path d="M3 8l9 5 9-5M12 13v8"/>',
    inventory: '<path d="M12 3l9 5-9 5-9-5z"/><path d="M3 13l9 5 9-5M3 17.5l9 5 9-5" />',
    invoices: '<path d="M14 3H7a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h10a2 2 0 0 0 2-2V8z"/><path d="M14 3v5h5M9 13h6M9 17h4"/>',
    customers: '<circle cx="9" cy="8" r="3.5"/><path d="M2.5 20c0-3.6 2.9-6 6.5-6s6.5 2.4 6.5 6"/><circle cx="17.5" cy="9" r="2.5"/><path d="M17.5 14c2.6 0 4 1.7 4 4.5"/>',
    reports: '<path d="M4 20V10M10 20V4M16 20v-8M22 20H2"/>',
    settings: '<path d="M4 6h9M17 6h3M4 12h3M11 12h9M4 18h11M19 18h1"/><circle cx="15" cy="6" r="2"/><circle cx="9" cy="12" r="2"/><circle cx="17" cy="18" r="2"/>',
    bell: '<path d="M6 8a6 6 0 0 1 12 0c0 7 3 9 3 9H3s3-2 3-9"/><path d="M10 21a2 2 0 0 0 4 0"/>',
    moon: '<path d="M21 13A9 9 0 1 1 11 3a7 7 0 0 0 10 10z"/>',
    sun: '<circle cx="12" cy="12" r="4"/><path d="M12 2v2M12 20v2M2 12h2M20 12h2M5 5l1.5 1.5M17.5 17.5L19 19M5 19l1.5-1.5M17.5 6.5L19 5"/>',
    search: '<circle cx="11" cy="11" r="7"/><path d="M21 21l-4.3-4.3"/>',
    plus: '<path d="M12 5v14M5 12h14"/>', x: '<path d="M18 6L6 18M6 6l12 12"/>',
    edit: '<path d="M12 20h9"/><path d="M16.5 3.5a2.1 2.1 0 0 1 3 3L7 19l-4 1 1-4z"/>',
    trash: '<path d="M3 6h18M8 6V4h8v2M6 6l1 14h10l1-14M10 11v6M14 11v6"/>',
    eye: '<path d="M2 12s4-7 10-7 10 7 10 7-4 7-10 7S2 12 2 12z"/><circle cx="12" cy="12" r="3"/>',
    archive: '<rect x="3" y="4" width="18" height="4" rx="1"/><path d="M5 8v11h14V8M10 12h4"/>',
    restore: '<path d="M3 12a9 9 0 1 0 3-6.7L3 8"/><path d="M3 3v5h5"/>',
    printer: '<path d="M6 9V3h12v6M6 18H4a1 1 0 0 1-1-1v-6a2 2 0 0 1 2-2h14a2 2 0 0 1 2 2v6a1 1 0 0 1-1 1h-2"/><rect x="6" y="14" width="12" height="7"/>',
    download: '<path d="M12 3v12M7 10l5 5 5-5M4 21h16"/>', upload: '<path d="M12 15V3M7 8l5-5 5 5M4 21h16"/>',
    wallet: '<path d="M3 7a2 2 0 0 1 2-2h13v4"/><path d="M3 7v11a2 2 0 0 0 2 2h14a1 1 0 0 0 1-1V9a1 1 0 0 0-1-1H5a2 2 0 0 1-2-2z"/><circle cx="16.5" cy="14" r="1"/>',
    ban: '<circle cx="12" cy="12" r="9"/><path d="M5.6 5.6l12.8 12.8"/>',
    arrowIn: '<path d="M12 3v12M7 10l5 5 5-5M5 21h14"/>', arrowOut: '<path d="M12 15V3M7 8l5-5 5 5M5 21h14"/>', sliders: '<path d="M4 21v-7M4 10V3M12 21v-9M12 8V3M20 21v-5M20 12V3M1 14h6M9 8h6M17 16h6"/>',
    alert: '<path d="M12 3l10 18H2z"/><path d="M12 10v5M12 18h.01"/>', check: '<path d="M5 12l5 5 9-10"/>'
  };
  U.icon = (n, s = 18) => `<svg class="ic" width="${s}" height="${s}" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true">${I[n] || ''}</svg>`;

  /* ---------- پیام، پنجره، تأیید ---------- */
  U.toast = (msg, type = 'ok') => {
    const box = document.getElementById('toasts'), t = document.createElement('div');
    t.className = 'toast ' + type; t.textContent = msg; box.appendChild(t);
    setTimeout(() => { t.classList.add('out'); setTimeout(() => t.remove(), 300); }, type === 'err' ? 4800 : 3000);
  };
  U.modal = ({ title, body = '', footer = '', wide = false, onClose } = {}) => {
    const w = document.createElement('div'); w.className = 'modal-wrap';
    w.innerHTML = `<div class="modal ${wide ? 'wide' : ''}" role="dialog" aria-modal="true"><div class="modal-head"><h3>${title || ''}</h3><button class="icon-btn" data-close aria-label="بستن">${U.icon('x')}</button></div><div class="modal-body"></div><div class="modal-foot"></div></div>`;
    const bodyEl = w.querySelector('.modal-body'), foot = w.querySelector('.modal-foot');
    if (typeof body === 'string') bodyEl.innerHTML = body; else bodyEl.appendChild(body);
    if (footer) foot.innerHTML = footer; else foot.remove();
    const close = () => { if (!w.isConnected) return; w.remove(); onClose && onClose(); };
    w.addEventListener('mousedown', e => { if (e.target === w) close(); });
    w.querySelector('[data-close]').onclick = close;
    document.getElementById('modal-root').appendChild(w);
    return { el: w, body: bodyEl, foot, close };
  };
  U.confirm = (msg, { ok = 'تأیید', danger = false } = {}) => new Promise(res => {
    const m = U.modal({ title: 'تأیید عملیات', body: `<p class="confirm-msg">${msg}</p>`, footer: `<button class="btn" data-no>انصراف</button><button class="btn ${danger ? 'danger' : 'primary'}" data-yes>${ok}</button>`, onClose: () => res(false) });
    m.el.querySelector('[data-no]').onclick = () => m.close();
    m.el.querySelector('[data-yes]').onclick = () => { res(true); m.el.remove(); };
  });
  U.download = (blob, name) => { const a = document.createElement('a'); a.href = URL.createObjectURL(blob); a.download = name; document.body.appendChild(a); a.click(); setTimeout(() => { URL.revokeObjectURL(a.href); a.remove(); }, 1500); };
  U.readImage = (file, max = 480) => new Promise((res, rej) => {
    const r = new FileReader(); r.onerror = rej;
    r.onload = () => { const im = new Image(); im.onerror = rej; im.onload = () => { const k = Math.min(1, max / Math.max(im.width, im.height)); const c = document.createElement('canvas'); c.width = Math.round(im.width * k); c.height = Math.round(im.height * k); const x = c.getContext('2d'); x.fillStyle = '#fff'; x.fillRect(0, 0, c.width, c.height); x.drawImage(im, 0, 0, c.width, c.height); res(c.toDataURL('image/jpeg', 0.82)); }; im.src = r.result; };
    r.readAsDataURL(file);
  });
  /* فیلد عددی: با خروج از فیلد، جداکننده هزارگان و ارقام فارسی نمایش داده می‌شود */
  U.bindNum = (inp, dec = false) => {
    inp.addEventListener('blur', () => { inp.value = inp.value === '' ? '' : U.fmt(U.num(inp.value)); });
    inp.addEventListener('focus', () => { setTimeout(() => inp.select(), 0); });
  };
})();
