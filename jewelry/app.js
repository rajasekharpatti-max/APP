const KEY = "anusha-jewelry-v1";
const PAGES = [
  ["dash", "Dashboard"],
  ["customers", "Customers"],
  ["orders", "Orders"],
  ["ledger", "Khata / Ledger"],
  ["oldgold", "Old Gold"],
  ["workers", "Karigar"],
  ["suppliers", "Suppliers"],
  ["rates", "Gold Rate"],
  ["shop", "Shop"],
  ["backup", "Backup"]
];

let db = emptyDb();
let page = "dash";
let q = "";
let modal = null;

function emptyDb() {
  return {
    version: "AJ-v7-COMBINED",
    exportedOn: new Date().toISOString(),
    customers: [], orders: [], ledger: [], workers: [], suppliers: [],
    oldGold: [], stock: [], supfine: {}, wkmetal: {},
    goldrate: { rate: { g22: 0, g24: 0, g18: 0, g14: 0, silver: 0 }, date: "", time: "" },
    reminders: {}, shopprofile: { name: "ANUSHA JEWELRY", tag: "Gold · Silver · Diamond", addr: "Nellore, Andhra Pradesh", phone: "", gstin: "", bis: "", upi: "", terms: "", paper: "A5" },
    ratehistory: [], shopupi: { vpa: "", lang: "en" }
  };
}

function nid() { return "m" + Math.random().toString(36).slice(2, 11) + Math.random().toString(36).slice(2, 5); }
function n(v) { const x = parseFloat(v); return Number.isFinite(x) ? x : 0; }
function inr(v) {
  const x = n(v);
  return "₹" + x.toLocaleString("en-IN", { maximumFractionDigits: 2 });
}
function today() { return new Date().toISOString().slice(0, 10); }
function cust(id) { return db.customers.find(c => c.id === id) || { name: "—", phone: "" }; }
function save() {
  db.exportedOn = new Date().toISOString();
  localStorage.setItem(KEY, JSON.stringify(db));
}
function loadLocal() {
  try {
    const raw = localStorage.getItem(KEY);
    if (raw) db = Object.assign(emptyDb(), JSON.parse(raw));
  } catch (e) { db = emptyDb(); }
}

function toast(msg) {
  const t = document.createElement("div");
  t.className = "toast";
  t.textContent = msg;
  document.body.appendChild(t);
  setTimeout(() => t.remove(), 2200);
}

function fyCode(dateStr) {
  const d = new Date(dateStr || today());
  let y = d.getFullYear() % 100;
  const m = d.getMonth();
  if (m < 3) return String(y - 1).padStart(2, "0") + String(y).padStart(2, "0");
  return String(y).padStart(2, "0") + String(y + 1).padStart(2, "0");
}

function nextOrderNo(dateStr) {
  const fy = fyCode(dateStr);
  const prefix = "AJ/" + fy + "/";
  let max = 0;
  db.orders.forEach(o => {
    if (String(o.orderNo || "").startsWith(prefix)) {
      const k = parseInt(String(o.orderNo).slice(prefix.length), 10);
      if (k > max) max = k;
    }
  });
  return prefix + String(max + 1).padStart(4, "0");
}

function calcPos(o) {
  const gross = n(o.weight);
  const less = n(o.lessWt) + n(o.stoneWt) + n(o.waxWt);
  const net = Math.max(gross - less, 0);
  const wp = n(o.wastagePct);
  const wasteWt = o.wastageMode === "gram" ? n(o.wastageInput) : net * wp / 100;
  const totalWt = net + wasteWt;
  const rate = n(o.rate);
  const goldVal = totalWt * rate;
  let makingAmt = 0;
  if (o.makingMode === "pct") makingAmt = goldVal * n(o.makingInput || o.makingPct) / 100;
  else if (o.makingMode === "pg") makingAmt = net * n(o.makingInput);
  else makingAmt = n(o.makingInput) * Math.max(n(o.qty), 1);
  const stoneCh = n(o.stoneCh), waxCh = n(o.waxCh), otherCh = n(o.otherCh), hallmarkCh = n(o.hallmarkCh);
  const subtotal = goldVal + makingAmt + stoneCh + waxCh + otherCh + hallmarkCh;
  const discAmt = n(o.discAmt) || subtotal * n(o.discPct) / 100;
  const taxable = Math.max(subtotal - discAmt, 0);
  const gst = o.gstOn ? taxable * 0.03 : 0;
  const total = taxable + gst;
  return { net, wasteWt, totalWt, fineWt: totalWt, goldVal, makingAmt, stoneCh, waxCh, otherCh, hallmarkCh, subtotal, discAmt, taxable, gst, total };
}

function applyCalc(o) {
  const pos = calcPos(o);
  o.pos = pos;
  o.netWt = pos.totalWt;
  o.goldVal = pos.goldVal;
  o.makingAmt = pos.makingAmt;
  o.wasteWt = pos.wasteWt;
  o.total = pos.total;
  return o;
}

