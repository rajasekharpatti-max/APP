#!/usr/bin/env node
/** Integrity check for Anusha Jewelry AJ-v7 backup. Run: node jewelry/verify.mjs */
import { readFileSync } from "fs";
import { dirname, join } from "path";
import { fileURLToPath } from "url";

const NEED = ["version","customers","orders","ledger","workers","suppliers","oldGold","goldrate","shopprofile"];
const root = dirname(fileURLToPath(import.meta.url));
const raw = readFileSync(join(root, "data/AnushaJewelry_Backup.json"), "utf8");
const d = JSON.parse(raw);
const errors = [];
NEED.forEach(k => { if (!(k in d)) errors.push("missing " + k); });
if (d.shopprofile?.name !== "ANUSHA JEWELRY") errors.push("shop name mismatch");
if (d.customers.length !== 81) errors.push("expected 81 customers, got " + d.customers.length);
if (d.orders.length !== 106) errors.push("expected 106 orders, got " + d.orders.length);
if (d.ledger.length !== 292) errors.push("expected 292 ledger, got " + d.ledger.length);

const o = d.orders[0];
const gross = parseFloat(o.weight);
const waste = gross * parseFloat(o.wastagePct) / 100;
const goldVal = (gross + waste) * parseFloat(o.rate);
const total = goldVal + parseFloat(o.hallmarkCh || 0);
if (Math.abs(total - o.total) > 1) errors.push("order 0001 total mismatch " + total + " vs " + o.total);

const ids = new Set(d.customers.map(c => c.id));
const orphan = d.orders.filter(x => x.customerId && !ids.has(x.customerId)).length;
if (orphan) errors.push("orphan orders " + orphan);

if (errors.length) {
  console.error("FAIL\n" + errors.join("\n"));
  process.exit(1);
}
console.log("OK AJ-v7 " + d.shopprofile.name + " · " + d.customers.length + " customers · " + d.orders.length + " orders · first bill ₹" + Math.round(o.total));
