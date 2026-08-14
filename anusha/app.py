#!/usr/bin/env python3
"""Anusha Jewelry local shop app. Run: python3 anusha/app.py"""
from __future__ import annotations

import json
import sqlite3
import uuid
from datetime import date
from http.server import SimpleHTTPRequestHandler, ThreadingHTTPServer
from pathlib import Path
from urllib.parse import parse_qs, urlparse

ROOT = Path(__file__).resolve().parent
WEB = ROOT / "web"
DB = ROOT / "anusha.db"
SEED = ROOT.parent / "jewelry" / "data" / "AnushaJewelry_Backup.json"
NEED = ["version", "customers", "orders", "ledger", "workers", "suppliers", "oldGold", "goldrate", "shopprofile"]


def nid() -> str:
    return "m" + uuid.uuid4().hex[:12]


def num(v) -> float:
    try:
        return float(v or 0)
    except (TypeError, ValueError):
        return 0.0


def connect() -> sqlite3.Connection:
    con = sqlite3.connect(DB)
    con.row_factory = sqlite3.Row
    return con


def init_db() -> None:
    con = connect()
    con.executescript(
        """
        CREATE TABLE IF NOT EXISTS meta (k TEXT PRIMARY KEY, v TEXT);
        CREATE TABLE IF NOT EXISTS customers (
          id TEXT PRIMARY KEY, name TEXT, phone TEXT, address TEXT, email TEXT, dob TEXT, since TEXT
        );
        CREATE TABLE IF NOT EXISTS orders (
          id TEXT PRIMARY KEY, order_no TEXT, customer_id TEXT, date TEXT, status TEXT,
          ornament TEXT, total REAL, data TEXT
        );
        CREATE TABLE IF NOT EXISTS ledger (
          id TEXT PRIMARY KEY, customer_id TEXT, entry_type TEXT, side TEXT,
          amount REAL, note TEXT, date TEXT, order_id TEXT
        );
        CREATE TABLE IF NOT EXISTS oldgold (
          id TEXT PRIMARY KEY, customer_id TEXT, date TEXT, description TEXT,
          fine_wt REAL, fine_val REAL, data TEXT
        );
        CREATE TABLE IF NOT EXISTS shop (id INTEGER PRIMARY KEY CHECK (id=1), data TEXT);
        """
    )
    con.commit()
    con.close()


def verify(d: dict) -> dict:
    errors = []
    if not isinstance(d, dict):
        return {"ok": False, "errors": ["not an object"]}
    for k in NEED:
        if k not in d:
            errors.append("missing " + k)
    summary = {
        "ok": not errors,
        "errors": errors,
        "customers": len(d.get("customers") or []),
        "orders": len(d.get("orders") or []),
        "ledger": len(d.get("ledger") or []),
        "version": d.get("version") or "",
    }
    return summary


def load_json_into_db(d: dict) -> dict:
    v = verify(d)
    if not v["ok"]:
        return v
    con = connect()
    con.execute("DELETE FROM customers")
    con.execute("DELETE FROM orders")
    con.execute("DELETE FROM ledger")
    con.execute("DELETE FROM oldgold")
    for c in d.get("customers") or []:
        con.execute(
            "INSERT INTO customers VALUES (?,?,?,?,?,?,?)",
            (c.get("id"), c.get("name"), c.get("phone"), c.get("address"), c.get("email"), c.get("dob"), c.get("since")),
        )
    for o in d.get("orders") or []:
        con.execute(
            "INSERT INTO orders VALUES (?,?,?,?,?,?,?,?)",
            (
                o.get("id"),
                o.get("orderNo"),
                o.get("customerId"),
                o.get("date"),
                o.get("status"),
                o.get("ornament") or o.get("customOrn"),
                num(o.get("total")),
                json.dumps(o),
            ),
        )
    for e in d.get("ledger") or []:
        con.execute(
            "INSERT INTO ledger VALUES (?,?,?,?,?,?,?,?)",
            (
                e.get("id"),
                e.get("customerId"),
                e.get("entryType"),
                e.get("side"),
                num(e.get("amount")),
                e.get("note"),
                e.get("date"),
                e.get("orderId"),
            ),
        )
    for o in d.get("oldGold") or []:
        con.execute(
            "INSERT INTO oldgold VALUES (?,?,?,?,?,?,?)",
            (
                o.get("id"),
                o.get("customerId"),
                o.get("date"),
                o.get("description"),
                num(o.get("fineWt")),
                num(o.get("fineVal")),
                json.dumps(o),
            ),
        )
    con.execute("INSERT OR REPLACE INTO shop (id, data) VALUES (1, ?)", (json.dumps(d),))
    con.execute("INSERT OR REPLACE INTO meta VALUES ('imported', ?)", (str(date.today()),))
    con.commit()
    con.close()
    v["ok"] = True
    return v