function ledgerBal(customerId) {
  let b = 0;
  db.ledger.filter(e => e.customerId === customerId).forEach(e => {
    b += e.side === "debit" ? n(e.amount) : -n(e.amount);
  });
  return b;
}

function receivables() {
  let rec = 0, adv = 0, nDue = 0;
  db.customers.forEach(c => {
    const b = ledgerBal(c.id);
    if (b > 1) { rec += b; nDue++; }
    if (b < -1) adv += -b;
  });
  return { rec, adv, nDue };
}

function addLedger(row) {
  db.ledger.push({
    id: nid(), customerId: row.customerId, entryType: row.entryType, side: row.side,
    amount: String(Math.round(n(row.amount) * 100) / 100), note: row.note || "",
    date: row.date || today(), orderId: row.orderId || ""
  });
}

/* ---------- render ---------- */
function $(id) { return document.getElementById(id); }

function render() {
  $("nav").innerHTML = PAGES.map(([id, label]) =>
    `<button class="${page === id ? "active" : ""}" data-page="${id}">${label}</button>`
  ).join("");
  $("shopMini").textContent = (db.shopprofile.name || "ANUSHA JEWELRY") + " · Nellore";
  const body = {
    dash: viewDash, customers: viewCustomers, orders: viewOrders, ledger: viewLedger,
    oldgold: viewOldGold, workers: viewWorkers, suppliers: viewSuppliers,
    rates: viewRates, shop: viewShop, backup: viewBackup
  }[page];
  $("view").innerHTML = body();
  if (modal) $("modals").innerHTML = modal;
  else $("modals").innerHTML = "";
}

function viewDash() {
  const r = db.goldrate.rate || {};
  const rec = receivables();
  const pending = db.orders.filter(o => o.status === "Pending");
  const delivered = db.orders.filter(o => o.status === "Delivered");
  const sales = delivered.reduce((s, o) => s + n(o.total), 0);
  const og = db.oldGold.reduce((s, o) => s + n(o.fineVal), 0);
  const recent = [...db.orders].sort((a, b) => String(b.date).localeCompare(String(a.date))).slice(0, 8);
  const dues = db.customers.map(c => ({ c, b: ledgerBal(c.id) })).filter(x => x.b > 1).sort((a, b) => b.b - a.b).slice(0, 8);
  return `
    <div class="topbar">
      <div>
        <h2>${esc(db.shopprofile.name || "ANUSHA JEWELRY")}</h2>
        <div class="muted">${esc(db.shopprofile.tag || "")} · ${esc(db.shopprofile.addr || "")}</div>
      </div>
      <div class="rates">
        ${rateChip("22K", r.g22)} ${rateChip("24K", r.g24)} ${rateChip("Silver", r.silver)}
      </div>
    </div>
    <div class="grid kpis">
      <div class="card"><div class="lbl">Customers</div><div class="val">${db.customers.length}</div></div>
      <div class="card"><div class="lbl">Orders</div><div class="val">${db.orders.length}</div><div class="sub">${pending.length} pending</div></div>
      <div class="card"><div class="lbl">Billed (delivered)</div><div class="val">${inr(sales)}</div></div>
      <div class="card"><div class="lbl">Receivable</div><div class="val due">${inr(rec.rec)}</div><div class="sub">${rec.nDue} khata due</div></div>
      <div class="card"><div class="lbl">Customer advance</div><div class="val">${inr(rec.adv)}</div></div>
      <div class="card"><div class="lbl">Old gold (fine value)</div><div class="val">${inr(og)}</div><div class="sub">${db.oldGold.length} lots</div></div>
    </div>
    <div class="grid" style="grid-template-columns:1fr 1fr;margin-top:14px">
      <div class="card">
        <div class="lbl">Latest orders</div>
        <table><thead><tr><th>No</th><th>Customer</th><th>Item</th><th>Total</th><th></th></tr></thead>
        <tbody>${recent.map(o => `<tr>
          <td>${esc(o.orderNo)}</td><td>${esc(cust(o.customerId).name)}</td>
          <td>${esc(o.ornament || o.customOrn)}</td><td>${inr(o.total)}</td>
          <td><span class="pill ${esc(o.status)}">${esc(o.status)}</span></td>
        </tr>`).join("") || emptyRow(5)}</tbody></table>
      </div>
      <div class="card">
        <div class="lbl">Khata due</div>
        <table><thead><tr><th>Customer</th><th>Phone</th><th>Due</th><th></th></tr></thead>
        <tbody>${dues.map(x => `<tr>
          <td>${esc(x.c.name)}</td><td>${esc(x.c.phone)}</td>
          <td class="due">${inr(x.b)}</td>
          <td><button class="ghost" data-wa="${esc(x.c.phone)}" data-amt="${x.b.toFixed(2)}" data-name="${esc(x.c.name)}">WhatsApp</button></td>
        </tr>`).join("") || emptyRow(4)}</tbody></table>
      </div>
    </div>`;
}

