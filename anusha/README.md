# Anusha Shop — new local app

This is a **new application** (not the browser-only page).

Shop data is a file on your computer: `anusha/anusha.db`.
First start loads the 8 Aug 2026 AJ-v7 backup (81 customers, 106 orders).

```bash
python3 anusha/app.py
```

Open **http://127.0.0.1:5050**

- Home dashboard, customers, orders, khata, old gold
- New order writes bill into khata
- Backup downloads AJ-v7 JSON; import checks the file first

No extra packages. Python 3 only. Export JSON every night.