def seed_if_empty() -> None:
    con = connect()
    n = con.execute("SELECT COUNT(*) FROM customers").fetchone()[0]
    con.close()
    if n:
        return
    if SEED.exists():
        load_json_into_db(json.loads(SEED.read_text(encoding="utf-8")))


def shop_blob() -> dict:
    con = connect()
    row = con.execute("SELECT data FROM shop WHERE id=1").fetchone()
    con.close()
    if not row:
        return {"shopprofile": {"name": "ANUSHA JEWELRY", "addr": "Nellore"}, "goldrate": {"rate": {}}}
    return json.loads(row["data"])


def balances() -> dict[str, float]:
    con = connect()
    out: dict[str, float] = {}
    for e in con.execute("SELECT customer_id, side, amount FROM ledger"):
        b = out.get(e["customer_id"], 0.0)
        out[e["customer_id"]] = b + (e["amount"] if e["side"] == "debit" else -e["amount"])
    con.close()
    return out


def names() -> dict[str, str]:
    con = connect()
    m = {r["id"]: r["name"] for r in con.execute("SELECT id, name FROM customers")}
    con.close()
    return m


def dashboard() -> dict:
    blob = shop_blob()
    shop = blob.get("shopprofile") or {}
    rates = (blob.get("goldrate") or {}).get("rate") or {}
    con = connect()
    counts = {
        "customers": con.execute("SELECT COUNT(*) FROM customers").fetchone()[0],
        "orders": con.execute("SELECT COUNT(*) FROM orders").fetchone()[0],
        "ledger": con.execute("SELECT COUNT(*) FROM ledger").fetchone()[0],
    }
    pending = con.execute("SELECT COUNT(*) FROM orders WHERE status='Pending'").fetchone()[0]
    con.close()
    bal = balances()
    nm = names()
    rec = sum(v for v in bal.values() if v > 1)
    dues = sorted(
        [{"id": i, "name": nm.get(i, i), "phone": "", "bal": v} for i, v in bal.items() if v > 1],
        key=lambda x: -x["bal"],
    )[:8]
    con = connect()
    phones = {r["id"]: r["phone"] for r in con.execute("SELECT id, phone FROM customers")}
    con.close()
    for d in dues:
        d["phone"] = phones.get(d["id"], "")
    return {
        "shop": {"name": shop.get("name") or "ANUSHA JEWELRY", "addr": shop.get("addr") or ""},
        "rates": {"g22": rates.get("g22"), "g24": rates.get("g24"), "silver": rates.get("silver")},
        "counts": counts,
        "pending": pending,
        "receivable": rec,
        "dues": dues,
        "db_path": str(DB),
        "integrity": {"ok": True, "errors": [], **counts},
    }


def fy_code(d: str) -> str:
    y = int(d[:4]) % 100
    m = int(d[5:7])
    if m < 4:
        return f"{y-1:02d}{y:02d}"
    return f"{y:02d}{y+1:02d}"


def next_order_no(con: sqlite3.Connection, d: str) -> str:
    prefix = f"AJ/{fy_code(d)}/"
    cur = con.execute("SELECT order_no FROM orders WHERE order_no LIKE ?", (prefix + "%",))
    mx = 0
    for r in cur:
        try:
            mx = max(mx, int(str(r["order_no"]).split("/")[-1]))
        except ValueError:
            pass
    return f"{prefix}{mx+1:04d}"