function rateChip(k, v) {
  return `<div class="ratebox"><span class="muted">${k}</span><b>${n(v) ? n(v).toLocaleString("en-IN") : "—"}</b></div>`;
}

function viewCustomers() {
  const list = db.customers.filter(c => match(c.name + c.phone + (c.address || ""), q));
  return `
    <div class="topbar"><h2>Customers</h2>
      <div class="row"><input class="search" id="q" placeholder="Search name / phone" value="${esc(q)}">
      <button class="btn" id="addCust">+ Customer</button></div>
    </div>
    <div class="card"><table>
      <thead><tr><th>Name</th><th>Phone</th><th>Address</th><th>Since</th><th>Khata</th><th></th></tr></thead>
      <tbody>${list.map(c => {
        const b = ledgerBal(c.id);
        return `<tr>
          <td><b>${esc(c.name)}</b></td><td>${esc(c.phone)}</td><td>${esc(c.address)}</td>
          <td>${esc(c.since)}</td>
          <td class="${b > 1 ? "due" : b < -1 ? "ok" : ""}">${inr(b)}</td>
          <td><button class="ghost" data-open-cust="${c.id}">Open</button></td>
        </tr>`;
      }).join("") || emptyRow(6)}</tbody>
    </table></div>`;
}

function viewOrders() {
  const list = db.orders.filter(o => match((o.orderNo || "") + (o.ornament || "") + cust(o.customerId).name, q))
    .sort((a, b) => String(b.date).localeCompare(String(a.date)));
  return `
    <div class="topbar"><h2>Orders</h2>
      <div class="row"><input class="search" id="q" placeholder="Search order / customer" value="${esc(q)}">
      <button class="btn" id="addOrder">+ Order</button></div>
    </div>
    <div class="card"><table>
      <thead><tr><th>No</th><th>Date</th><th>Customer</th><th>Item</th><th>Metal</th><th>Wt</th><th>Total</th><th>Status</th><th></th></tr></thead>
      <tbody>${list.map(o => `<tr>
        <td>${esc(o.orderNo)}</td><td>${esc(o.date)}</td><td>${esc(cust(o.customerId).name)}</td>
        <td>${esc(o.ornament || o.customOrn)}</td><td>${esc(o.metal)}</td>
        <td>${esc(o.weight)}</td><td>${inr(o.total)}</td>
        <td><span class="pill ${esc(o.status)}">${esc(o.status)}</span></td>
        <td><button class="ghost" data-open-order="${o.id}">Open</button></td>
      </tr>`).join("") || emptyRow(9)}</tbody>
    </table></div>`;
}

function viewLedger() {
  const list = db.ledger.filter(e => match(cust(e.customerId).name + (e.note || "") + (e.entryType || ""), q))
    .sort((a, b) => String(b.date).localeCompare(String(a.date))).slice(0, 250);
  return `
    <div class="topbar"><h2>Khata / Ledger</h2>
      <div class="row"><input class="search" id="q" placeholder="Search" value="${esc(q)}">
      <button class="btn" id="addLed">+ Entry</button></div>
    </div>
    <div class="card"><table>
      <thead><tr><th>Date</th><th>Customer</th><th>Type</th><th>Side</th><th>Amount</th><th>Note</th></tr></thead>
      <tbody>${list.map(e => `<tr>
        <td>${esc(e.date)}</td><td>${esc(cust(e.customerId).name)}</td>
        <td>${esc(e.entryType)}</td><td>${esc(e.side)}</td>
        <td class="${e.side === "debit" ? "due" : "ok"}">${inr(e.amount)}</td>
        <td>${esc(e.note)}</td>
      </tr>`).join("") || emptyRow(6)}</tbody>
    </table></div>`;
}

function viewOldGold() {
  const list = db.oldGold;
  return `
    <div class="topbar"><h2>Old Gold</h2><button class="btn" id="addOg">+ Buy old gold</button></div>
    <div class="card"><table>
      <thead><tr><th>Date</th><th>Customer</th><th>Desc</th><th>Gross</th><th>Fine</th><th>Purity</th><th>Value</th></tr></thead>
      <tbody>${list.map(o => `<tr>
        <td>${esc(o.date)}</td><td>${esc(cust(o.customerId).name)}</td>
        <td>${esc(o.description)}</td><td>${esc(o.grossWeight)}</td>
        <td>${n(o.fineWt).toFixed(3)}</td><td>${esc(o.purity)}${o.customPct ? " " + o.customPct + "%" : ""}</td>
        <td>${inr(o.fineVal)}</td>
      </tr>`).join("") || emptyRow(7)}</tbody>
    </table></div>`;
}

