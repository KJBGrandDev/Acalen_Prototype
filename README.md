# Acalen — Integrated POS, Batch Inventory & Decision Support Prototype

Interactive web prototype for **Acalen: Integrated Point-of-Sale (POS) and Inventory Management System for Waxi's Cafe for Business Decision Support Using Predictive Analytics and Rule-Based Decision Support** (System Integration and Architecture 1 · Academic Year 2026–2027).

## Live Demo (GitHub Pages)
Once GitHub Pages is enabled on this repository, the prototype is served at:
`https://kjbgranddev.github.io/Acalen_Prototype/`

### Enabling GitHub Pages (1-Click Setup)
1. Open **Settings → Pages** in `KJBGrandDev/Acalen_Prototype`.
2. Under **Build and deployment → Source**, pick either:
   - **GitHub Actions** (builds from `main` automatically using `.github/workflows/deploy.yml`), **or**
   - **Deploy from a branch** → select branch **`gh-pages`** and folder **`/ (root)`**.

## Proponents & Project Details
- **Basalan, Kent Jason** — Bachelor of Science in Information Technology
- **Pugoy, Xienna E.** — Bachelor of Science in Information Technology
- **Sanchez, Jushua** — Bachelor of Science in Information Technology
- **Adviser:** Ryan Billera, LPT
- **Institution:** Jose Maria College Foundation Inc. — College of Information Technology Education (Davao City, Philippines)
- **Beneficiary Locale:** SND Foods International Inc. | Waxi's Cafe

## Demo Accounts & Role-Based Access Control (RBAC)
You can sign in using the form or use the **Quick Demo Access** buttons on the login page:

| Role | Username | Password | Accessible Views |
| --- | --- | --- | --- |
| **Business Owner / Manager** | `manager@waxiscafe.ph` | `acalen2026` | Dashboard, POS, Inventory, Rules, Forecasts, Reports |
| **Cashier / Sales Staff** | `cashier@waxiscafe.ph` | `cashier2026` | POS Counter, Real-Time Stock Availability, Shift Returns & Receipts only (unit costs, rules & analytics hidden) |

## Implemented Prototype Modules
1. **System Login & RBAC (`LoginPage`)** — Form validation, password toggle, recovery modal, and role-enforced navigation.
2. **Manager Dashboard (`DashboardPage`)** — Live Today's Sales & Order Count synced with POS, Items Below Safety Stock, Items Nearing Expiry, 7-Day Demand Forecast chart, and clickable Acalen Advisory Recommendations.
3. **Point-of-Sale (`PosPage`)** — Category & search filtering, real-time stock checks, FEFO (First-Expired, First-Out) automatic batch deduction, Senior Citizen / PWD 20% discount + 12% VAT exemption, Cash & E-Wallet payments, printable browser receipt, and current-shift returns/voids.
4. **Inventory Management (`InventoryPage`)** — Batch-level stock tracking (`Add Product`, `Stock In`, `Stock Transfer`, `Record Wastage / Shrinkage`), FEFO batch detail modal, and stock movement audit history.
5. **Business Rules & Thresholds (`RulesPage`)** — No-code configuration of per-product Reorder Level, Safety Stock, Target Gross Profit Margin, Expiry Warning Days, and Markdown % with immediate rule re-evaluation.
6. **Demand Forecasting (`ForecastsPage`)** — Historical vs. Predicted Demand chart across 7 / 14 / 30-day horizons with Holt-Winters, Chronos-Bolt, and Hybrid Ensemble model comparison.
7. **Reports & Business Analysis (`ReportsPage`)** — Gross sales, transactions, gross profit margin, wastage & audit shrinkage summary, product profitability table, live Acalen Decision Support table, CSV export, and Manager Advisory Review queue.

## Local Development
```bash
npm install
npm run dev
```

To build for production:
```bash
npm run build
```