def calc_order(body: dict) -> dict:
    wt, rate, wp, hall = num(body.get("weight")), num(body.get("rate")), num(body.get("wastage_pct")), num(body.get("hallmark"))
    waste = wt * wp / 100
    gold = (wt + waste) * rate
    total = gold + hall
    today = str(date.today())
    return {
        "id": nid(),
        "orderNo": "",
        "customerId": body.get("customer_id"),
        "ornament": body.get("ornament") or "",
        "customOrn": body.get("ornament") or "",
        "metal": "Gold 22K",
        "purity": "22K",
        "weight": str(body.get("weight") or ""),
        "wastagePct": str(body.get("wastage_pct") or "0"),
        "rate": str(body.get("rate") or ""),
        "hallmarkCh": str(body.get("hallmark") or "0"),
        "date": today,
        "status": "Pending",
        "total": total,
        "goldVal": gold,
        "wasteWt": waste,
        "netWt": wt + waste,
        "pos": {"net": wt, "wasteWt": waste, "totalWt": wt + waste, "goldVal": gold, "hallmarkCh": hall, "total": total},
    }


def export_blob() -> dict:
    blob = shop_blob()
    con = connect()
    blob["customers"] = [dict(r) for r in con.execute("SELECT * FROM customers")]
    blob["orders"] = [json.loads(r["data"]) for r in con.execute("SELECT data FROM orders")]
    blob["ledger"] = [
        {
            "id": r["id"],
            "customerId": r["customer_id"],
            "entryType": r["entry_type"],
            "side": r["side"],
            "amount": str(r["amount"]),
            "note": r["note"],
            "date": r["date"],
            "orderId": r["order_id"] or "",
        }
        for r in con.execute("SELECT * FROM ledger")
    ]
    blob["oldGold"] = [json.loads(r["data"]) for r in con.execute("SELECT data FROM oldgold")]
    con.close()
    blob["version"] = "AJ-v7-COMBINED"
    blob["exportedOn"] = str(date.today())
    return blob