function viewWorkers() {
  return `
    <div class="topbar"><h2>Karigar</h2><button class="btn" id="addWk">+ Karigar</button></div>
    <div class="card"><table>
      <thead><tr><th>Name</th><th>Phone</th><th>Work</th><th>Pay</th><th>Join</th><th>Notes</th></tr></thead>
      <tbody>${db.workers.map(w => `<tr>
        <td>${esc(w.name)}</td><td>${esc(w.phone)}</td><td>${esc(w.workType)}</td>
        <td>${esc(w.payType)}</td><td>${esc(w.joinDate)}</td><td>${esc(w.notes)}</td>
      </tr>`).join("") || emptyRow(6)}</tbody>
    </table></div>`;
}

function viewSuppliers() {
  return `
    <div class="topbar"><h2>Suppliers</h2><button class="btn" id="addSup">+ Supplier</button></div>
    <div class="card"><table>
      <thead><tr><th>Name</th><th>Phone</th><th>Type</th><th>Address</th><th>GST</th></tr></thead>
      <tbody>${db.suppliers.map(s => `<tr>
        <td>${esc(s.name)}</td><td>${esc(s.phone)}</td><td>${esc(s.type)}</td>
        <td>${esc(s.address)}</td><td>${esc(s.gst)}</td>
      </tr>`).join("") || emptyRow(5)}</tbody>
    </table></div>`;
}

function viewRates() {
  const r = db.goldrate.rate || {};
  const hist = [...(db.ratehistory || [])].reverse().slice(0, 20);
  return `
    <div class="topbar"><h2>Gold Rate</h2></div>
    <div class="card">
      <div class="form">
        ${["g22","g24","g18","g14","silver"].map(k =>
          `<div class="field"><label>${k.toUpperCase()}</label><input id="rt_${k}" type="number" step="0.01" value="${n(r[k])}"></div>`
        ).join("")}
      </div>
      <div class="row" style="margin-top:12px"><button class="btn" id="saveRates">Save today's rate</button>
        <span class="muted">${esc(db.goldrate.date || "")} ${esc(db.goldrate.time || "")}</span></div>
    </div>
    <div class="card" style="margin-top:12px">
      <div class="lbl">History</div>
      <table><thead><tr><th>Date</th><th>22K</th><th>24K</th><th>18K</th><th>14K</th><th>Silver</th></tr></thead>
      <tbody>${hist.map(h => `<tr><td>${esc(h.date)} ${esc(h.time)}</td>
        <td>${h.g22}</td><td>${h.g24}</td><td>${h.g18}</td><td>${h.g14}</td><td>${h.silver}</td></tr>`).join("")}</tbody>
      </table>
    </div>`;
}

function viewShop() {
  const s = db.shopprofile;
  return `
    <div class="topbar"><h2>Shop profile</h2></div>
    <div class="card form">
      <div class="field"><label>Name</label><input id="sp_name" value="${esc(s.name)}"></div>
      <div class="field"><label>Tag</label><input id="sp_tag" value="${esc(s.tag)}"></div>
      <div class="field"><label>Address</label><input id="sp_addr" value="${esc(s.addr)}"></div>
      <div class="field"><label>Phone</label><input id="sp_phone" value="${esc(s.phone)}"></div>
      <div class="field"><label>GSTIN</label><input id="sp_gstin" value="${esc(s.gstin)}"></div>
      <div class="field"><label>BIS</label><input id="sp_bis" value="${esc(s.bis)}"></div>
      <div class="field"><label>UPI</label><input id="sp_upi" value="${esc(s.upi)}"></div>
      <div class="field" style="grid-column:1/-1"><label>Terms</label><textarea id="sp_terms">${esc(s.terms)}</textarea></div>
    </div>
    <div class="row" style="margin-top:12px"><button class="btn" id="saveShop">Save shop</button></div>`;
}

function viewBackup() {
  return `
    <div class="topbar"><h2>Backup</h2></div>
    <div class="card">
      <p>This app stores data in this browser. Export often. Import your <b>AJ-v7-COMBINED</b> JSON (AnushaJewelry_Backup).</p>
      <div class="row">
        <button class="btn" id="exportBtn">Export backup JSON</button>
        <label class="btn ghost">Import JSON<input id="importFile" type="file" accept="application/json" class="hidden"></label>
        <button class="ghost" id="loadSeed">Load 8 Aug 2026 shop backup</button>
      </div>
      <p class="muted">Last saved in file: ${esc(db.exportedOn || "—")} · ${db.customers.length} customers · ${db.orders.length} orders · ${db.ledger.length} ledger lines</p>
    </div>`;
}

function emptyRow(cols) { return `<tr><td colspan="${cols}" class="muted">No records</td></tr>`; }
function match(s, qq) { return String(s || "").toLowerCase().includes(String(qq || "").toLowerCase()); }
function esc(s) { return String(s ?? "").replace(/[&<>"']/g, c => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" }[c])); }

function custOptions(sel) {
  return db.customers.map(c => `<option value="${c.id}" ${c.id === sel ? "selected" : ""}>${esc(c.name)} ${esc(c.phone)}</option>`).join("");
}

