const PAGES = [
  ["dash", "Home"],
  ["customers", "Customers"],
  ["orders", "Orders"],
  ["ledger", "Khata"],
  ["oldgold", "Old gold"],
  ["backup", "Backup"]
];

let page = location.hash.replace("#", "") || "dash";
let dash = null;
let q = "";

const $ = (id) => document.getElementById(id);
const inr = (v) => "₹" + Number(v || 0).toLocaleString("en-IN", { maximumFractionDigits: 0 });
const esc = (s) => String(s ?? "").replace(/[&<>"']/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" }[c]));

function toast(m) {
  const t = document.createElement("div");
  t.className = "toast";
  t.textContent = m;
  document.body.appendChild(t);
  setTimeout(() => t.remove(), 2200);
}

async function api(path, opt) {
  const r = await fetch(path, opt);
  if (!r.ok) throw new Error(await r.text());
  const ct = r.headers.get("content-type") || "";
  if (ct.includes("json")) return r.json();
  return r;
}

function nav() {
  $("nav").innerHTML = PAGES.map(([id, l]) =>
    `<button class="${page === id ? "on" : ""}" data-p="${id}">${l}</button>`
  ).join("");
}

async function loadDash() {
  dash = await api("/api/dashboard");
  $("shopName").textContent = dash.shop.name;
  $("shopTag").textContent = (dash.shop.addr || "Nellore") + " · Gold · Silver · Diamond";
  $("rates").innerHTML = [
    ["g22", "Gold 22K"],
    ["g24", "Gold 24K"],
    ["silver", "Silver"]
  ].map(([k, lab]) => {
    const v = dash.rates[k];
    const shown = v ? Number(v).toLocaleString("en-IN") : "—";
    return `<div class="chip"><span>${lab}</span><b>₹ ${shown}</b></div>`;
  }).join("");
}

async function render() {
  nav();
  await loadDash();
  if (page === "dash") viewDash();
  if (page === "customers") await viewCustomers();
  if (page === "orders") await viewOrders();
  if (page === "ledger") await viewLedger();
  if (page === "oldgold") await viewOld();
  if (page === "backup") viewBackup();
}

function viewDash() {
  $("view").innerHTML = `
    <div class="page-title">Today at the counter</div>
    <div class="kpis">
      <div class="card"><div class="lbl">Customers</div><div class="val">${dash.counts.customers}</div></div>
      <div class="card"><div class="lbl">Orders</div><div class="val">${dash.counts.orders}</div></div>
      <div class="card"><div class="lbl">Khata due</div><div class="val due">${inr(dash.receivable)}</div></div>
      <div class="card"><div class="lbl">Pending work</div><div class="val">${dash.pending}</div></div>
    </div>
    <div class="split">
      <div class="card">
        <div class="lbl">Khata due — collect</div>
        <table><thead><tr><th>Name</th><th>Phone</th><th>Due</th></tr></thead>
        <tbody>${(dash.dues || []).map((d) => `<tr><td>${esc(d.name)}</td><td>${esc(d.phone)}</td><td class="due">${inr(d.bal)}</td></tr>`).join("")}</tbody>
        </table>
      </div>
      <div class="card">
        <div class="lbl">Trust</div>
        <p class="ok">Shop book saved on this computer</p>
        <p>${dash.integrity.ok ? '<span class="ok">Integrity OK</span>' : '<span class="due">Integrity fail</span>'}
        · ${dash.integrity.customers} customers · ${dash.integrity.orders} orders</p>
        <p style="color:var(--muted);font-size:12px">Export JSON every night from Backup.</p>
      </div>
    </div>`;
}

async function viewCustomers() {
  const rows = await api("/api/customers?q=" + encodeURIComponent(q));
  $("view").innerHTML = `
    <div class="page-title">Customers</div>
    <div class="row"><input class="search" id="q" value="${esc(q)}" placeholder="Search name / phone">
      <button class="btn" id="addC">+ Customer</button></div>
    <div class="card"><table><thead><tr><th>Name</th><th>Phone</th><th>Address</th><th>Khata</th></tr></thead>
    <tbody>${rows.map((c) => `<tr data-c="${c.id}"><td>${esc(c.name)}</td><td>${esc(c.phone)}</td><td>${esc(c.address)}</td>
      <td class="${c.balance > 1 ? "due" : ""}">${inr(c.balance)}</td></tr>`).join("")}</tbody></table></div>`;
}

async function viewOrders() {
  const rows = await api("/api/orders?q=" + encodeURIComponent(q));
  $("view").innerHTML = `
    <div class="page-title">Orders</div>
    <div class="row"><input class="search" id="q" value="${esc(q)}" placeholder="Search order / name / item">
      <button class="btn" id="addO">+ Order</button></div>
    <div class="card"><table><thead><tr><th>No</th><th>Date</th><th>Customer</th><th>Item</th><th>Total</th><th>Status</th></tr></thead>
    <tbody>${rows.map((o) => `<tr><td>${esc(o.order_no)}</td><td>${esc(o.date)}</td><td>${esc(o.customer)}</td>
      <td>${esc(o.ornament)}</td><td>${inr(o.total)}</td><td><span class="pill ${esc(o.status)}">${esc(o.status)}</span></td></tr>`).join("")}</tbody></table></div>`;
}