class Handler(SimpleHTTPRequestHandler):
    def __init__(self, *a, **k):
        super().__init__(*a, directory=str(WEB), **k)

    def log_message(self, fmt, *args):
        print("[anusha]", fmt % args)

    def _json(self, obj, code=200):
        raw = json.dumps(obj, default=str).encode("utf-8")
        self.send_response(code)
        self.send_header("Content-Type", "application/json; charset=utf-8")
        self.send_header("Content-Length", str(len(raw)))
        self.end_headers()
        self.wfile.write(raw)

    def _read_json(self) -> dict:
        n = int(self.headers.get("Content-Length") or 0)
        return json.loads(self.rfile.read(n) or b"{}")

    def do_GET(self):
        u = urlparse(self.path)
        if u.path == "/":
            p = WEB / "index.html"
            data = p.read_bytes()
            self.send_response(200)
            self.send_header("Content-Type", "text/html; charset=utf-8")
            self.send_header("Content-Length", str(len(data)))
            self.end_headers()
            self.wfile.write(data)
            return
        if u.path == "/api/dashboard":
            return self._json(dashboard())
        if u.path == "/api/customers":
            q = (parse_qs(u.query).get("q") or [""])[0].lower()
            bal = balances()
            con = connect()
            rows = []
            for r in con.execute("SELECT * FROM customers ORDER BY name"):
                if q and q not in (r["name"] or "").lower() and q not in (r["phone"] or ""):
                    continue
                rows.append({**dict(r), "balance": round(bal.get(r["id"], 0), 2)})
            con.close()
            return self._json(rows)
        if u.path == "/api/orders":
            q = (parse_qs(u.query).get("q") or [""])[0].lower()
            nm = names()
            con = connect()
            rows = []
            for r in con.execute("SELECT * FROM orders ORDER BY date DESC"):
                pack = {
                    "id": r["id"],
                    "order_no": r["order_no"],
                    "date": r["date"],
                    "customer": nm.get(r["customer_id"], ""),
                    "ornament": r["ornament"],
                    "total": r["total"],
                    "status": r["status"],
                }
                blob = " ".join(str(x) for x in pack.values()).lower()
                if q and q not in blob:
                    continue
                rows.append(pack)
            con.close()
            return self._json(rows)
        if u.path == "/api/ledger":
            nm = names()
            con = connect()
            rows = [
                {
                    "date": r["date"],
                    "customer": nm.get(r["customer_id"], ""),
                    "entry_type": r["entry_type"],
                    "side": r["side"],
                    "amount": r["amount"],
                    "note": r["note"],
                }
                for r in con.execute("SELECT * FROM ledger ORDER BY date DESC LIMIT 300")
            ]
            con.close()
            return self._json(rows)
        if u.path == "/api/oldgold":
            nm = names()
            con = connect()
            rows = [
                {
                    "date": r["date"],
                    "customer": nm.get(r["customer_id"], ""),
                    "description": r["description"],
                    "fine_wt": r["fine_wt"],
                    "fine_val": r["fine_val"],
                }
                for r in con.execute("SELECT * FROM oldgold ORDER BY date DESC")
            ]
            con.close()
            return self._json(rows)
        if u.path == "/api/export":
            raw = json.dumps(export_blob(), indent=2).encode("utf-8")
            self.send_response(200)
            self.send_header("Content-Type", "application/json")
            self.send_header("Content-Disposition", "attachment; filename=AnushaJewelry_Backup.json")
            self.send_header("Content-Length", str(len(raw)))
            self.end_headers()
            self.wfile.write(raw)
            return
        return super().do_GET()

    def do_POST(self):
        u = urlparse(self.path)
        if u.path == "/api/customers":
            b = self._read_json()
            cid = nid()
            con = connect()
            con.execute(
                "INSERT INTO customers VALUES (?,?,?,?,?,?,?)",
                (cid, b.get("name"), b.get("phone"), b.get("address"), "", "", str(date.today())),
            )
            con.commit()
            con.close()
            return self._json({"id": cid})
        if u.path == "/api/orders":
            b = self._read_json()
            o = calc_order(b)
            con = connect()
            o["orderNo"] = next_order_no(con, o["date"])
            con.execute(
                "INSERT INTO orders VALUES (?,?,?,?,?,?,?,?)",
                (o["id"], o["orderNo"], o["customerId"], o["date"], o["status"], o["ornament"], o["total"], json.dumps(o)),
            )
            con.execute(
                "INSERT INTO ledger VALUES (?,?,?,?,?,?,?,?)",
                (nid(), o["customerId"], "bill", "debit", o["total"], "Bill: " + o["orderNo"], o["date"], o["id"]),
            )
            con.commit()
            con.close()
            return self._json({"id": o["id"], "order_no": o["orderNo"], "total": o["total"]})
        if u.path == "/api/ledger":
            b = self._read_json()
            con = connect()
            con.execute(
                "INSERT INTO ledger VALUES (?,?,?,?,?,?,?,?)",
                (
                    nid(),
                    b.get("customer_id"),
                    b.get("entry_type") or "payment",
                    b.get("side") or "credit",
                    num(b.get("amount")),
                    b.get("note") or "",
                    str(date.today()),
                    "",
                ),
            )
            con.commit()
            con.close()
            return self._json({"ok": True})
        if u.path == "/api/import":
            n = int(self.headers.get("Content-Length") or 0)
            body = self.rfile.read(n)
            # multipart: find first {
            i = body.find(b"{")
            j = body.rfind(b"}")
            if i < 0 or j < 0:
                return self._json({"ok": False, "error": "No JSON in upload"}, 400)
            try:
                d = json.loads(body[i : j + 1])
            except json.JSONDecodeError:
                return self._json({"ok": False, "error": "Invalid JSON"}, 400)
            v = load_json_into_db(d)
            return self._json({"ok": v["ok"], "customers": v.get("customers"), "error": "; ".join(v.get("errors") or [])})
        self.send_error(404)


def main() -> None:
    init_db()
    seed_if_empty()
    host, port = "127.0.0.1", 5050
    httpd = ThreadingHTTPServer((host, port), Handler)
    print(f"Anusha Shop  http://{host}:{port}")
    print(f"Database     {DB}")
    httpd.serve_forever()


if __name__ == "__main__":
    main()