function modalCust(c) {
  const isNew = !c;
  c = c || { id: nid(), name: "", phone: "", address: "", email: "", dob: "", since: today() };
  const orders = db.orders.filter(o => o.customerId === c.id);
  const led = db.ledger.filter(e => e.customerId === c.id).sort((a, b) => String(a.date).localeCompare(String(b.date)));
  const b = ledgerBal(c.id);
  modal = `<div class="modal-bg"><div class="modal">
    <div class="topbar"><h2>${isNew ? "New customer" : esc(c.name)}</h2>
      <button class="ghost" id="closeM">Close</button></div>
    <div class="form">
      <div class="field"><label>Name</label><input id="c_name" value="${esc(c.name)}"></div>
      <div class="field"><label>Phone</label><input id="c_phone" value="${esc(c.phone)}"></div>
      <div class="field"><label>Address</label><input id="c_address" value="${esc(c.address)}"></div>
      <div class="field"><label>Since</label><input id="c_since" type="date" value="${esc(c.since)}"></div>
    </div>
    <div class="row" style="margin-top:10px">
      <button class="btn" id="saveCust" data-id="${c.id}">Save</button>
      ${!isNew ? `<span class="${b > 1 ? "due" : ""}">Khata ${inr(b)}</span>
      <button class="ghost" data-wa="${esc(c.phone)}" data-amt="${b.toFixed(2)}" data-name="${esc(c.name)}">WhatsApp due</button>` : ""}
    </div>
    ${!isNew ? `<h3>Orders</h3><table><tbody>${orders.map(o => `<tr><td>${esc(o.orderNo)}</td><td>${esc(o.ornament)}</td><td>${inr(o.total)}</td><td>${esc(o.status)}</td></tr>`).join("")}</tbody></table>
    <h3>Ledger</h3><table><tbody>${led.map(e => `<tr><td>${esc(e.date)}</td><td>${esc(e.entryType)}</td><td>${esc(e.side)}</td><td>${inr(e.amount)}</td><td>${esc(e.note)}</td></tr>`).join("")}</tbody></table>` : ""}
  </div></div>`;
}

function modalOrder(o) {
  const isNew = !o;
  const r = db.goldrate.rate || {};
  o = o ? JSON.parse(JSON.stringify(o)) : applyCalc({
    id: nid(), orderNo: nextOrderNo(today()), customerId: db.customers[0]?.id || "",
    ornament: "", customOrn: "", metal: "Gold 22K", purity: "22K", priceMode: "RateBased",
    huid: "", itemDesc: "", weight: "", lessWt: "", stoneWt: "", stoneCh: "", waxWt: "", waxCh: "",
    wastageMode: "pct", wastageInput: "", wastagePct: "0", rate: String(r.g22 || ""),
    makingMode: "pct", makingInput: "", otherCh: "", hallmarkCh: "", discPct: "", discAmt: "",
    gstOn: false, length: "", size: "", ringSize: "", bangleSize: "", hallmark: "", qty: "1",
    rateFixed: true, supplierRef: "", supplierRateFixed: false, photo: "", notes: "",
    date: today(), status: "Pending", advancePaid: "", makingPct: "", createdAt: today()
  });
  const pos = calcPos(o);
  modal = `<div class="modal-bg"><div class="modal">
    <div class="topbar"><h2>${esc(o.orderNo)}</h2><button class="ghost" id="closeM">Close</button></div>
    <div class="form">
      <div class="field"><label>Customer</label><select id="o_customerId">${custOptions(o.customerId)}</select></div>
      <div class="field"><label>Date</label><input id="o_date" type="date" value="${esc(o.date)}"></div>
      <div class="field"><label>Status</label><select id="o_status">
        ${["Pending","Delivered","Cancelled"].map(s => `<option ${o.status===s?"selected":""}>${s}</option>`).join("")}</select></div>
      <div class="field"><label>Ornament</label><input id="o_ornament" value="${esc(o.ornament || o.customOrn)}"></div>
      <div class="field"><label>Metal</label><select id="o_metal">
        ${["Gold 22K","Gold 24K","Gold 18K","Silver 925"].map(m => `<option ${o.metal===m?"selected":""}>${m}</option>`).join("")}</select></div>
      <div class="field"><label>Weight g</label><input id="o_weight" value="${esc(o.weight)}"></div>
      <div class="field"><label>Less wt</label><input id="o_lessWt" value="${esc(o.lessWt)}"></div>
      <div class="field"><label>Stone wt</label><input id="o_stoneWt" value="${esc(o.stoneWt)}"></div>
      <div class="field"><label>Wastage %</label><input id="o_wastagePct" value="${esc(o.wastagePct)}"></div>
      <div class="field"><label>Rate /g</label><input id="o_rate" value="${esc(o.rate)}"></div>
      <div class="field"><label>Making mode</label><select id="o_makingMode">
        <option value="pct" ${o.makingMode==="pct"?"selected":""}>%</option>
        <option value="pg" ${o.makingMode==="pg"?"selected":""}>Per gram</option>
        <option value="flat" ${o.makingMode==="flat"?"selected":""}>Flat</option></select></div>
      <div class="field"><label>Making</label><input id="o_makingInput" value="${esc(o.makingInput || o.makingPct)}"></div>
      <div class="field"><label>Hallmark ₹</label><input id="o_hallmarkCh" value="${esc(o.hallmarkCh)}"></div>
      <div class="field"><label>Other ₹</label><input id="o_otherCh" value="${esc(o.otherCh)}"></div>
      <div class="field"><label>Qty</label><input id="o_qty" value="${esc(o.qty)}"></div>
      <div class="field"><label>HUID</label><input id="o_huid" value="${esc(o.huid)}"></div>
      <div class="field"><label>GST 3%</label><select id="o_gstOn"><option value="no" ${!o.gstOn?"selected":""}>No</option><option value="yes" ${o.gstOn?"selected":""}>Yes</option></select></div>
      <div class="field"><label>Notes</label><input id="o_notes" value="${esc(o.notes)}"></div>
    </div>
    <p><b>Net ${pos.net.toFixed(3)} g</b> · waste ${pos.wasteWt.toFixed(3)} · gold ${inr(pos.goldVal)} · <b>Total ${inr(pos.total)}</b></p>
    <div class="row">
      <button class="btn" id="saveOrder" data-id="${o.id}" data-new="${isNew?1:0}">Save order</button>
      ${!isNew ? `<button class="ghost" id="printBill" data-id="${o.id}">Print bill</button>` : ""}
    </div>
  </div></div>`;
}

