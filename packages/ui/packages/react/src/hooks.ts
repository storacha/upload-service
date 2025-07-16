import type { Client, Space, Account, ServiceConfig } from '@storacha/ui-core'

import {
  useState,
  useEffect,
  useCallback,
  startTransition as reactStartTransition,
} from 'react'
import { STORE_SAVE_EVENT, createClient } from '@storacha/ui-core'

// `startTransition` is a new API in React 18. If we're on an older React,
// that's fine, we can just skip the transition. Older versions of React don't
// do anything that would need to have this marked for them.
const startTransition =
  typeof reactStartTransition === 'function'
    ? reactStartTransition
    : (callback: () => void) => {
        callback()
      }

export type DatamodelProps = ServiceConfig & {
  receiptsEndpoint?: URL
}

export interface Datamodel {
  client?: Client
  accounts: Account[]
  spaces: Space[]
  logout: () => Promise<void>
}

// KMS Configuration types and hook
export interface KMSConfig {
  keyManagerServiceURL: string
  keyManagerServiceDID: string
  location?: string
  keyring?: string
  /**
   * If set to true will allow HTTP connections to the KMS server. Default is false.
   */
  allowInsecureHttp?: boolean
}

/**
 * Hook for managing KMS configuration state.
 * Provides shared KMS config state that can be used by both upload and decryption flows.
 * @param initialConfig - Initial KMS configuration
 */
export function useKMSConfig(initialConfig?: KMSConfig): {
  kmsConfig: KMSConfig | undefined
  setKmsConfig: (config: KMSConfig | undefined) => void
  createKMSAdapter: () => Promise<any | null>
  isConfigured: boolean
} {
  // If no initial config provided, try to create from environment variables
  const defaultConfig = initialConfig || (
     {
      keyManagerServiceURL: process.env.NEXT_PUBLIC_UCAN_KMS_URL ?? 'https://kms.storacha.network',
      keyManagerServiceDID: process.env.NEXT_PUBLIC_UCAN_KMS_DID ?? 'did:web:kms.storacha.network',
      location: process.env.NEXT_PUBLIC_UCAN_KMS_LOCATION,
      keyring: process.env.NEXT_PUBLIC_UCAN_KMS_KEYRING,
      allowInsecureHttp: process.env.NEXT_PUBLIC_UCAN_KMS_ALLOW_INSECURE_HTTP === 'true'
    }
  )
  
  const [kmsConfig, setKmsConfig] = useState<KMSConfig | undefined>(defaultConfig)
  
  // Helper function to create KMS adapter with fallbacks
  const createKMSAdapter = useCallback(async (): Promise<any | null> => {
    if (!kmsConfig?.keyManagerServiceURL || !kmsConfig?.keyManagerServiceDID) {
      return null
    }
    
    try {
      const { createGenericKMSAdapter } = await import('@storacha/encrypt-upload-client/factories.browser')
      
      return createGenericKMSAdapter(
        kmsConfig.keyManagerServiceURL,
        kmsConfig.keyManagerServiceDID,
        {
          allowInsecureHttp: kmsConfig.allowInsecureHttp === true,
        }
      )
    } catch (error) {
      console.error('Failed to create KMS adapter:', error)
      return null
    }
  }, [kmsConfig])
  
  return {
    kmsConfig,
    setKmsConfig,
    createKMSAdapter,
    isConfigured: Boolean(kmsConfig?.keyManagerServiceURL && kmsConfig?.keyManagerServiceDID)
  }
}

export function useDatamodel({
  servicePrincipal,
  connection,
  receiptsEndpoint,
}: DatamodelProps): Datamodel {
  const [client, setClient] = useState<Client>()
  const [events, setEvents] = useState<EventTarget>()
  const [accounts, setAccounts] = useState<Account[]>([])
  const [spaces, setSpaces] = useState<Space[]>([])

  // update this function any time servicePrincipal or connection change
  const setupClient = useCallback(async (): Promise<void> => {
    const { client, events } = await createClient({
      servicePrincipal,
      connection,
      receiptsEndpoint,
    })
    startTransition(() => {
      setClient(client)
      setEvents(events)
      setAccounts(Object.values(client.accounts()))
      setSpaces(client.spaces())
    })
    await client.capability.access.claim()
  }, [servicePrincipal, connection])

  // run setupClient once each time it changes
  useEffect(() => {
    void setupClient()
  }, [setupClient])

  // set up event listeners to refresh accounts and spaces when
  // the store:save event from @storacha/ui-core happens
  useEffect(() => {
    if (client === undefined || events === undefined) return

    const handleStoreSave: () => void = () => {
      startTransition(() => {
        setAccounts(Object.values(client.accounts()))
        setSpaces(client.spaces())
      })
    }

    events.addEventListener(STORE_SAVE_EVENT, handleStoreSave)
    return () => {
      events?.removeEventListener(STORE_SAVE_EVENT, handleStoreSave)
    }
  }, [client, events])

  const logout = async (): Promise<void> => {
    // it's possible that setupClient hasn't been run yet - run createClient here
    // to get a reliable handle on the latest store
    const { store } = await createClient({ servicePrincipal, connection })
    await store.reset()
    // set state back to defaults
    startTransition(() => {
      setClient(undefined)
      setEvents(undefined)
      setAccounts([])
      setSpaces([])
    })
    // set state up again
    await setupClient()
  }

  return { client, accounts, spaces, logout }
}