async function viewLedger() {
  const rows = await api("/api/ledger");
  $("view").innerHTML = `
    <div class="row"><button class="btn" id="addL">+ Payment / entry</button></div>
    <div class="card"><table><thead><tr><th>Date</th><th>Customer</th><th>Type</th><th>Side</th><th>Amount</th><th>Note</th></tr></thead>
    <tbody>${rows.map((e) => `<tr><td>${esc(e.date)}</td><td>${esc(e.customer)}</td><td>${esc(e.entry_type)}</td>
      <td>${esc(e.side)}</td><td>${inr(e.amount)}</td><td>${esc(e.note)}</td></tr>`).join("")}</tbody></table></div>`;
}

async function viewOld() {
  const rows = await api("/api/oldgold");
  $("view").innerHTML = `<div class="card"><table><thead><tr><th>Date</th><th>Customer</th><th>Desc</th><th>Fine g</th><th>Value</th></tr></thead>
    <tbody>${rows.map((o) => `<tr><td>${esc(o.date)}</td><td>${esc(o.customer)}</td><td>${esc(o.description)}</td>
      <td>${Number(o.fine_wt).toFixed(3)}</td><td>${inr(o.fine_val)}</td></tr>`).join("")}</tbody></table></div>`;
}

function viewBackup() {
  $("view").innerHTML = `
    <div class="card">
      <p>This is a <b>new app</b>. Shop book is a file on this computer (<code>anusha.db</code>), not only the browser.</p>
      <div class="row">
        <a class="btn" href="/api/export">Download JSON backup</a>
        <label class="btn">Import AJ-v7 JSON<input type="file" id="imp" accept="application/json" hidden></label>
      </div>
      <p>Export every night. Keep the JSON on a pendrive.</p>
    </div>`;
}

function modalHtml(title, inner) {
  $("modal").innerHTML = `<div class="modal-bg"><div class="modal"><div class="row" style="justify-content:space-between">
    <h2>${title}</h2><button id="x">Close</button></div>${inner}</div></div>`;
}

document.body.addEventListener("click", async (e) => {
  const p = e.target.closest("[data-p]");
  if (p) { page = p.dataset.p; location.hash = page; q = ""; $("modal").innerHTML = ""; render(); return; }
  if (e.target.id === "x") { $("modal").innerHTML = ""; return; }
  if (e.target.id === "addC") {
    modalHtml("New customer", `<div class="form">
      <input id="n" placeholder="Name"><input id="ph" placeholder="Phone"><input id="ad" placeholder="Address">
    </div><p><button class="btn" id="saveC">Save</button></p>`);
    return;
  }
  if (e.target.id === "saveC") {
    await api("/api/customers", { method: "POST", headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ name: $("n").value, phone: $("ph").value, address: $("ad").value }) });
    $("modal").innerHTML = ""; toast("Customer saved"); page = "customers"; render(); return;
  }
  if (e.target.id === "addO") {
    const custs = await api("/api/customers?q=");
    modalHtml("New order", `<div class="form">
      <select id="oc">${custs.map((c) => `<option value="${c.id}">${esc(c.name)}</option>`).join("")}</select>
      <input id="oo" placeholder="Ornament">
      <input id="ow" placeholder="Weight g">
      <input id="or" placeholder="Rate /g" value="${dash.rates.g22 || ""}">
      <input id="owa" placeholder="Wastage %" value="0">
      <input id="oh" placeholder="Hallmark ₹" value="0">
    </div><p><button class="btn" id="saveO">Save order + khata bill</button></p>`);
    return;
  }
  if (e.target.id === "saveO") {
    await api("/api/orders", { method: "POST", headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ customer_id: $("oc").value, ornament: $("oo").value, weight: $("ow").value, rate: $("or").value, wastage_pct: $("owa").value, hallmark: $("oh").value }) });
    $("modal").innerHTML = ""; toast("Order saved"); page = "orders"; render(); return;
  }
  if (e.target.id === "addL") {
    const custs = await api("/api/customers?q=");
    modalHtml("Khata entry", `<div class="form">
      <select id="lc">${custs.map((c) => `<option value="${c.id}">${esc(c.name)}</option>`).join("")}</select>
      <select id="ls"><option value="credit">Credit (received)</option><option value="debit">Debit</option></select>
      <input id="la" type="number" placeholder="Amount">
      <input id="ln" placeholder="Note">
    </div><p><button class="btn" id="saveL">Save</button></p>`);
    return;
  }
  if (e.target.id === "saveL") {
    await api("/api/ledger", { method: "POST", headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ customer_id: $("lc").value, side: $("ls").value, amount: $("la").value, note: $("ln").value, entry_type: $("ls").value === "credit" ? "payment" : "other_dr" }) });
    $("modal").innerHTML = ""; toast("Ledger saved"); page = "ledger"; render(); return;
  }
});

document.body.addEventListener("input", (e) => {
  if (e.target.id === "q") { q = e.target.value; }
});
document.body.addEventListener("change", async (e) => {
  if (e.target.id === "imp" && e.target.files[0]) {
    const fd = new FormData();
    fd.append("file", e.target.files[0]);
    const r = await fetch("/api/import", { method: "POST", body: fd });
    const j = await r.json();
    toast(j.ok ? "Imported " + j.customers : (j.error || "Import failed"));
    render();
  }
});
document.body.addEventListener("keydown", (e) => {
  if (e.key === "Enter" && e.target.id === "q") render();
});

window.addEventListener("hashchange", () => {
  page = location.hash.replace("#", "") || "dash";
  render();
});
render().catch((e) => toast(String(e)));
