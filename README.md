# Slynk-copy

A web application that integrates **ePOS Now** POS system with **WooCommerce** to keep products, inventory, and orders in sync — purpose-built for [sterlinglams.com](https://sterlinglams.com).

## Features

| Feature | Description |
|---|---|
| **Product Sync** | Imports products from ePOS Now and creates/updates them in WooCommerce |
| **Inventory Sync** | Pushes stock levels from ePOS Now to WooCommerce in real time |
| **Orders View** | Browse recent WooCommerce orders directly in the app |
| **Connection Test** | Verify ePOS Now and WooCommerce API credentials are working |
| **Sync Logs** | Full audit trail of every sync operation with error details |
| **Dashboard** | At-a-glance status of both integrations and recent activity |

## Tech Stack

- **Next.js 16** (App Router + API Routes)
- **TypeScript**
- **Tailwind CSS**
- **SQLite** (via `better-sqlite3`) — stores credentials and sync logs locally
- **ePOS Now REST API v4**
- **WooCommerce REST API v3**

## Getting Started

### 1. Install dependencies

```bash
npm install
```

### 2. Run in development mode

```bash
npm run dev
```

Open [http://localhost:3000](http://localhost:3000).

### 3. Configure credentials

Navigate to **Settings** in the sidebar and enter:

#### ePOS Now

1. Log in to your ePOS Now Back Office
2. Go to **Apps → API → Create Application**
3. Copy your **Application ID** and **Application Secret**

#### WooCommerce (sterlinglams.com)

1. In WordPress, go to **WooCommerce → Settings → Advanced → REST API**
2. Click **Add Key**, select a user, set permissions to **Read/Write**
3. Copy the **Consumer Key** and **Consumer Secret**
4. Enter your store URL as `https://sterlinglams.com`

### 4. Test connections

Click **Test Connections** in Settings to verify both APIs are reachable.

### 5. Sync products

Go to the **Products** page and click **Sync Products**. Products from ePOS Now will be created/updated in WooCommerce.

## Production Build

```bash
npm run build
npm start
```

## Data Storage

Credentials and sync logs are stored in a local SQLite database at `./data/slynk.db`.  
This file is excluded from git via `.gitignore` — **never commit it** as it contains API keys.

## Environment Variables

| Variable | Default | Description |
|---|---|---|
| `DB_PATH` | `./data` | Directory for the SQLite database |
| `PORT` | `3000` | Port the server listens on |

## How Sync Works

```
ePOS Now ──► Slynk ──► WooCommerce
   Products       Create/Update products (SKU: epos-{id})
   Stock levels   Update stock_quantity
```

1. **Product sync**: Each ePOS Now product is matched to a WooCommerce product by SKU (`epos-{eposId}`). New products are created; existing ones are updated.
2. **Inventory sync**: Stock levels are aggregated across all ePOS Now locations and pushed to WooCommerce using the batch update API.
3. **Mapping table**: A local `product_mappings` table keeps track of ePOS Now ID ↔ WooCommerce ID pairs.

## Pages

| URL | Description |
|---|---|
| `/` | Dashboard — connection status, stats, quick sync |
| `/settings` | Configure ePOS Now and WooCommerce API credentials |
| `/products` | View product mappings and trigger product/inventory sync |
| `/orders` | Browse recent WooCommerce orders |
| `/logs` | Audit trail of all sync operations |
