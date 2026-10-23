// Krishi Sales — a sales, credit (udhaar) and WhatsApp marketing tool for an
// agri-input shop (seeds, fertilizer, pesticide) selling wholesale and retail.
// Everything is stored in this browser. Use Settings → Backup regularly.
'use strict';

const STORE_KEY = 'krishi-sales-v1';
const CATEGORIES = ['Seeds', 'Fertilizer', 'Pesticide', 'Weedicide', 'Fungicide', 'Other'];

// Crop calendar for Narsinghpur (MP). Month index 0 = January.
// Farmers here save their own wheat and gram seed, so the Rabi sell is seed
// treatment, DAP, urea and weedicide; seed is mostly a Kharif (May–Jul) sale.
const SEASONS = [
  { months: [9, 10], title: 'Rabi sowing (Oct–Nov)', crops: ['Gram', 'Wheat', 'Masoor', 'Pea', 'Sugarcane', 'Tur'],
    needs: ['Seed treatment for saved gram & wheat seed (fungicide + Rhizobium)', 'DAP / NPK at sowing — book early, DAP runs short',
            'Termite control in wheat', 'Autumn sugarcane planting: fertilizer + sett treatment', 'Pod borer spray in standing tur'],
    sell: ['Fungicide', 'Fertilizer', 'Pesticide'] },
  { months: [11, 0], title: 'Rabi crop care (Dec–Jan)', crops: ['Gram', 'Wheat', 'Masoor', 'Pea', 'Tur'],
    needs: ['Urea top-dressing in wheat', 'Weedicide in wheat (25–35 days)', 'Pod borer (illi) in gram & tur',
            'Powdery mildew in pea', 'Wilt watch in gram & masoor'],
    sell: ['Fertilizer', 'Weedicide', 'Pesticide', 'Fungicide'] },
  { months: [1, 2], title: 'Rabi harvest + summer moong (Feb–Mar)', crops: ['Moong', 'Sugarcane', 'Wheat', 'Gram'],
    needs: ['Summer moong seed after wheat/gram harvest', 'Spring sugarcane planting', 'Rust spray in late wheat', 'DAP for moong'],
    sell: ['Seeds', 'Fertilizer', 'Fungicide'] },
  { months: [3, 4], title: 'Summer moong care + Kharif booking (Apr–May)', crops: ['Moong', 'Sugarcane', 'Maize', 'Soybean'],
    needs: ['Whitefly / thrips & yellow mosaic in moong', 'Early shoot borer in sugarcane',
            'Take advance bookings for maize & soybean seed', 'Retailer orders for Kharif seed & fertilizer'],
    sell: ['Pesticide', 'Seeds'] },
  { months: [5, 6], title: 'Kharif sowing (Jun–Jul)', crops: ['Maize', 'Soybean', 'Paddy', 'Tur', 'Urad'],
    needs: ['Maize hybrid seed (main seed season)', 'Soybean, paddy, tur, urad seed', 'DAP / NPK at sowing',
            'Pre-emergence weedicide (maize: atrazine)', 'Seed treatment'],
    sell: ['Seeds', 'Fertilizer', 'Weedicide'] },
  { months: [7, 8], title: 'Kharif crop care (Aug–Sep)', crops: ['Maize', 'Soybean', 'Paddy', 'Tur', 'Sugarcane'],
    needs: ['Urea top-dressing in maize & paddy', 'Fall armyworm in maize', 'Girdle beetle & semilooper in soybean',
            'Stem borer in paddy', 'Top borer & pyrilla in sugarcane'],
    sell: ['Fertilizer', 'Pesticide', 'Fungicide'] },
];

const TEMPLATES = {
  hi: {
    offer: 'नमस्ते {name} जी 🙏\n{season} का समय है। {product} हमारे यहाँ उपलब्ध है — सिर्फ ₹{price}/{unit}।\nअभी बुक करें, स्टॉक सीमित है।\n— {shop} {phone}',
    reminder: 'नमस्ते {name} जी 🙏\nआपका {shop} में ₹{amount} बाकी है। कृपया जल्द भुगतान करें।\nधन्यवाद — {phone}',
    winback: 'नमस्ते {name} जी 🙏\nकाफी दिन से आपसे मुलाकात नहीं हुई। इस हफ्ते {shop} पर नया स्टॉक आया है — बीज, खाद और दवाई सब उपलब्ध।\nआइए या फोन करें: {phone}',
    bill: 'नमस्ते {name} जी, {shop} से आपकी खरीद:\n{items}\nकुल: ₹{total}\nजमा: ₹{paid}\nबाकी (कुल उधार): ₹{balance}\nधन्यवाद 🙏',
  },
  en: {
    offer: 'Namaste {name} ji 🙏\nIt is {season} time. {product} is available at our shop for only ₹{price}/{unit}.\nBook now, stock is limited.\n— {shop} {phone}',
    reminder: 'Namaste {name} ji 🙏\nYou have ₹{amount} pending at {shop}. Please clear it soon.\nThank you — {phone}',
    winback: 'Namaste {name} ji 🙏\nWe have not seen you in a while. New stock of seeds, fertilizer and pesticide has arrived at {shop}.\nVisit or call: {phone}',
    bill: 'Namaste {name} ji, your purchase at {shop}:\n{items}\nTotal: ₹{total}\nPaid: ₹{paid}\nBalance (total udhaar): ₹{balance}\nThank you 🙏',
  },
};

