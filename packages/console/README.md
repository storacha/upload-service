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

### Using an alternate w3up service

By default, this app connects to `https://up.web3.storage`, and uses `did:web:web3.storage` as provider. To use an alternate service and/or provider, specify the service URL, service DID and provider DID in your environment variables, like so:

```
NEXT_PUBLIC_W3UP_SERVICE_URL=https://your.w3up.service
NEXT_PUBLIC_W3UP_SERVICE_DID=did:your-service-did
NEXT_PUBLIC_W3UP_PROVIDER=did:your-provider-did
```

An example `.env.local` file can be found in `.env.tpl`.

If you are using `w3infra`, the service URL will be displayed as the `UploadApiStack`'s `ApiEndpoint` output once `npm start` has successfully set up your development environment.

<p style="text-align:center;padding-top:2rem">⁂</p>