function readOrderForm(id, isNew) {
  const prev = db.orders.find(x => x.id === id) || {};
  const o = Object.assign({}, prev, {
    id, orderNo: prev.orderNo || nextOrderNo($("o_date").value),
    customerId: $("o_customerId").value, date: $("o_date").value, status: $("o_status").value,
    ornament: $("o_ornament").value, customOrn: $("o_ornament").value,
    metal: $("o_metal").value, purity: $("o_metal").value.includes("24") ? "24K" : $("o_metal").value.includes("18") ? "18K" : $("o_metal").value.includes("Silver") ? "925" : "22K",
    weight: $("o_weight").value, lessWt: $("o_lessWt").value, stoneWt: $("o_stoneWt").value,
    wastageMode: "pct", wastagePct: $("o_wastagePct").value, rate: $("o_rate").value,
    makingMode: $("o_makingMode").value, makingInput: $("o_makingInput").value, makingPct: $("o_makingInput").value,
    hallmarkCh: $("o_hallmarkCh").value, otherCh: $("o_otherCh").value, qty: $("o_qty").value,
    huid: $("o_huid").value, gstOn: $("o_gstOn").value === "yes", notes: $("o_notes").value,
    priceMode: "RateBased", createdAt: prev.createdAt || today()
  });
  applyCalc(o);
  return { o, isNew };
}

function modalLed() {
  modal = `<div class="modal-bg"><div class="modal">
    <div class="topbar"><h2>Ledger entry</h2><button class="ghost" id="closeM">Close</button></div>
    <div class="form">
      <div class="field"><label>Customer</label><select id="l_cid">${custOptions("")}</select></div>
      <div class="field"><label>Date</label><input id="l_date" type="date" value="${today()}"></div>
      <div class="field"><label>Type</label><select id="l_type">
        <option>payment</option><option>advance</option><option>bill</option><option>discount</option>
        <option>oldgold</option><option>exchange</option><option>interest</option><option>other_dr</option><option>other_cr</option>
      </select></div>
      <div class="field"><label>Side</label><select id="l_side"><option value="credit">Credit (received)</option><option value="debit">Debit (due)</option></select></div>
      <div class="field"><label>Amount</label><input id="l_amt" type="number"></div>
      <div class="field"><label>Note</label><input id="l_note"></div>
    </div>
    <div class="row" style="margin-top:10px"><button class="btn" id="saveLed">Save</button></div>
  </div></div>`;
}

function modalOg() {
  modal = `<div class="modal-bg"><div class="modal">
    <div class="topbar"><h2>Buy old gold</h2><button class="ghost" id="closeM">Close</button></div>
    <div class="form">
      <div class="field"><label>Customer</label><select id="og_cid">${custOptions("")}</select></div>
      <div class="field"><label>Date</label><input id="og_date" type="date" value="${today()}"></div>
      <div class="field"><label>Description</label><input id="og_desc"></div>
      <div class="field"><label>Gross g</label><input id="og_gross"></div>
      <div class="field"><label>Less g</label><input id="og_less" value="0"></div>
      <div class="field"><label>Purity %</label><input id="og_pct" value="91.6"></div>
      <div class="field"><label>Rate / fine g</label><input id="og_rate" value="${n((db.goldrate.rate||{}).g24)}"></div>
    </div>
    <div class="row" style="margin-top:10px"><button class="btn" id="saveOg">Save & credit khata</button></div>
  </div></div>`;
}

