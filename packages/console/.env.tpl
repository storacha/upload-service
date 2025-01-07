# set these to your upload API service URL and the DID your service is using as its service DID
NEXT_PUBLIC_W3UP_SERVICE_URL=https://staging.up.web3.storage
NEXT_PUBLIC_W3UP_RECEIPTS_URL=https://staging.up.web3.storage/receipt/
NEXT_PUBLIC_W3UP_SERVICE_DID=did:web:staging.web3.storage
NEXT_PUBLIC_W3UP_PROVIDER=did:web:staging.web3.storage

# set these to your gateway service URL and DID 
NEXT_PUBLIC_W3UP_GATEWAY_HOST=https://freeway-staging.dag.haus
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
