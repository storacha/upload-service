# Console

> Your dashboard for storacha.network

Upload files & manage your spaces from your browser.

## Getting Started

To use the production site visit https://console.storacha.network

To contribute and customize console, copy `.env.tpl` to `.env` and run the development server:

```bash
pnpm dev
```

Open [http://localhost:3000](http://localhost:3000) with your browser to see the result.

You can start editing the page by modifying `app/page.tsx`. The page auto-updates as you edit the file.

### Environment Configuration

By default, this app connects to the **staging** environment at `https://staging.up.storacha.network` with `did:web:staging.up.storacha.network` as the service and provider DID (as configured in `.env.tpl`).

#### Using Production Environment

To connect to the production environment instead, set these in your `.env.local`:

```
NEXT_PUBLIC_W3UP_SERVICE_URL=https://up.storacha.network
NEXT_PUBLIC_W3UP_SERVICE_DID=did:web:up.storacha.network
NEXT_PUBLIC_W3UP_PROVIDER=did:web:up.storacha.network
NEXT_PUBLIC_W3UP_RECEIPTS_URL=https://up.storacha.network/receipt/
```

> **Note:** The legacy domain `up.web3.storage` redirects to the production endpoint `up.storacha.network`.

#### Using an alternate w3up service

To use an alternate service and/or provider, specify the service URL, service DID and provider DID in your environment variables, like so:

```
NEXT_PUBLIC_W3UP_SERVICE_URL=https://your.w3up.service
NEXT_PUBLIC_W3UP_SERVICE_DID=did:your-service-did
NEXT_PUBLIC_W3UP_PROVIDER=did:your-provider-did
NEXT_PUBLIC_W3UP_RECEIPTS_URL=https://your.w3up.service/receipt/
```

An example `.env.local` file can be found in `.env.tpl`.

If you are using `w3infra`, the service URL will be displayed as the `UploadApiStack`'s `ApiEndpoint` output once `npm start` has successfully set up your development environment.

### SSO Iframe Integration

The console supports SSO (Single Sign-On) integration via iframe embedding. For SSO iframe checkout, you can configure custom Stripe pricing tables:

```
NEXT_PUBLIC_SSO_IFRAME_STRIPE_PRICING_TABLE_ID=your-sso-pricing-table-id
NEXT_PUBLIC_SSO_IFRAME_STRIPE_PRICING_TABLE_PUB_KEY=your-sso-stripe-publishable-key
```

These pricing tables will be used automatically when the console detects it's running within an iframe context (SSO flow).

<p style="text-align:center;padding-top:2rem">⁂</p>

