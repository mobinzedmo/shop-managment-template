'use strict';
/* قالب فروشگاه | خروجی فاکتور: چاپ، PDF، PNG و JPG
   بدون کتابخانهٔ خارجی: فاکتور (HTML) با SVG foreignObject روی Canvas رسم می‌شود و PDF با یک نویسندهٔ سادهٔ داخلی ساخته می‌شود. */
const Exporter = {
  W: 1123, // عرض A4 افقی (۲۹۷ میلی‌متر) به پیکسل CSS
  async _b64(url) { try { const r = await fetch(url); if (!r.ok) return null; const b = await r.blob(); return await new Promise(res => { const f = new FileReader(); f.onload = () => res(f.result); f.readAsDataURL(b); }); } catch { return null; } },
  async _css() {
    let css = ''; try { css = await (await fetch('css/invoice.css')).text(); } catch { }
    let fonts = '';
    for (const [file, w] of [['Vazirmatn-Regular.woff2', 400], ['Vazirmatn-Bold.woff2', 700]]) { const d = await this._b64('assets/fonts/' + file); if (d) fonts += `@font-face{font-family:'Vazirmatn';font-weight:${w};src:url(${d}) format('woff2')}`; }
    return fonts + css;
  },
  /* رندر خارج از صفحه برای اندازه‌گیری و گرفتن نقاط شکست صفحه */
  _offscreen(inv, items) {
    const host = document.createElement('div'); host.style.cssText = `position:fixed;left:-30000px;top:0;width:${this.W}px;background:#fff`; host.innerHTML = InvoiceSheet.html(inv, items); document.body.appendChild(host);
    const sheet = host.firstElementChild; const top = sheet.getBoundingClientRect().top;
    const brk = Array.from(sheet.querySelectorAll('[data-brk]')).map(el => Math.round(el.getBoundingClientRect().bottom - top)).sort((a, b) => a - b);
    return { host, sheet, w: this.W, h: Math.ceil(sheet.getBoundingClientRect().height), brk };
  },
  async canvas(inv, items, scale = 3) {
    const o = this._offscreen(inv, items);
    try {
      const imgs = Array.from(o.sheet.querySelectorAll('img')); await Promise.all(imgs.map(async im => { const d = await this._b64(im.getAttribute('src')); if (d) im.setAttribute('src', d); }));
      if (document.fonts && document.fonts.ready) await document.fonts.ready;
      const css = await this._css(); const xml = new XMLSerializer().serializeToString(o.sheet);
      const svg = `<svg xmlns="http://www.w3.org/2000/svg" width="${o.w * scale}" height="${o.h * scale}" viewBox="0 0 ${o.w} ${o.h}"><foreignObject x="0" y="0" width="${o.w}" height="${o.h}"><div xmlns="http://www.w3.org/1999/xhtml" style="width:${o.w}px;background:#fff"><style><![CDATA[${css}]]></style>${xml}</div></foreignObject></svg>`;
      const img = new Image(); await new Promise((res, rej) => { img.onload = res; img.onerror = () => rej(new Error('render')); img.src = 'data:image/svg+xml;charset=utf-8,' + encodeURIComponent(svg); });
      const cv = document.createElement('canvas'); cv.width = o.w * scale; cv.height = o.h * scale; const x = cv.getContext('2d'); x.fillStyle = '#fff'; x.fillRect(0, 0, cv.width, cv.height); x.drawImage(img, 0, 0, cv.width, cv.height);
      return { cv, w: o.w, h: o.h, brk: o.brk, scale };
    } finally { o.host.remove(); }
  },
  name(inv, ext) { return `${inv.number}.${ext}`; },
  async png(inv, items) { const { cv } = await this.canvas(inv, items); const b = await new Promise(r => cv.toBlob(r, 'image/png')); U.download(b, this.name(inv, 'png')); U.toast('تصویر PNG فاکتور ذخیره شد.'); },
  async jpg(inv, items) { const { cv } = await this.canvas(inv, items); const b = await new Promise(r => cv.toBlob(r, 'image/jpeg', 0.95)); U.download(b, this.name(inv, 'jpg')); U.toast('تصویر JPG فاکتور ذخیره شد.'); },
  async pdf(inv, items) {
    const { cv, w, h, brk, scale } = await this.canvas(inv, items);
    const PW = 841.89, PH = 595.28, M = 12; let k = (PW - 2 * M) / w; const maxH = (PH - 2 * M) / k; const slices = [];
    if (h <= maxH * 1.12) { slices.push([0, h]); k = Math.min(k, (PH - 2 * M) / h); }
    else { let s = 0; while (s < h - 1) { const lim = s + maxH; if (lim >= h) { slices.push([s, h]); break; } const cands = brk.filter(b => b > s + 40 && b <= lim); const e = cands.length ? cands[cands.length - 1] : lim; slices.push([s, e]); s = e; } }
    const pages = [];
    for (const [a, b] of slices) {
      const c2 = document.createElement('canvas'); c2.width = cv.width; c2.height = Math.max(1, Math.round((b - a) * scale)); const x = c2.getContext('2d'); x.fillStyle = '#fff'; x.fillRect(0, 0, c2.width, c2.height); x.drawImage(cv, 0, Math.round(a * scale), cv.width, c2.height, 0, 0, cv.width, c2.height);
      const data = atob(c2.toDataURL('image/jpeg', 0.95).split(',')[1]); const bytes = new Uint8Array(data.length); for (let i = 0; i < data.length; i++) bytes[i] = data.charCodeAt(i);
      pages.push({ bytes, pw: c2.width, ph: c2.height, dw: PW - 2 * M, dh: (b - a) * k });
    }
    U.download(new Blob([this._pdf(pages, PW, PH, M)], { type: 'application/pdf' }), this.name(inv, 'pdf')); U.toast('فایل PDF فاکتور ذخیره شد.');
  },
  _pdf(pages, PW, PH, M) {
    const enc = new TextEncoder(), chunks = [], offs = []; let len = 0;
    const push = d => { const b = typeof d === 'string' ? enc.encode(d) : d; chunks.push(b); len += b.length; };
    push('%PDF-1.4\n');
    const obj = (n, fn) => { offs[n] = len; push(`${n} 0 obj\n`); fn(); push('\nendobj\n'); };
    const kids = pages.map((_, i) => `${3 + i * 3} 0 R`).join(' ');
    obj(1, () => push('<< /Type /Catalog /Pages 2 0 R >>')); obj(2, () => push(`<< /Type /Pages /Kids [${kids}] /Count ${pages.length} >>`));
    pages.forEach((p, i) => {
      const po = 3 + i * 3, co = po + 1, io = po + 2, y = PH - M - p.dh; const content = `q ${p.dw.toFixed(2)} 0 0 ${p.dh.toFixed(2)} ${M} ${y.toFixed(2)} cm /Im0 Do Q`;
      obj(po, () => push(`<< /Type /Page /Parent 2 0 R /MediaBox [0 0 ${PW} ${PH}] /Resources << /XObject << /Im0 ${io} 0 R >> >> /Contents ${co} 0 R >>`));
      obj(co, () => push(`<< /Length ${content.length} >>\nstream\n${content}\nendstream`));
      obj(io, () => { push(`<< /Type /XObject /Subtype /Image /Width ${p.pw} /Height ${p.ph} /ColorSpace /DeviceRGB /BitsPerComponent 8 /Filter /DCTDecode /Length ${p.bytes.length} >>\nstream\n`); push(p.bytes); push('\nendstream'); });
    });
    const total = 3 + pages.length * 3, xref = len; let x = `xref\n0 ${total}\n0000000000 65535 f \n`;
    for (let n = 1; n < total; n++) x += `${String(offs[n]).padStart(10, '0')} 00000 n \n`;
    push(x + `trailer\n<< /Size ${total} /Root 1 0 R >>\nstartxref\n${xref}\n%%EOF`);
    const out = new Uint8Array(len); let o = 0; chunks.forEach(c => { out.set(c, o); o += c.length; }); return out;
  },
  print(inv, items) {
    let root = document.getElementById('print-root'); if (!root) { root = document.createElement('div'); root.id = 'print-root'; document.body.appendChild(root); }
    root.innerHTML = InvoiceSheet.html(inv, items);
    const done = () => { root.innerHTML = ''; window.removeEventListener('afterprint', done); }; window.addEventListener('afterprint', done);
    const imgs = Array.from(root.querySelectorAll('img')); Promise.all(imgs.map(i => i.complete ? 1 : new Promise(r => { i.onload = i.onerror = r; }))).then(() => setTimeout(() => window.print(), 80));
  }
};
