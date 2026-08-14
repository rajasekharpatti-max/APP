# Anusha Jewelry — shop manager

Local jewelry management for **ANUSHA JEWELRY, Nellore**. Built to match the existing **AJ-v7-COMBINED** backup (customers, orders, khata, old gold, karigar, suppliers, gold rate).

## Open

From this folder:

```bash
cd jewelry
python3 -m http.server 8080
```

Then open http://localhost:8080

First load imports `data/AnushaJewelry_Backup.json` (8 Aug 2026 shop file: 81 customers, 106 orders, 292 ledger lines).

## What it does

- **Dashboard** — 22K/24K/silver rate, bills, receivable, pending orders, khata due, WhatsApp reminder
- **Customers** — search, khata balance, statement
- **Orders** — wastage %, making, hallmark, HUID, GST 3%, bill print (A5-style)
- **Ledger** — bill / payment / advance / old gold / discount
- **Old gold** — fine weight × rate, credits customer khata
- **Karigar & suppliers**
- **Gold rate** with history
- **Backup** — export/import the same JSON format as the old AJ-v7 file

Data stays in this browser (`localStorage`). **Export a backup every day** (Backup / Trust page). Import is checked against the AJ-v7 keys; the last 3 imports can be undone from snapshots.

## Trust

```bash
node jewelry/verify.mjs
```

Checks the 8 Aug 2026 seed file: shop name, record counts, first bill maths, no orphan orders.

Dashboard shows a checksum and warns if you have not exported JSON in 24 hours.


This is shop records software, not trading signals.