// ---------- state ----------
function emptyState() {
  return { settings: { shop: 'Heera Krishak Bazar', phone: '', cc: '91', lang: 'hi', farmerCredit: 'no' },
           products: [], customers: [], sales: [], payments: [] };
}
let state = load();
let draftItems = [];
let saleCust = '';

function load() {
  try {
    const raw = localStorage.getItem(STORE_KEY);
    if (raw) { const d = JSON.parse(raw); return Object.assign(emptyState(), d, { settings: Object.assign(emptyState().settings, d.settings) }); }
  } catch (e) { /* storage blocked: start empty */ }
  return emptyState();
}
function save() {
  try { localStorage.setItem(STORE_KEY, JSON.stringify(state)); }
  catch (e) { toast('Could not save — browser storage is blocked. Use Backup.'); }
}

// ---------- helpers ----------
const $ = (sel, root = document) => root.querySelector(sel);
const uid = () => Date.now().toString(36) + Math.random().toString(36).slice(2, 7);
const today = () => new Date().toISOString().slice(0, 10);
const money = n => '₹' + Math.round(n).toLocaleString('en-IN');
const esc = s => String(s ?? '').replace(/[&<>"']/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
const daysSince = d => d ? Math.floor((Date.now() - new Date(d).getTime()) / 86400000) : Infinity;
const splitList = s => String(s || '').split(',').map(x => x.trim()).filter(Boolean);
const fill = (tpl, vars) => tpl.replace(/\{(\w+)\}/g, (m, k) => vars[k] ?? m);

function toast(msg) {
  const t = $('#toast');
  t.textContent = msg; t.hidden = false;
  clearTimeout(toast.t); toast.t = setTimeout(() => { t.hidden = true; }, 2500);
}
function customer(id) { return state.customers.find(c => c.id === id); }
function product(id) { return state.products.find(p => p.id === id); }
function balanceOf(cid) {
  let b = 0;
  for (const s of state.sales) if (s.customerId === cid) b += s.total - s.paid;
  for (const p of state.payments) if (p.customerId === cid) b -= p.amount;
  return b;
}
function lastBuy(cid) {
  return state.sales.filter(s => s.customerId === cid).map(s => s.date).sort().pop() || null;
}
function lastPayment(cid) {
  return state.payments.filter(p => p.customerId === cid).map(p => p.date).sort().pop() || null;
}
function waLink(phone, text) {
  let digits = String(phone || '').replace(/\D/g, '');
  if (digits.length === 10) digits = state.settings.cc + digits;
  return 'https://wa.me/' + digits + '?text=' + encodeURIComponent(text);
}
function currentSeason() {
  const m = new Date().getMonth();
  return SEASONS.find(s => s.months.includes(m));
}
function tpl(name) { return TEMPLATES[state.settings.lang]?.[name] || TEMPLATES.en[name]; }
function priceFor(p, c) { return c && c.type === 'wholesale' ? p.wholesale : p.retail; }

// ---------- views ----------
const views = {
  dashboard() {
    const t = today();
    const month = t.slice(0, 7);
    const todaySales = state.sales.filter(s => s.date === t).reduce((a, s) => a + s.total, 0);
    const monthSales = state.sales.filter(s => s.date.startsWith(month)).reduce((a, s) => a + s.total, 0);
    const dues = state.customers.map(c => ({ c, b: balanceOf(c.id) })).filter(x => x.b > 0.5);
    const totalDue = dues.reduce((a, x) => a + x.b, 0);
    const monthBills = state.sales.filter(s => s.date.startsWith(month));
    const named = monthBills.length ? Math.round(monthBills.filter(s => customer(s.customerId)?.phone).length / monthBills.length * 100) : 0;
    const lowStock = state.products.filter(p => Number(p.stock) <= Number(p.low || 0));

    // Product ranking for this month.
    const byProduct = {};
    for (const s of state.sales.filter(s => s.date.startsWith(month)))
      for (const it of s.items) byProduct[it.name] = (byProduct[it.name] || 0) + it.qty * it.price;
    const top = Object.entries(byProduct).sort((a, b) => b[1] - a[1]).slice(0, 5);

    // Follow-ups: overdue udhaar and customers who stopped buying.
    const collect = dues.filter(x => daysSince(lastPayment(x.c.id) || lastBuy(x.c.id)) >= 15)
      .sort((a, b) => b.b - a.b).slice(0, 8);
    const inactive = state.customers.filter(c => {
      const lb = lastBuy(c.id);
      return lb && daysSince(lb) >= 30 && daysSince(c.lastContact) >= 14;
    }).slice(0, 8);
    const season = currentSeason();

    return `
      <h2>Namaste! Here is your shop today</h2>
      <div class="stats">
        <div class="stat"><div class="label">Sales today</div><div class="value">${money(todaySales)}</div></div>
        <div class="stat"><div class="label">Sales this month</div><div class="value">${money(monthSales)}</div></div>
        <div class="stat warn"><div class="label">Udhaar to collect</div><div class="value">${money(totalDue)}</div></div>
        <div class="stat ${named < 80 ? 'warn' : ''}"><div class="label">Bills with name + mobile (month)</div><div class="value">${monthBills.length ? named + '%' : '—'}</div></div>
      </div>
      ${season ? `<div class="card season"><b>🌱 Season now: ${esc(season.title)}</b>
        <div class="muted">Farmers need:</div><ul>${season.needs.map(n => `<li>${esc(n)}</li>`).join('')}</ul>
        <div class="row" style="margin-top:8px"><button class="btn primary" data-go="campaign">Send season offer on WhatsApp →</button></div></div>` : ''}
      <div class="card"><h3 style="margin-top:0">💰 Collect money (udhaar older than 15 days)</h3>
        ${collect.length ? `<table>${collect.map(({ c, b }) => `<tr><td>${esc(c.name)} <span class="muted">${esc(c.village)}</span></td>
          <td class="num">${money(b)}</td><td class="num"><a class="btn wa small" target="_blank" rel="noopener" data-contact="${c.id}"
          href="${esc(waLink(c.phone, reminderText(c, b)))}">Remind</a></td></tr>`).join('')}</table>` : '<div class="empty">Nothing overdue. 👍</div>'}
      </div>
      <div class="card"><h3 style="margin-top:0">📞 Customers who stopped coming (30+ days)</h3>
        ${inactive.length ? `<table>${inactive.map(c => `<tr><td>${esc(c.name)} <span class="muted">${esc(c.village)}</span></td>
          <td class="muted">last bought ${daysSince(lastBuy(c.id))} days ago</td><td class="num"><a class="btn wa small" target="_blank" rel="noopener"
          data-contact="${c.id}" href="${esc(waLink(c.phone, fill(tpl('winback'), vars(c))))}">Message</a></td></tr>`).join('')}</table>` : '<div class="empty">Everyone is active.</div>'}
      </div>
      <div class="pair">
        <div class="card"><h3 style="margin-top:0">🏆 Best sellers this month</h3>
          ${top.length ? `<table>${top.map(([n, v]) => `<tr><td>${esc(n)}</td><td class="num">${money(v)}</td></tr>`).join('')}</table>` : '<div class="empty">No sales yet this month.</div>'}
        </div>
        <div class="card"><h3 style="margin-top:0">📦 Low stock — reorder</h3>
          ${lowStock.length ? `<table>${lowStock.map(p => `<tr><td>${esc(p.name)}</td><td class="num"><span class="pill red">${esc(p.stock)} ${esc(p.unit)}</span></td></tr>`).join('')}</table>` : '<div class="empty">Stock is fine.</div>'}
        </div>
      </div>
      ${!state.products.length ? `<div class="card">New here? <button class="btn" data-action="demo">Load demo data</button> to see how it works, or add your products and customers.</div>` : ''}
    `;
  },

  sale() {
    const custOpts = state.customers.map(c => `<option value="${c.id}">${esc(c.name)} — ${esc(c.village)} (${c.type})</option>`).join('');
    const prodOpts = state.products.map(p => `<option value="${p.id}">${esc(p.name)} (${esc(p.stock)} ${esc(p.unit)} left)</option>`).join('');
    const c = customer(saleCust);
    const total = draftItems.reduce((a, it) => a + it.qty * it.price, 0);
    return `
      <h2>New Bill</h2>
      <div class="card">
        <div class="grid2">
          <label>Customer<select id="saleCustomer"><option value="">New / walk-in farmer</option>${custOpts}</select></label>
          <label>Date<input id="saleDate" type="date" value="${today()}"></label>
        </div>
        ${!c ? `<div class="grid2" style="margin-top:10px">
          <label>Farmer name<input id="wName" placeholder="Always ask — so we can call again"></label>
          <label>Mobile<input id="wPhone" inputmode="tel"></label>
          <label>Village<input id="wVillage"></label>
          <label>Crops<input id="wCrops" placeholder="Gram, Wheat"></label>
        </div>` : ''}
        <h3>Add item</h3>
        ${state.products.length ? `<div class="grid2">
          <label>Product<select id="saleProduct">${prodOpts}</select></label>
          <label>Quantity<input id="saleQty" type="number" min="0" step="any" value="1"></label>
          <label>Price per unit (blank = auto)<input id="salePrice" type="number" min="0" step="any" placeholder="auto"></label>
          <div style="align-self:end"><button class="btn primary" data-action="addItem">+ Add</button></div>
        </div>` : '<div class="empty">Add products first (Products tab).</div>'}
        <div class="table-wrap"><table style="margin-top:12px">
          <tr><th>Item</th><th class="num">Qty</th><th class="num">Rate</th><th class="num">Amount</th><th></th></tr>
          ${draftItems.map((it, i) => `<tr><td>${esc(it.name)}</td><td class="num">${it.qty}</td><td class="num">${money(it.price)}</td>
            <td class="num">${money(it.qty * it.price)}</td><td class="num"><button class="btn small danger" data-action="rmItem" data-i="${i}">✕</button></td></tr>`).join('')}
        </table></div>
        <div class="row" style="margin-top:12px">
          <div class="billtotal">Total: ${money(total)}</div><div class="spacer"></div>
          <label style="max-width:200px">Paid now (rest = udhaar)<input id="salePaid" type="number" min="0" step="any" value="${total}"></label>
          <button class="btn primary" data-action="saveSale">Save bill</button>
        </div>
        ${c ? `<div class="muted" style="margin-top:8px">${esc(c.name)} already owes ${money(balanceOf(c.id))}. ${c.type === 'wholesale' ? 'Wholesale prices applied.' : 'Retail prices applied.'}</div>` : ''}
      </div>
      <h3>Recent bills</h3>
      <div class="card table-wrap">${recentSalesTable()}</div>
    `;
  },

  customers() {
    const q = (views.customers.q || '').toLowerCase();
    const list = state.customers.filter(c => !q || [c.name, c.village, c.phone, c.crops].join(' ').toLowerCase().includes(q));
    return `
      <h2>Customers</h2>
      <div class="card">
        <h3 style="margin-top:0">Add customer</h3>
        <form id="custForm" class="grid2">
          <label>Name<input name="name" required></label>
          <label>Phone (WhatsApp)<input name="phone" inputmode="tel"></label>
          <label>Village / Town<input name="village"></label>
          <label>Type<select name="type"><option value="retail">Kisan (retail)</option><option value="wholesale">Retailer / FPO (wholesale)</option></select></label>
          <label>Crops (comma separated)<input name="crops" placeholder="Wheat, Mustard"></label>
          <label>Land (acres)<input name="acres" type="number" step="any"></label>
          <div style="align-self:end"><button class="btn primary">Save</button></div>
        </form>
      </div>
      <input id="custSearch" placeholder="Search name, village, crop…" value="${esc(views.customers.q || '')}">
      <div class="card table-wrap" style="margin-top:10px">
        ${list.length ? `<table><tr><th>Name</th><th>Village</th><th>Type</th><th>Crops</th><th class="num">Udhaar</th><th class="num">Last buy</th><th></th></tr>
          ${list.map(c => { const b = balanceOf(c.id); const lb = lastBuy(c.id); return `<tr>
            <td>${esc(c.name)}<div class="muted">${esc(c.phone)}</div></td><td>${esc(c.village)}</td>
            <td><span class="pill ${c.type === 'wholesale' ? 'amber' : ''}">${c.type}</span></td>
            <td>${esc(c.crops)}</td><td class="num">${b > 0.5 ? `<span class="pill red">${money(b)}</span>` : '—'}</td>
            <td class="num">${lb ? daysSince(lb) + 'd ago' : '—'}</td>
            <td class="num"><button class="btn small danger" data-action="delCust" data-id="${c.id}">Delete</button></td></tr>`; }).join('')}</table>`
          : '<div class="empty">No customers yet.</div>'}
      </div>`;
  },

  products() {
    return `
      <h2>Products & Stock</h2>
      <div class="card">
        <h3 style="margin-top:0">Add product</h3>
        <form id="prodForm" class="grid2">
          <label>Name<input name="name" required placeholder="DAP 50kg"></label>
          <label>Category<select name="category">${CATEGORIES.map(c => `<option>${c}</option>`).join('')}</select></label>
          <label>Company / Brand<input name="brand"></label>
          <label>Unit<input name="unit" value="bag"></label>
          <label>Retail price ₹<input name="retail" type="number" step="any" required></label>
          <label>Wholesale price ₹<input name="wholesale" type="number" step="any" required></label>
          <label>Buying cost ₹<input name="cost" type="number" step="any"></label>
          <label>Stock<input name="stock" type="number" step="any" value="0"></label>
          <label>Low-stock alert at<input name="low" type="number" step="any" value="5"></label>
          <label>For crops (comma separated)<input name="crops" placeholder="Wheat, Paddy"></label>
          <div style="align-self:end"><button class="btn primary">Save</button></div>
        </form>
      </div>
      <div class="card table-wrap">
        ${state.products.length ? `<table><tr><th>Product</th><th>Category</th><th class="num">Retail</th><th class="num">Wholesale</th><th class="num">Margin</th><th class="num">Stock</th><th></th></tr>
          ${state.products.map(p => { const m = p.cost ? Math.round((p.retail - p.cost) / p.retail * 100) : null; return `<tr>
            <td>${esc(p.name)}<div class="muted">${esc(p.brand)} ${p.crops ? '· ' + esc(p.crops) : ''}</div></td><td>${esc(p.category)}</td>
            <td class="num">${money(p.retail)}</td><td class="num">${money(p.wholesale)}</td><td class="num">${m === null ? '—' : m + '%'}</td>
            <td class="num"><span class="pill ${Number(p.stock) <= Number(p.low || 0) ? 'red' : ''}">${esc(p.stock)} ${esc(p.unit)}</span></td>
            <td class="num"><button class="btn small" data-action="addStock" data-id="${p.id}">+ Stock</button>
              <button class="btn small danger" data-action="delProd" data-id="${p.id}">Delete</button></td></tr>`; }).join('')}</table>`
          : '<div class="empty">No products yet.</div>'}
      </div>`;
  },

  udhaar() {
    const dues = state.customers.map(c => ({ c, b: balanceOf(c.id) })).filter(x => x.b > 0.5).sort((a, b) => b.b - a.b);
    const total = dues.reduce((a, x) => a + x.b, 0);
    return `
      <h2>Udhaar (credit) — ${money(total)} outstanding</h2>
      <div class="card table-wrap">
        ${dues.length ? `<table><tr><th>Customer</th><th class="num">Balance</th><th class="num">Last payment</th><th>Receive payment</th><th></th></tr>
          ${dues.map(({ c, b }) => { const lp = lastPayment(c.id); return `<tr>
            <td>${esc(c.name)}<div class="muted">${esc(c.village)} · ${esc(c.phone)}</div></td>
            <td class="num"><b>${money(b)}</b></td><td class="num">${lp ? daysSince(lp) + 'd ago' : 'never'}</td>
            <td><div class="row"><input type="number" step="any" min="0" placeholder="₹" style="max-width:110px" id="pay-${c.id}">
              <button class="btn small primary" data-action="pay" data-id="${c.id}">Received</button></div></td>
            <td class="num"><a class="btn wa small" target="_blank" rel="noopener" data-contact="${c.id}" href="${esc(waLink(c.phone, reminderText(c, b)))}">WhatsApp reminder</a></td></tr>`; }).join('')}</table>`
          : '<div class="empty">No pending udhaar. 🎉</div>'}
      </div>`;
  },

  campaign() {
    const season = currentSeason();
    const crops = [...new Set([...(season?.crops || []), ...state.customers.flatMap(c => splitList(c.crops))])];
    const st = views.campaign;
    const prod = product(st.productId) || state.products.find(p => season?.sell.includes(p.category)) || state.products[0];
    const crop = st.crop ?? (season?.crops.find(cr => state.customers.some(c => splitList(c.crops).map(x => x.toLowerCase()).includes(cr.toLowerCase()))) || '');
    const type = st.type || 'all';
    const targets = state.customers.filter(c =>
      (type === 'all' || c.type === type) &&
      (!crop || splitList(c.crops).map(x => x.toLowerCase()).includes(crop.toLowerCase())) && c.phone);
    const message = st.message || tpl('offer');
    return `
      <h2>Sell More — WhatsApp offers</h2>
      ${season ? `<div class="card season"><b>🌱 ${esc(season.title)}</b> — best to push: ${season.sell.join(', ')}
        <ul>${season.needs.map(n => `<li>${esc(n)}</li>`).join('')}</ul></div>` : ''}
      <div class="card">
        <div class="grid2">
          <label>Product to promote<select id="cProduct">${state.products.map(p => `<option value="${p.id}" ${p === prod ? 'selected' : ''}>${esc(p.name)}</option>`).join('')}</select></label>
          <label>Farmers growing<select id="cCrop"><option value="">Any crop</option>${crops.map(c => `<option ${c === crop ? 'selected' : ''}>${esc(c)}</option>`).join('')}</select></label>
          <label>Customer type<select id="cType">
            <option value="all" ${type === 'all' ? 'selected' : ''}>All</option>
            <option value="retail" ${type === 'retail' ? 'selected' : ''}>Kisan (retail)</option>
            <option value="wholesale" ${type === 'wholesale' ? 'selected' : ''}>Dukandar (wholesale)</option></select></label>
        </div>
        <label style="margin-top:10px">Message (you can edit — {name}, {product}, {price}, {unit}, {season}, {shop}, {phone} are filled in automatically)
          <textarea id="cMessage">${esc(message)}</textarea></label>
        <div class="row" style="margin-top:6px"><button class="btn small" data-action="resetMsg">Reset message</button></div>
      </div>
      <h3>${targets.length} customers match — tap each to send on WhatsApp</h3>
      <div class="card table-wrap">
        ${!prod ? '<div class="empty">Add a product first.</div>' : targets.length ? `<table>${targets.map(c => {
          const text = fill(message, { ...vars(c), product: prod.name, price: priceFor(prod, c), unit: prod.unit, season: season?.title || '' });
          return `<tr><td>${esc(c.name)} <span class="muted">${esc(c.village)} · ${esc(c.crops)}</span></td>
            <td class="muted">${c.lastContact ? 'messaged ' + daysSince(c.lastContact) + 'd ago' : ''}</td>
            <td class="num"><a class="btn wa small" target="_blank" rel="noopener" data-contact="${c.id}" href="${esc(waLink(c.phone, text))}">Send</a></td></tr>`;
        }).join('')}</table>` : '<div class="empty">No customers with a phone number match this filter. Add crops to your customers.</div>'}
      </div>`;
  },

  settings() {
    const s = state.settings;
    return `
      <h2>Settings</h2>
      <form id="setForm" class="card grid2">
        <label>Shop name<input name="shop" value="${esc(s.shop)}"></label>
        <label>Shop phone<input name="phone" value="${esc(s.phone)}"></label>
        <label>Country code for WhatsApp<input name="cc" value="${esc(s.cc)}"></label>
        <label>Message language<select name="lang"><option value="hi" ${s.lang === 'hi' ? 'selected' : ''}>हिन्दी</option><option value="en" ${s.lang === 'en' ? 'selected' : ''}>English</option></select></label>
        <label>Udhaar for farmers<select name="farmerCredit"><option value="no" ${s.farmerCredit !== 'yes' ? 'selected' : ''}>No — retailers only</option><option value="yes" ${s.farmerCredit === 'yes' ? 'selected' : ''}>Yes</option></select></label>
        <div style="align-self:end"><button class="btn primary">Save</button></div>
      </form>
      <div class="card">
        <h3 style="margin-top:0">Backup</h3>
        <p class="muted">Your data lives only in this browser. Download a backup every week and keep it safe (e.g. send it to yourself on WhatsApp or Google Drive).</p>
        <div class="row">
          <button class="btn primary" data-action="export">Download backup</button>
          <label class="btn" style="color:var(--ink)">Restore backup<input type="file" id="importFile" accept=".json" hidden></label>
          <button class="btn" data-action="exportCsv">Download customers (CSV)</button>
          <div class="spacer"></div>
          <button class="btn" data-action="demo">Load demo data</button>
          <button class="btn danger" data-action="wipe">Delete all data</button>
        </div>
      </div>`;
  },
};

function vars(c) {
  return { name: c.name, shop: state.settings.shop, phone: state.settings.phone };
}
function reminderText(c, amount) {
  return fill(tpl('reminder'), { ...vars(c), amount: Math.round(amount).toLocaleString('en-IN') });
}
function recentSalesTable() {
  const recent = state.sales.slice(-10).reverse();
  if (!recent.length) return '<div class="empty">No bills yet.</div>';
  return `<table><tr><th>Date</th><th>Customer</th><th>Items</th><th class="num">Total</th><th class="num">Paid</th><th></th></tr>
    ${recent.map(s => { const c = customer(s.customerId); return `<tr><td>${s.date}</td><td>${c ? esc(c.name) : 'Walk-in'}</td>
      <td>${s.items.map(i => esc(i.name) + ' × ' + i.qty).join(', ')}</td><td class="num">${money(s.total)}</td><td class="num">${money(s.paid)}</td>
      <td class="num">${c && c.phone ? `<a class="btn wa small" target="_blank" rel="noopener" href="${esc(waLink(c.phone, billText(s, c)))}">Send bill</a>` : ''}
      <button class="btn small danger" data-action="delSale" data-id="${s.id}">Delete</button></td></tr>`; }).join('')}</table>`;
}
function billText(s, c) {
  return fill(tpl('bill'), { ...vars(c),
    items: s.items.map(i => `• ${i.name} × ${i.qty} = ₹${Math.round(i.qty * i.price)}`).join('\n'),
    total: Math.round(s.total), paid: Math.round(s.paid), balance: Math.round(balanceOf(c.id)) });
}

// ---------- rendering & events ----------
let tab = 'dashboard';
function render() {
  $('#shopTitle').textContent = state.settings.shop || 'Krishi Sales';
  document.querySelectorAll('#tabs button').forEach(b => b.classList.toggle('active', b.dataset.tab === tab));
  $('#view').innerHTML = views[tab]();
  if (tab === 'sale') $('#saleCustomer').value = saleCust;
}
function go(t) { tab = t; render(); window.scrollTo(0, 0); }

$('#tabs').addEventListener('click', e => { if (e.target.dataset.tab) go(e.target.dataset.tab); });

document.addEventListener('click', e => {
  const goto = e.target.closest('[data-go]');
  if (goto) return go(goto.dataset.go);
  const contact = e.target.closest('[data-contact]');
  if (contact) { const c = customer(contact.dataset.contact); if (c) { c.lastContact = today(); save(); } }
  const el = e.target.closest('[data-action]');
  if (!el) return;
  const a = el.dataset.action;
  if (actions[a]) { e.preventDefault(); actions[a](el); }
});

document.addEventListener('submit', e => {
  e.preventDefault();
  const data = Object.fromEntries(new FormData(e.target));
  if (e.target.id === 'custForm') {
    state.customers.push({ id: uid(), name: data.name.trim(), phone: data.phone.trim(), village: data.village.trim(),
      type: data.type, crops: splitList(data.crops).join(', '), acres: data.acres, lastContact: null, created: today() });
    toast('Customer saved');
  } else if (e.target.id === 'prodForm') {
    state.products.push({ id: uid(), name: data.name.trim(), category: data.category, brand: data.brand.trim(), unit: data.unit.trim() || 'unit',
      retail: +data.retail, wholesale: +data.wholesale, cost: data.cost ? +data.cost : null, stock: +data.stock || 0,
      low: +data.low || 0, crops: splitList(data.crops).join(', ') });
    toast('Product saved');
  } else if (e.target.id === 'setForm') {
    Object.assign(state.settings, data);
    toast('Settings saved');
  }
  save(); render();
});

document.addEventListener('input', e => {
  if (e.target.id === 'custSearch') {
    views.customers.q = e.target.value;
    const pos = e.target.selectionStart; render();
    const s = $('#custSearch'); s.focus(); s.setSelectionRange(pos, pos);
  }
  if (e.target.id === 'cMessage') { views.campaign.message = e.target.value; }
});
document.addEventListener('change', e => {
  const id = e.target.id;
  if (id === 'cProduct') { views.campaign.productId = e.target.value; render(); }
  if (id === 'cCrop') { views.campaign.crop = e.target.value; render(); }
  if (id === 'cType') { views.campaign.type = e.target.value; render(); }
  if (id === 'cMessage') { render(); }
  if (id === 'saleCustomer') {
    // Re-price items for the selected customer's type.
    saleCust = e.target.value;
    const c = customer(saleCust);
    draftItems.forEach(it => { const p = product(it.productId); if (p && !it.custom) it.price = priceFor(p, c); });
    render();
  }
  if (id === 'importFile' && e.target.files[0]) {
    e.target.files[0].text().then(txt => {
      try { const d = JSON.parse(txt); if (!Array.isArray(d.customers)) throw 0; state = Object.assign(emptyState(), d); save(); render(); toast('Backup restored'); }
      catch { toast('That file is not a valid backup'); }
    });
  }
});

const actions = {
  addItem() {
    const p = product($('#saleProduct').value);
    const qty = parseFloat($('#saleQty').value);
    if (!p || !(qty > 0)) return toast('Pick a product and quantity');
    const custom = $('#salePrice').value !== '';
    const price = custom ? parseFloat($('#salePrice').value) : priceFor(p, customer(saleCust));
    draftItems.push({ productId: p.id, name: p.name, qty, price, custom });
    render();
  },
  rmItem(el) { draftItems.splice(+el.dataset.i, 1); render(); },
  saveSale() {
    if (!draftItems.length) return toast('Add at least one item');
    const total = draftItems.reduce((a, it) => a + it.qty * it.price, 0);
    let cid = saleCust || null;
    const paid = Math.min(Math.max(parseFloat($('#salePaid').value) || 0, 0), total);
    if (!cid) {
      // Turn a walk-in into a known customer whenever a name or mobile is given.
      const name = $('#wName').value.trim(), phone = $('#wPhone').value.trim();
      if (paid < total) return toast('A walk-in bill must be fully paid.');
      if (name || phone) {
        const digits = phone.replace(/\D/g, '').slice(-10);
        const existing = digits && state.customers.find(c => c.phone.replace(/\D/g, '').slice(-10) === digits);
        if (existing) cid = existing.id;
        else {
          cid = uid();
          state.customers.push({ id: cid, name: name || 'Farmer ' + digits, phone, village: $('#wVillage').value.trim(), type: 'retail',
            crops: splitList($('#wCrops').value).join(', '), acres: '', lastContact: null, created: today() });
        }
      }
    } else if (paid < total && customer(cid).type === 'retail' && state.settings.farmerCredit !== 'yes') {
      return toast('Farmer credit is off (Settings). Only retailers can take udhaar.');
    }
    const sale = { id: uid(), date: $('#saleDate').value || today(), customerId: cid, items: draftItems, total, paid };
    state.sales.push(sale);
    for (const it of draftItems) { const p = product(it.productId); if (p) p.stock = +(p.stock - it.qty).toFixed(3); }
    draftItems = []; saleCust = '';
    save(); render();
    const c = customer(cid);
    toast('Bill saved' + (c && c.phone ? ' — tap "Send bill" to WhatsApp it' : ''));
  },
  delSale(el) {
    const s = state.sales.find(x => x.id === el.dataset.id);
    if (!s || !confirm('Delete this bill? Stock will be added back.')) return;
    for (const it of s.items) { const p = product(it.productId); if (p) p.stock = +(Number(p.stock) + it.qty).toFixed(3); }
    state.sales = state.sales.filter(x => x !== s); save(); render();
  },
  delCust(el) {
    const c = customer(el.dataset.id);
    if (!c) return;
    if (balanceOf(c.id) > 0.5) return toast('This customer still has udhaar. Clear it first.');
    if (!confirm('Delete ' + c.name + '?')) return;
    state.customers = state.customers.filter(x => x !== c); save(); render();
  },
  delProd(el) {
    const p = product(el.dataset.id);
    if (p && confirm('Delete ' + p.name + '?')) { state.products = state.products.filter(x => x !== p); save(); render(); }
  },
  addStock(el) {
    const p = product(el.dataset.id);
    const n = parseFloat(prompt('How many ' + p.unit + ' of ' + p.name + ' arrived?', '10'));
    if (n > 0) { p.stock = +(Number(p.stock) + n).toFixed(3); save(); render(); toast('Stock updated'); }
  },
  pay(el) {
    const id = el.dataset.id;
    const amt = parseFloat($('#pay-' + id).value);
    if (!(amt > 0)) return toast('Enter the amount received');
    state.payments.push({ id: uid(), customerId: id, amount: amt, date: today() });
    save(); render(); toast('Payment of ' + money(amt) + ' recorded');
  },
  resetMsg() { views.campaign.message = ''; render(); },
  export() {
    download('krishi-sales-backup-' + today() + '.json', JSON.stringify(state, null, 1), 'application/json');
  },
  exportCsv() {
    const rows = [['Name', 'Phone', 'Village', 'Type', 'Crops', 'Acres', 'Udhaar', 'Last buy']]
      .concat(state.customers.map(c => [c.name, c.phone, c.village, c.type, c.crops, c.acres, Math.round(balanceOf(c.id)), lastBuy(c.id) || '']));
    download('customers-' + today() + '.csv', rows.map(r => r.map(v => '"' + String(v ?? '').replace(/"/g, '""') + '"').join(',')).join('\n'), 'text/csv');
  },
  wipe() {
    if (confirm('Delete ALL data? Download a backup first!') && confirm('Are you sure? This cannot be undone.')) { state = emptyState(); save(); render(); }
  },
  demo() {
    if (state.products.length && !confirm('Replace current data with demo data?')) return;
    state = demoData(); save(); render(); toast('Demo data loaded');
  },
};

function download(name, text, type) {
  const a = document.createElement('a');
  a.href = URL.createObjectURL(new Blob([text], { type }));
  a.download = name; a.click();
  setTimeout(() => URL.revokeObjectURL(a.href), 1000);
}

function demoData() {
  // Sample data only: names and phone numbers are made up. DAP/urea are at
  // government MRP; other prices are examples — replace with your own.
  const d = emptyState();
  d.settings.phone = '';
  const P = (name, category, brand, unit, retail, wholesale, cost, stock, low, crops) =>
    ({ id: uid(), name, category, brand, unit, retail, wholesale, cost, stock, low, crops });
  d.products = [
    P('DAP 50kg', 'Fertilizer', 'Coromandel', 'bag', 1350, 1330, 1290, 60, 20, 'Gram, Wheat, Masoor, Maize'),
    P('Urea 45kg', 'Fertilizer', 'NFL', 'bag', 266.5, 266.5, 255, 150, 30, 'Wheat, Maize, Paddy, Sugarcane'),
    P('NPK 12:32:16 50kg', 'Fertilizer', 'Coromandel', 'bag', 1720, 1690, 1640, 25, 10, 'Gram, Wheat, Sugarcane'),
    P('Dekalb 9126 maize 4kg', 'Seeds', 'Bayer', 'packet', 1850, 1800, 1700, 8, 10, 'Maize'),
    P('Seed treatment fungicide 250g', 'Fungicide', 'Tata Rallis', 'packet', 290, 270, 245, 40, 10, 'Gram, Wheat, Masoor'),
    P('Emamectin benzoate 5SG 250g', 'Pesticide', 'IIL', 'packet', 620, 590, 550, 22, 6, 'Gram, Tur, Maize'),
    P('Wheat weedicide (Clodinafop+Metsulfuron)', 'Weedicide', 'Tata Rallis', 'acre pack', 480, 455, 420, 30, 8, 'Wheat'),
  ];
  const C = (name, phone, village, type, crops, acres) => ({ id: uid(), name, phone, village, type, crops, acres, lastContact: null, created: today() });
  d.customers = [
    C('Demo Kisan 1', '9800000001', 'Dhamna', 'retail', 'Gram, Wheat, Sugarcane', 40),
    C('Demo Kisan 2', '9800000002', 'Sagoni', 'retail', 'Maize, Gram', 12),
    C('Demo Krishi Kendra', '9800000003', 'Kareli', 'wholesale', 'Gram, Wheat, Maize', ''),
    C('Demo Kisan 3', '9800000004', 'Murach', 'retail', 'Maize, Wheat', 4),
    C('Demo FPO', '9800000005', 'Gotegaon', 'wholesale', 'Gram, Tur, Masoor', ''),
    C('Demo Kisan 4', '9800000006', 'Nayagaon', 'retail', 'Wheat, Gram', 8),
  ];
  const daysAgo = n => new Date(Date.now() - n * 86400000).toISOString().slice(0, 10);
  const S = (ci, n, items, paid) => {
    const c = ci === null ? null : d.customers[ci];
    const its = items.map(([pi, qty]) => { const p = d.products[pi];
      return { productId: p.id, name: p.name, qty, price: c && c.type === 'wholesale' ? p.wholesale : p.retail }; });
    const total = its.reduce((a, i) => a + i.qty * i.price, 0);
    d.sales.push({ id: uid(), date: daysAgo(n), customerId: c ? c.id : null, items: its, total, paid: paid ?? total });
  };
  S(1, 120, [[3, 3], [1, 4]]);
  S(5, 40, [[0, 2], [6, 2]]);
  S(2, 25, [[0, 20], [1, 40], [4, 10]], 20000);
  S(4, 6, [[0, 15], [5, 5]], 10000);
  S(0, 2, [[0, 8], [2, 4], [4, 6]]);
  S(null, 1, [[1, 2]]);
  S(3, 0, [[4, 1], [1, 2]]);
  return d;
}

render();