function printBill(id) {
  const o = db.orders.find(x => x.id === id);
  if (!o) return;
  const c = cust(o.customerId);
  const pos = o.pos || calcPos(o);
  const w = window.open("", "_blank");
  w.document.write(`<html><head><title>${o.orderNo}</title>
    <style>body{font-family:Georgia,serif;padding:24px;max-width:700px} h1{margin:0;color:#8a6a12} table{width:100%;border-collapse:collapse} td{padding:4px 0}</style>
    </head><body>
    <h1>${esc(db.shopprofile.name)}</h1>
    <div>${esc(db.shopprofile.addr)} · ${esc(db.shopprofile.phone)}</div>
    <hr>
    <div><b>${esc(o.orderNo)}</b> · ${esc(o.date)} · ${esc(o.status)}</div>
    <div>${esc(c.name)} · ${esc(c.phone)}<br>${esc(c.address)}</div>
    <hr>
    <table>
      <tr><td>Item</td><td>${esc(o.ornament)}</td></tr>
      <tr><td>Metal</td><td>${esc(o.metal)}</td></tr>
      <tr><td>Weight</td><td>${esc(o.weight)} g</td></tr>
      <tr><td>Wastage</td><td>${esc(o.wastagePct)}%</td></tr>
      <tr><td>Rate</td><td>${esc(o.rate)}</td></tr>
      <tr><td>Gold value</td><td>${inr(pos.goldVal)}</td></tr>
      <tr><td>Hallmark / other</td><td>${inr(n(o.hallmarkCh)+n(o.otherCh))}</td></tr>
      <tr><td><b>Total</b></td><td><b>${inr(pos.total)}</b></td></tr>
      <tr><td>Khata now</td><td>${inr(ledgerBal(o.customerId))}</td></tr>
    </table>
    <p style="white-space:pre-wrap;font-size:12px">${esc(db.shopprofile.terms)}</p>
    <script>onload=()=>print()<\/script>
    </body></html>`);
  w.document.close();
}

function waDue(phone, name, amt) {
  const p = String(phone || "").replace(/\D/g, "").replace(/^0/, "");
  const num = p.length === 10 ? "91" + p : p;
  const text = encodeURIComponent(`Namaskaram ${name}, Anusha Jewelry Nellore.\nMee khata due: ₹${amt}\nUPI: ${db.shopprofile.upi || db.shopupi.vpa || ""}\nDhanyavadalu.`);
  window.open("https://wa.me/" + num + "?text=" + text, "_blank");
}

function closeModal() { modal = null; render(); }

