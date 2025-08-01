# set these to your upload API service URL and the DID your service is using as its service DID
NEXT_PUBLIC_W3UP_SERVICE_URL=https://staging.up.storacha.network
NEXT_PUBLIC_W3UP_RECEIPTS_URL=https://staging.up.storacha.network/receipt/
NEXT_PUBLIC_W3UP_SERVICE_DID=did:web:staging.storacha.network
NEXT_PUBLIC_W3UP_PROVIDER=did:web:staging.storacha.network
NEXT_PUBLIC_IPFS_GATEWAY_URL=https://%ROOT_CID%.ipfs-staging.w3s.link

# set these to your gateway service URL and DID 
NEXT_PUBLIC_W3UP_GATEWAY_HOST=https://staging.w3s.link
NEXT_PUBLIC_W3UP_GATEWAY_ID=did:web:staging.w3s.link

# set these to values from Stripe settings
NEXT_PUBLIC_STRIPE_PRICING_TABLE_ID=prctbl_1OCeiEF6A5ufQX5vPFlWRkPm
NEXT_PUBLIC_STRIPE_PUBLISHABLE_KEY=pk_test_51LO87hF6A5ufQX5viNsPTbuErzfavdrEFoBuaJJPfoIhzQXdOUdefwL70YewaXA32ZrSRbK4U4fqebC7SVtyeNcz00qmgNgueC
NEXT_PUBLIC_STRIPE_CUSTOMER_PORTAL_LINK=https://billing.stripe.com/p/login/test_6oE29Gff99KO6mk8ww

# set this to skip forcing users to pick a Stripe plan
NEXT_PUBLIC_DISABLE_PLAN_GATE=false

# point these at the marketing website and referrals service 
NEXT_PUBLIC_REFERRAL_URL=http://localhost:3001/referred
NEXT_PUBLIC_REFERRALS_SERVICE_URL=http://localhost:4001

# Sentry
NEXT_PUBLIC_SENTRY_DSN=https://bf79c216fe3c72328219f04aabeebc99@o609598.ingest.us.sentry.io/4508456692940801
NEXT_PUBLIC_SENTRY_ORG=storacha-it
NEXT_PUBLIC_SENTRY_PROJECT=console
NEXT_PUBLIC_SENTRY_ENV=development

# Humanode
NEXT_PUBLIC_HUMANODE_AUTH_URL=https://auth.demo-storacha-2025-03-31.oauth2.humanode.io/oauth2/auth
NEXT_PUBLIC_HUMANODE_CLIENT_ID=e9756297-b2d1-4bbe-a139-a9ad1cdc43ee
NEXT_PUBLIC_HUMANODE_OAUTH_CALLBACK_URL=https://staging.up.storacha.network/oauth/humanode/callback

# SSO
NEXT_PUBLIC_PRIVATE_SPACES_DOMAINS=storacha.network
NEXT_PUBLIC_UCAN_KMS_URL=https://staging.kms.storacha.network
NEXT_PUBLIC_UCAN_KMS_DID=did:web:staging.kms.storacha.network
NEXT_PUBLIC_SSO_ALLOWED_ORIGINS=
