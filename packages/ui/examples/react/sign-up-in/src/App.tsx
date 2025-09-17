import {
  Provider,
  useW3,
  StorachaAuth,
  useStorachaAuthEnhanced,
} from '@storacha/ui-react'
import '@storacha/ui-react/globals.css'

function AuthenticatedApp() {
  const [{ accounts }] = useW3()
  const auth = useStorachaAuthEnhanced()

  return (
    <div className="min-h-screen flex items-center justify-center p-4">
      <div className="max-w-2xl w-full">
        <div className="bg-white rounded-2xl shadow-md p-8 border border-[var(--hot-red)]">
          <div className="flex items-center gap-4 mb-6">
            <img
              src="/storacha-logo.svg"
              alt="Storacha"
              width={48}
              height={48}
            />
            <h1 className="text-2xl font-epilogue text-[var(--hot-red)]">
              Welcome to Storacha!
            </h1>
          </div>

          <div className="space-y-4">
            <div className="p-4 bg-[var(--hot-red-light)] rounded-xl">
              <p className="text-sm font-semibold text-[var(--hot-red)] mb-2">
                Authentication Status
              </p>
              <p className="text-gray-700">
                You&apos;re signed in as{' '}
                <b className="text-[var(--hot-red)]">
                  {accounts[0]?.toEmail()}
                </b>
              </p>
            </div>

            <div className="pt-4">
              <button
                onClick={auth.logoutWithTracking}
                className="inline-block bg-[var(--hot-red)] border border-[var(--hot-red)] hover:bg-white hover:text-[var(--hot-red)] font-epilogue text-white uppercase text-sm px-6 py-2 rounded-full whitespace-nowrap w-full"
              >
                Sign Out
              </button>
            </div>
          </div>
        </div>
      </div>
    </div>
  )
}

function App() {
  // @ts-ignore
  const handleAuthEvent = (event, properties) => {
    console.log('Auth Event:', event, properties)
    // In a real app, you would send this to your analytics service
  }

  return (
    <div className="min-h-screen">
      <Provider>
        <StorachaAuth
          onAuthEvent={handleAuthEvent}
          enableIframeSupport={true}
          serviceName="storacha.network"
          termsUrl="https://docs.storacha.network/terms/"
        >
          <StorachaAuth.Ensurer>
            <AuthenticatedApp />
          </StorachaAuth.Ensurer>
        </StorachaAuth>
      </Provider>
    </div>
  )
}

export default App
