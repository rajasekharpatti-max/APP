# Publish Anusha Jewelry on Google Play

I cannot upload the app to Play for you. Google only accepts **your** Play Console account. This folder is the Android app ready to upload.

## What you already have

- App name: **Anusha Jewelry**
- Package: `com.anushajewelry.shop`
- Phone UI (bottom menu) in `mobile/www`
- Privacy policy: `docs/privacy.html` (must be a **public https link**)
- Screenshots: `mobile/store-listing/` (Home, Customers, Orders)

## 1. Google Play developer account (once)

1. Open https://play.google.com/console
2. Pay the **one-time** registration (about US$25)
3. Use your name / Anusha Jewelry, Nellore
4. Wait until Google approves the account (can take hours to a few days)

## 2. Put the privacy page on the internet

Play will reject the app without a public privacy URL.

Easiest: GitHub Pages on this repo.

1. GitHub → this repo → Settings → Pages → Deploy from branch `main` (or this PR branch) folder `/docs`
2. Privacy URL will look like:  
   `https://rajasekharpatti-max.github.io/APP/privacy.html`

## 3. Build the file Play wants (.aab)

On a computer with **Android Studio**:

```bash
cd mobile
npm install
npx cap sync android
npx cap open android
```

In Android Studio: **Build → Generate Signed App Bundle / APK → Android App Bundle**.

Create a new upload keystore. Save the `.jks` and passwords **offline**. Never put them in GitHub.

Output: `app-release.aab`

## 4. Create the Play listing

Play Console → Create app

| Field | Use this |
|---|---|
| App name | Anusha Jewelry |
| Default language | English (India) |
| App or game | App |
| Free or paid | Free |
| Category | Business |
| Short description | Shop book for gold & silver — customers, khata, orders, old gold. Nellore. |
| Full description | See below |
| Phone screenshots | Upload `mobile/store-listing/*.png` (need at least 2) |
| Icon | `mobile/resources/icon.png` (512×512) |
| Privacy policy | Your GitHub Pages URL |

**Full description (copy):**

```
Anusha Jewelry is a shop book for the jewellery counter.

• Customers and phone numbers
• Orders with wastage, making, HUID
• Khata (credit / due)
• Old gold purchase
• Gold 22K / 24K / silver rate
• Backup JSON on your phone

Data stays on the device. Export a JSON backup every night.

Made for Anusha Jewelry, Nellore, Andhra Pradesh.
```

## 5. Data safety form (important)

- Does the app collect data? **Yes** — name, phone, address (your customers)
- Is it shared with other companies? **No**
- Encrypted in transit? Not sent to our servers
- Users can delete data? Yes — clear app storage / uninstall
- Purpose: App functionality (shop accounts)

## 6. Upload and send for review

1. Production (or Internal testing first — recommended)
2. Upload `app-release.aab`
3. Complete content rating (Business, all ages or 18+ if you prefer)
4. Countries: start with **India**
5. Send for review

First review often takes **a few days**. Google may ask for a demo video of the shop book. Record your phone: open app → customers → one order.

## Internal testing first

Use **Internal testing** with your Gmail. Install from the testing link, confirm WhatsApp due and backup export, then promote to Production.

## What this app is not

- Not a customer shopping app
- Not GST filing with the government
- Not on the Play Store until **you** complete the Console steps above
