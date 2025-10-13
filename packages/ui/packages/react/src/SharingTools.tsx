import type { As, Component, Props, Options } from 'ariakit-react-utils'
import type { SpaceDID } from '@storacha/ui-core'
import type { ChangeEvent, FormEventHandler } from 'react'
import type { Delegation, Capabilities } from '@ucanto/interface'

import {
  Fragment,
  useState,
  createContext,
  useContext,
  useCallback,
  useMemo,
} from 'react'
import { createComponent, createElement } from 'ariakit-react-utils'
import { useW3 } from './providers/Provider.js'

export interface DelegationItem {
  email: string
  capabilities: string[]
  delegation: Delegation<Capabilities>
  revoked?: boolean
}

export interface SharingToolsContextState {
  /**
   * Space being shared
   */
  spaceDID?: SpaceDID
  /**
   * Current input value for email/DID
   */
  shareValue: string
  /**
   * List of shared delegations
   */
  delegations: DelegationItem[]
  /**
   * Loading shared delegations
   */
  loadingDelegations: boolean
  /**
   * Set of emails currently being revoked
   */
  revokingEmails: Set<string>
  /**
   * Error during sharing operation
   */
  shareError?: string
  /**
   * File for import (UCAN delegation)
   */
  importFile?: File
  /**
   * Successfully imported delegation
   */
  importedDelegation?: Delegation<Capabilities>
}

export interface SharingToolsContextActions {
  /**
   * Set the space to share
   */
  setSpaceDID: (spaceDID: SpaceDID) => void
  /**
   * Set share input value
   */
  setShareValue: (value: string) => void
  /**
   * Share space via email
   */
  shareViaEmail: (email: string) => Promise<void>
  /**
   * Create delegation download for DID
   */
  createDelegationDownload: (did: string) => Promise<string>
  /**
   * Revoke delegation
   */
  revokeDelegation: (email: string, delegation: Delegation<Capabilities>) => Promise<void>
  /**
   * Set import file
   */
  setImportFile: (file?: File) => void
  /**
   * Import UCAN delegation
   */
  importDelegation: (file: File) => Promise<void>
  /**
   * Refresh delegations list
   */
  refreshDelegations: () => Promise<void>
  /**
   * Clear share error
   */
  clearShareError: () => void
}

export type SharingToolsContextValue = [
  state: SharingToolsContextState,
  actions: SharingToolsContextActions
]

export const SharingToolsContextDefaultValue: SharingToolsContextValue = [
  {
    shareValue: '',
    delegations: [],
    loadingDelegations: false,
    revokingEmails: new Set(),
  },
  {
    setSpaceDID: () => {
      throw new Error('missing set space DID function')
    },
    setShareValue: () => {
      throw new Error('missing set share value function')
    },
    shareViaEmail: async () => {
      throw new Error('missing share via email function')
    },
    createDelegationDownload: async () => {
      throw new Error('missing create delegation download function')
    },
    revokeDelegation: async () => {
      throw new Error('missing revoke delegation function')
    },
    setImportFile: () => {
      throw new Error('missing set import file function')
    },
    importDelegation: async () => {
      throw new Error('missing import delegation function')
    },
    refreshDelegations: async () => {
      throw new Error('missing refresh delegations function')
    },
    clearShareError: () => {
      throw new Error('missing clear share error function')
    },
  },
]

export const SharingToolsContext = createContext<SharingToolsContextValue>(
  SharingToolsContextDefaultValue
)

export type SharingToolsRootOptions<T extends As = typeof Fragment> = Options<T> & {
  /**
   * Space DID to share
   */
  spaceDID?: SpaceDID
  /**
   * Callback when space is successfully shared
   */
  onShare?: (delegation: DelegationItem) => void
  /**
   * Callback when delegation is successfully revoked
   */
  onRevoke?: (email: string) => void
  /**
   * Callback when delegation is successfully imported
   */
  onImport?: (delegation: Delegation<Capabilities>) => void
}

export type SharingToolsRootProps<T extends As = typeof Fragment> = Props<
  SharingToolsRootOptions<T>
>

