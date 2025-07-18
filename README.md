# Shopify Payouts Automation (GraphQL)

This script queries the **Shopify GraphQL API** to fetch **Shopify Payout Data** for automation purposes. It retrieves all balance transactions for a given date (default: yesterday) and handles pagination.

---

## ✅ Features
- Fetch Shopify payout data using **GraphQL API**.
- Handles pagination automatically.
- Filters out internal **TRANSFER** transactions.
- Easy to customize for different dates.

---

## 🛠 Requirements
- **Node.js** (v16+)
- **npm** or **yarn**
- A **Shopify Admin API Access Token** with the scope:
- `.env` file for credentials.

---

## 📦 Installation
```bash
git clone <your-repo-url>
cd <your-repo-folder>
npm install
```
---
## ⚙️ Environment Setup
Create a .env file in the project root with:
- SHOPIFY_STORE=your-store-name
- SHOPIFY_ACCESS_TOKEN=your-access-token

## ▶️ Usage
Run the script:
- node shopifyPayout.js
- Default Behavior: Fetches payouts for yesterday's date.
- Custom Date: Update the fetchPayoutsByDate('YYYY-MM-DD') function call in the script:
fetchPayoutsByDate('2023-10-01');
## ✅ Notes
Pagination is handled automatically.

Filters out TRANSFER transactions to avoid duplicate or irrelevant data.
## 🚀 Perfect for:
- Automation workflows
- Financial reconciliation
- Custom Shopify reporting
