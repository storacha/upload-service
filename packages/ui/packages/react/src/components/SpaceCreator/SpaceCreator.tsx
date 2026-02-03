import { ReactNode, useState, FormEvent, ChangeEvent } from 'react'
import { useW3 } from '../../providers/Provider.js'
import { Space } from '@storacha/ui-core'
import * as UcantoClient from '@ucanto/client'
import { HTTP } from '@ucanto/transport'
import * as CAR from '@ucanto/transport/car'

export interface SpaceCreatorFormProps {
  onSuccess?: (space: Space) => void
  onCancel?: () => void
  defaultName?: string
  className?: string
  variant?: 'inline' | 'modal' | 'page'
  enablePrivateSpaces?: boolean
  gatewayConfig?: {
    id?: string
    host?: string
  }
  providerDID?: string
  loadingComponent?: ReactNode
  errorComponent?: (error: Error) => ReactNode
}

export function SpaceCreatorForm({
  onSuccess,
  onCancel,
  defaultName = '',
  className = '',
  variant = 'inline',
  enablePrivateSpaces = false,
  gatewayConfig,
  providerDID,
  loadingComponent,
  errorComponent
}: SpaceCreatorFormProps): ReactNode {
  const [{ client, accounts }] = useW3()
  const [submitted, setSubmitted] = useState(false)
  const [name, setName] = useState(defaultName)
  const [accessType, setAccessType] = useState<'public' | 'private'>('public')
  const [error, setError] = useState<Error | null>(null)

  const handleSubmit = async (e: FormEvent<HTMLFormElement>): Promise<void> => {
    e.preventDefault()
    if (!client) return

    const account = accounts[0]
    if (!account) {
      const err = new Error('No account found. Please authorize your email first.')
      setError(err)
      return
    }

    setSubmitted(true)
    setError(null)

    try {
      const { ok: plan } = await account.plan.get()
      if (!plan) {
        throw new Error('A payment plan is required to create a space.')
      }

      const toWebDID = (input?: string) =>
        UcantoClient.Schema.DID.match({ method: 'web' }).from(input)

      const gatewayId = toWebDID(gatewayConfig?.id) ?? toWebDID('did:web:w3s.link')
      const gatewayHost = gatewayConfig?.host ?? 'https://w3s.link'

      const gateway = UcantoClient.connect({
        id: {
          did: () => gatewayId
        },
        codec: CAR.outbound,
        channel: HTTP.open({ url: new URL(gatewayHost) }) as any,
      })

      const spaceConfig: any = {
        authorizeGatewayServices: [gateway],
        access: {
          type: accessType,
        }
      }

      if (accessType === 'private' && enablePrivateSpaces) {
        spaceConfig.access.encryption = {
          provider: 'google-kms',
          algorithm: 'RSA_DECRYPT_OAEP_3072_SHA256',
        }
      }

      const space = await client.createSpace(name, spaceConfig)

      const provider = toWebDID(providerDID) || toWebDID('did:web:web3.storage')
      const result = await account.provision(space.did(), { provider })
      
      if (result.error) {
        throw new Error(`Failed provisioning space: ${result.error}`)
      }

      await space.save()

      const recovery = await space.createRecovery(account.did())
      await client.capability.access.delegate({
        space: space.did(),
        delegations: [recovery],
      })

      await client.setCurrentSpace(space.did())

      setSubmitted(false)
      setName('')
      setAccessType('public')

      if (onSuccess) {
        const createdSpace = client.spaces().find((s: Space) => s.did() === space.did())
        if (createdSpace) {
          onSuccess(createdSpace)
        }
      }
    } catch (err) {
      setSubmitted(false)
      const error = err instanceof Error ? err : new Error('Failed to create space')
      setError(error)
      console.error('Failed to create space:', err)
      
      if (errorComponent) {
      }
    }
  }

  if (submitted) {
    if (loadingComponent) {
      return <>{loadingComponent}</>
    }
    return (
      <div className={className}>
        <div>Creating space...</div>
      </div>
    )
  }

  if (error && errorComponent) {
    return <>{errorComponent(error)}</>
  }

  const formContent = (
    <>
      <div>
        <label htmlFor="space-name">
          Space Name
        </label>
        <input
          id="space-name"
          type="text"
          value={name}
          onChange={(e: ChangeEvent<HTMLInputElement>) => setName(e.target.value)}
          placeholder="Enter space name"
          required
        />
      </div>

      {enablePrivateSpaces && (
        <div>
          <label>
            <input
              type="radio"
              name="accessType"
              value="public"
              checked={accessType === 'public'}
              onChange={() => setAccessType('public')}
            />
            Public Space - Files stored unencrypted and accessible via IPFS
          </label>
          <label>
            <input
              type="radio"
              name="accessType"
              value="private"
              checked={accessType === 'private'}
              onChange={() => setAccessType('private')}
            />
            Private Space - Files encrypted locally before upload
          </label>
        </div>
      )}

      {error && (
        <div className="error">
          {error.message}
        </div>
      )}

      <div>
        <button type="submit" disabled={submitted}>
          Create {accessType === 'private' ? 'Private' : 'Public'} Space
        </button>
        {onCancel && (
          <button type="button" onClick={onCancel}>
            Cancel
          </button>
        )}
      </div>
    </>
  )

  return (
    <form className={className} onSubmit={handleSubmit}>
      {variant === 'modal' ? (
        <div className="modal">
          <div className="modal-content">
            {formContent}
          </div>
        </div>
      ) : (
        formContent
      )}
    </form>
  )
}

export interface SpaceCreatorProps {
  className?: string
  buttonText?: string
  formProps?: Omit<SpaceCreatorFormProps, 'onCancel'>
}

export function SpaceCreator({
  className = '',
  buttonText = 'Add Space',
  formProps = {}
}: SpaceCreatorProps): ReactNode {
  const [creating, setCreating] = useState(false)

  const handleSuccess = (space: Space) => {
    setCreating(false)
    if (formProps.onSuccess) {
      formProps.onSuccess(space)
    }
  }

  const handleCancel = () => {
    setCreating(false)
  }

  return (
    <div className={className}>
      {creating ? (
        <SpaceCreatorForm
          {...formProps}
          onSuccess={handleSuccess}
          onCancel={handleCancel}
        />
      ) : (
        <button onClick={() => setCreating(true)}>
          {buttonText}
        </button>
      )}
    </div>
  )
}