/**
 * Top level component of the headless SharingTools.
 *
 * Must be used inside a w3ui Provider.
 */
export const SharingToolsRoot: Component<SharingToolsRootProps> =
  createComponent(({ spaceDID: initialSpaceDID, onShare, onRevoke, onImport, ...props }) => {
    const [{ client }] = useW3()
    const [spaceDID, setSpaceDID] = useState<SpaceDID | undefined>(initialSpaceDID)
    const [shareValue, setShareValue] = useState('')
    const [delegations, setDelegations] = useState<DelegationItem[]>([])
    const [loadingDelegations, setLoadingDelegations] = useState(false)
    const [revokingEmails, setRevokingEmails] = useState<Set<string>>(new Set())
    const [shareError, setShareError] = useState<string>()
    const [importFile, setImportFile] = useState<File>()
    const [importedDelegation, setImportedDelegation] = useState<Delegation<Capabilities>>()



    const shareViaEmail = useCallback(async (email: string) => {
      if (!client || !spaceDID) {
        throw new Error('Client or space not available')
      }

      const space = client.spaces().find(s => s.did() === spaceDID)
      if (!space) {
        throw new Error('Could not find space to share')
      }

      // Check if email already has a revoked delegation
      const existingRevokedDelegation = delegations.find(item => 
        item.email === email && item.revoked
      )
      
      if (existingRevokedDelegation) {
        setShareError(`Cannot grant access to ${email}. This email has a previously revoked delegation. Revoked delegations cannot be reactivated.`)
        return
      }

      setShareError(undefined)

      try {
        const delegation = await client.shareSpace(email as `${string}@${string}`, space.did())
        const delegationItem: DelegationItem = { 
          email, 
          capabilities: delegation.capabilities.map((c: any) => c.can),
          delegation 
        }
        
        setDelegations(prev => [...prev, delegationItem])
        setShareValue('')
        onShare?.(delegationItem)
      } catch (error) {
        setShareError(`Failed to share space: ${error instanceof Error ? error.message : 'Unknown error'}`)
      }
    }, [client, spaceDID, delegations, onShare])

    const createDelegationDownload = useCallback(async (did: string): Promise<string> => {
      if (!client) {
        throw new Error('Client not available')
      }

      const { DID } = await import('@ucanto/core')
      const audienceDID = DID.parse(did)
      const delegation = await client.createDelegation(audienceDID, [
        'space/*',
        'store/*',
        'upload/*',
        'access/*',
        'usage/*',
        'filecoin/*',
      ], {
        expiration: Infinity,
      })

      const archiveRes = await delegation.archive()
      if (archiveRes.error) {
        throw new Error('Failed to archive delegation', { cause: archiveRes.error })
      }

      const blob = new Blob([archiveRes.ok])
      return URL.createObjectURL(blob)
    }, [client])

    const revokeDelegation = useCallback(async (email: string, delegation: Delegation<Capabilities>) => {
      if (!client) {
        throw new Error('Client not available')
      }

      try {
        setRevokingEmails(prev => new Set([...prev, email]))
        await client.revokeDelegation(delegation.cid)
        
        // Mark delegation as revoked instead of removing
        setDelegations(prev => prev.map(item => 
          item.email === email ? { ...item, revoked: true } : item
        ))
        
        onRevoke?.(email)
      } catch (error) {
        throw error
      } finally {
        setRevokingEmails(prev => {
          const next = new Set(prev)
          next.delete(email)
          return next
        })
      }
    }, [client, onRevoke])

    const importDelegation = useCallback(async (file: File) => {
      if (!client) {
        throw new Error('Client not available')
      }

      try {
        const arrayBuffer = await file.arrayBuffer()
        const { extract } = await import('@ucanto/core/delegation')
        
        const res = await extract(new Uint8Array(arrayBuffer))
        if (res.error) {
          throw new Error('Failed to extract delegation', { cause: res.error })
        }

        const delegation = res.ok
        await client.addSpace(delegation)
        
        setImportedDelegation(delegation)
        setImportFile(undefined)
        onImport?.(delegation)
      } catch (error) {
        throw new Error(`Failed to import delegation: ${error instanceof Error ? error.message : 'Unknown error'}`)
      }
    }, [client, onImport])

    const refreshDelegations = useCallback(async () => {
      if (!client || !spaceDID) return

      setLoadingDelegations(true)
      try {
        // This would need to be implemented based on the specific client API
        // for fetching existing delegations for a space
        // For now, we'll keep the existing delegations
      } finally {
        setLoadingDelegations(false)
      }
    }, [client, spaceDID])

    const clearShareError = useCallback(() => {
      setShareError(undefined)
    }, [])

    const value = useMemo<SharingToolsContextValue>(
      () => [
        {
          spaceDID,
          shareValue,
          delegations,
          loadingDelegations,
          revokingEmails,
          shareError,
          importFile,
          importedDelegation,
        },
        {
          setSpaceDID,
          setShareValue,
          shareViaEmail,
          createDelegationDownload,
          revokeDelegation,
          setImportFile,
          importDelegation,
          refreshDelegations,
          clearShareError,
        },
      ],
      [
        spaceDID,
        shareValue,
        delegations,
        loadingDelegations,
        revokingEmails,
        shareError,
        importFile,
        importedDelegation,
        shareViaEmail,
        createDelegationDownload,
        revokeDelegation,
        importDelegation,
        refreshDelegations,
        clearShareError,
      ]
    )

    return (
      <SharingToolsContext.Provider value={value}>
        {createElement(Fragment, props)}
      </SharingToolsContext.Provider>
    )
  })