function bind() {
  document.body.onclick = (e) => {
    const p = e.target.closest("[data-page]");
    if (p) { page = p.dataset.page; q = ""; modal = null; render(); return; }
    if (e.target.id === "closeM") { closeModal(); return; }
    if (e.target.id === "addCust") { modalCust(null); render(); return; }
    if (e.target.id === "addOrder") { modalOrder(null); render(); return; }
    if (e.target.id === "addLed") { modalLed(); render(); return; }
    if (e.target.id === "addOg") { modalOg(); render(); return; }
    if (e.target.id === "addWk") {
      const name = prompt("Karigar name"); if (!name) return;
      db.workers.push({ id: nid(), name, phone: "", workType: "Goldsmith", payType: "Per Piece", payAmount: "", joinDate: today(), notes: "", payments: [] });
      save(); render(); return;
    }
    if (e.target.id === "addSup") {
      const name = prompt("Supplier name"); if (!name) return;
      db.suppliers.push({ id: nid(), name, phone: "", type: "Gold Supplier", address: "", gst: "", notes: "", transactions: [] });
      save(); render(); return;
    }
    const oc = e.target.closest("[data-open-cust]");
    if (oc) { modalCust(db.customers.find(c => c.id === oc.dataset.openCust)); render(); return; }
    const oo = e.target.closest("[data-open-order]");
    if (oo) { modalOrder(db.orders.find(o => o.id === oo.dataset.openOrder)); render(); return; }
    const wa = e.target.closest("[data-wa]");
    if (wa) { waDue(wa.dataset.wa, wa.dataset.name, wa.dataset.amt); return; }
    if (e.target.id === "saveCust") {
      const id = e.target.dataset.id;
      let c = db.customers.find(x => x.id === id);
      const row = { id, name: $("c_name").value, phone: $("c_phone").value, address: $("c_address").value, email: "", dob: "", since: $("c_since").value };
      if (c) Object.assign(c, row); else db.customers.push(row);
      save(); closeModal(); toast("Customer saved"); return;
    }
    if (e.target.id === "saveOrder") {
      const { o, isNew } = readOrderForm(e.target.dataset.id, e.target.dataset.new === "1");
      if (!o.customerId) { toast("Select customer"); return; }
      const ix = db.orders.findIndex(x => x.id === o.id);
      if (ix >= 0) db.orders[ix] = o; else db.orders.push(o);
      const hasBill = db.ledger.some(l => l.orderId === o.id && l.entryType === "bill");
      if (!hasBill && o.status !== "Cancelled") {
        addLedger({ customerId: o.customerId, entryType: "bill", side: "debit", amount: o.total, note: "Bill: " + o.orderNo, date: o.date, orderId: o.id });
      } else if (hasBill && ix >= 0) {
        db.ledger.filter(l => l.orderId === o.id && l.entryType === "bill").forEach(l => { l.amount = String(Math.round(n(o.total) * 100) / 100); });
      }
      save(); closeModal(); toast("Order saved"); return;
    }
    if (e.target.id === "printBill") { printBill(e.target.dataset.id); return; }
    if (e.target.id === "saveLed") {
      addLedger({ customerId: $("l_cid").value, entryType: $("l_type").value, side: $("l_side").value, amount: $("l_amt").value, note: $("l_note").value, date: $("l_date").value });
      save(); closeModal(); toast("Ledger saved"); return;
    }
    if (e.target.id === "saveOg") {
      const gross = n($("og_gross").value), less = n($("og_less").value), pct = n($("og_pct").value), rate = n($("og_rate").value);
      const netWt = gross - less, fineWt = netWt * pct / 100, fineVal = fineWt * rate;
      const row = { id: nid(), type: "buy", customerId: $("og_cid").value, soldTo: "", buyId: "", date: $("og_date").value, grossWeight: String(gross), lessWt: String(less), stoneWt: "", enamelWt: "", soapWt: "", purity: "Custom", customPct: String(pct), ratePerFine: String(rate), description: $("og_desc").value, notes: "", netWt: netWt.toFixed(3), fineWt, fineVal, profit: 0, createdAt: today() };
      db.oldGold.push(row);
      addLedger({ customerId: row.customerId, entryType: "oldgold", side: "credit", amount: fineVal, note: "Old gold " + row.description, date: row.date });
      save(); closeModal(); toast("Old gold saved"); return;
    }
    if (e.target.id === "saveRates") {
      const rate = { g22: n($("rt_g22").value), g24: n($("rt_g24").value), g18: n($("rt_g18").value), g14: n($("rt_g14").value), silver: n($("rt_silver").value) };
      const time = new Date().toLocaleTimeString("en-IN");
      db.goldrate = { rate, date: today(), time };
      db.ratehistory.push({ date: today(), time, ...rate });
      save(); render(); toast("Rate saved"); return;
    }
    if (e.target.id === "saveShop") {
      db.shopprofile = { ...db.shopprofile, name: $("sp_name").value, tag: $("sp_tag").value, addr: $("sp_addr").value, phone: $("sp_phone").value, gstin: $("sp_gstin").value, bis: $("sp_bis").value, upi: $("sp_upi").value, terms: $("sp_terms").value };
      db.shopupi.vpa = db.shopprofile.upi;
      save(); toast("Shop saved"); return;
    }
    if (e.target.id === "exportBtn") {
      const blob = new Blob([JSON.stringify(db, null, 2)], { type: "application/json" });
      const a = document.createElement("a");
      a.href = URL.createObjectURL(blob);
      a.download = "AnushaJewelry_Backup_" + today() + ".json";
      a.click();
      return;
    }
    if (e.target.id === "loadSeed") { loadSeed(); return; }
  };
  document.body.oninput = (e) => {
    if (e.target.id === "q") { q = e.target.value; render(); $("q").focus(); $("q").setSelectionRange(q.length, q.length); }
  };
  document.body.onchange = (e) => {
    if (e.target.id === "importFile" && e.target.files[0]) {
      const f = e.target.files[0];
      const rd = new FileReader();
      rd.onload = () => {
        try {
          const data = JSON.parse(rd.result);
          if (!data.customers || !data.orders) throw new Error("Not an AJ backup");
          db = Object.assign(emptyDb(), data);
          save(); modal = null; page = "dash"; render(); toast("Imported " + db.customers.length + " customers");
        } catch (err) { toast("Import failed"); }
      };
      rd.readAsText(f);
    }
  };
}

async function loadSeed() {
  try {
    const res = await fetch("data/AnushaJewelry_Backup.json");
    if (!res.ok) throw new Error("no seed");
    db = Object.assign(emptyDb(), await res.json());
    save(); page = "dash"; modal = null; render();
    toast("Loaded Anusha Jewelry backup");
  } catch (e) {
    toast("Open via local server, or use Import JSON");
  }
}

loadLocal();
window.addEventListener("DOMContentLoaded", () => {
  bind();
  render();
  if (!db.customers.length) loadSeed();
});