export type ShareFormOptions<T extends As = 'form'> = Options<T>
export type ShareFormProps<T extends As = 'form'> = Props<ShareFormOptions<T>>

/**
 * Form for sharing a space
 */
export const ShareForm: Component<ShareFormProps> =
  createComponent((props) => {
    const [{ shareValue }, { shareViaEmail, createDelegationDownload }] = useSharingTools()
    
    const isDID = (value: string): boolean => {
      try {
        return /^did:[a-z0-9]+:[a-zA-Z0-9._%-]+$/i.test(value.trim())
      } catch {
        return false
      }
    }

    const isEmail = (value: string): boolean => {
      const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/
      return !isDID(value) && emailRegex.test(value)
    }

    const handleSubmit: FormEventHandler<HTMLFormElement> = useCallback(
      async (e) => {
        e.preventDefault()
        if (isEmail(shareValue)) {
          await shareViaEmail(shareValue)
        } else if (isDID(shareValue)) {
          const url = await createDelegationDownload(shareValue)
          // Trigger download
          const link = document.createElement('a')
          link.href = url
          link.download = `delegation-${shareValue.split(':')[2]?.substring(0, 10) || 'unknown'}.ucan`
          document.body.appendChild(link)
          link.click()
          document.body.removeChild(link)
        }
      },
      [shareValue, shareViaEmail, createDelegationDownload]
    )

    return createElement('form', {
      ...props,
      onSubmit: handleSubmit,
    })
  })

export type ShareInputOptions<T extends As = 'input'> = Options<T>
export type ShareInputProps<T extends As = 'input'> = Props<ShareInputOptions<T>>

/**
 * Input for email or DID to share with
 */
export const ShareInput: Component<ShareInputProps> =
  createComponent((props) => {
    const [{ shareValue }, { setShareValue, clearShareError }] = useSharingTools()
    
    const handleChange = useCallback(
      (e: ChangeEvent<HTMLInputElement>) => {
        setShareValue(e.target.value)
        clearShareError()
      },
      [setShareValue, clearShareError]
    )

    return createElement('input', {
      ...props,
      type: 'text',
      value: shareValue,
      onChange: handleChange,
      placeholder: 'email or did:...',
    })
  })

export type ShareButtonOptions<T extends As = 'button'> = Options<T>
export type ShareButtonProps<T extends As = 'button'> = Props<ShareButtonOptions<T>>

/**
 * Button to submit share form
 */
export const ShareButton: Component<ShareButtonProps> =
  createComponent((props) => {
    const [{ shareValue }] = useSharingTools()
    
    const isDID = (value: string): boolean => {
      try {
        return /^did:[a-z0-9]+:[a-zA-Z0-9._%-]+$/i.test(value.trim())
      } catch {
        return false
      }
    }

    const isEmail = (value: string): boolean => {
      const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/
      return !isDID(value) && emailRegex.test(value)
    }

    const isValid = isEmail(shareValue) || isDID(shareValue)

    return createElement('button', {
      ...props,
      type: 'submit',
      disabled: !isValid,
    })
  })

export type DelegationListOptions<T extends As = 'div'> = Options<T>
export type DelegationListProps<T extends As = 'div'> = Props<DelegationListOptions<T>>

/**
 * List of shared delegations
 */
export const DelegationList: Component<DelegationListProps> =
  createComponent((props) => {
    return createElement('div', { ...props, role: 'list' })
  })

export type DelegationItemOptions<T extends As = 'div'> = Options<T> & {
  delegation: DelegationItem
}
export type DelegationItemProps<T extends As = 'div'> = Props<DelegationItemOptions<T>>

/**
 * Individual delegation item
 */
export const DelegationItemComponent: Component<DelegationItemProps> =
  createComponent(({ delegation, ...props }) => {
    return createElement('div', { ...props, role: 'listitem' })
  })

export type RevokeButtonOptions<T extends As = 'button'> = Options<T> & {
  delegation: DelegationItem
}
export type RevokeButtonProps<T extends As = 'button'> = Props<RevokeButtonOptions<T>>

/**
 * Button to revoke a delegation
 */
export const RevokeButton: Component<RevokeButtonProps> =
  createComponent(({ delegation, ...props }) => {
    const [{ revokingEmails }, { revokeDelegation }] = useSharingTools()
    
    const handleClick = useCallback(async () => {
      await revokeDelegation(delegation.email, delegation.delegation)
    }, [delegation, revokeDelegation])

    const isRevoking = revokingEmails.has(delegation.email)

    return createElement('button', {
      ...props,
      onClick: handleClick,
      disabled: isRevoking || delegation.revoked,
    })
  })

export type ImportFormOptions<T extends As = 'form'> = Options<T>
export type ImportFormProps<T extends As = 'form'> = Props<ImportFormOptions<T>>

/**
 * Form for importing UCAN delegations
 */
export const ImportForm: Component<ImportFormProps> =
  createComponent((props) => {
    const [{ importFile }, { importDelegation }] = useSharingTools()
    
    const handleSubmit: FormEventHandler<HTMLFormElement> = useCallback(
      async (e) => {
        e.preventDefault()
        if (importFile) {
          await importDelegation(importFile)
        }
      },
      [importFile, importDelegation]
    )

    return createElement('form', {
      ...props,
      onSubmit: handleSubmit,
    })
  })

export type ImportInputOptions<T extends As = 'input'> = Options<T>
export type ImportInputProps<T extends As = 'input'> = Props<ImportInputOptions<T>>

/**
 * File input for importing UCAN delegations
 */
export const ImportInput: Component<ImportInputProps> =
  createComponent((props) => {
    const [, { setImportFile }] = useSharingTools()
    
    const handleChange = useCallback(
      (e: ChangeEvent<HTMLInputElement>) => {
        const file = e.target.files?.[0]
        setImportFile(file)
      },
      [setImportFile]
    )

    return createElement('input', {
      ...props,
      type: 'file',
      accept: '.ucan,.car,application/vnd.ipfs.car',
      onChange: handleChange,
    })
  })

/**
 * Use the scoped sharing tools context state from a parent `SharingTools`.
 */
export function useSharingTools(): SharingToolsContextValue {
  return useContext(SharingToolsContext)
}

export const SharingTools = Object.assign(SharingToolsRoot, {
  ShareForm: ShareForm,
  ShareInput: ShareInput,
  ShareButton: ShareButton,
  DelegationList: DelegationList,
  DelegationItem: DelegationItemComponent,
  RevokeButton: RevokeButton,
  ImportForm: ImportForm,
  ImportInput: ImportInput,
})