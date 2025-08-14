import 'fake-indexeddb/auto'
import { test, expect, vi, afterEach, beforeEach } from 'vitest'
import { userEvent as user } from '@testing-library/user-event'
import { render, screen, cleanup } from '@testing-library/react'
import { useContext } from 'react'

import * as Link from 'multiformats/link'
import {
  Context,
  ContextDefaultValue,
  ContextValue,
} from '../src/providers/Provider.js'
import { Uploader, UploaderContext } from '../src/Uploader.js'

const SpaceDID = "did:key:z6Mkit3tepJFA1Em9S1BTLVNdJ6rmXTrBaTTbt55dxyQvKZF"

// Mock the encrypt-upload-client module
vi.mock('@storacha/encrypt-upload-client', () => ({
  create: vi.fn(),
}))

vi.mock('@storacha/encrypt-upload-client/factories.browser', () => ({
  createGenericKMSAdapter: vi.fn(),
}))

afterEach(() => {
  cleanup()
  vi.clearAllMocks()
})

beforeEach(() => {
  // Reset mocks before each test
  vi.clearAllMocks()
})

test('encrypted upload with private space', async () => {
  const cid = Link.parse(
    'bafybeibrqc2se2p3k4kfdwg7deigdggamlumemkiggrnqw3edrjosqhvnm'
  )
  
  const mockEncryptedClient = {
    encryptAndUploadFile: vi.fn().mockResolvedValue(cid),
  } as any
  
  const mockCryptoAdapter = {
    encrypt: vi.fn(),
    decrypt: vi.fn(),
  } as any

  // Mock the encrypted client creation
  const { create: createEncryptedClient } = await import('@storacha/encrypt-upload-client')
  vi.mocked(createEncryptedClient).mockResolvedValue(mockEncryptedClient)

  const { createGenericKMSAdapter } = await import('@storacha/encrypt-upload-client/factories.browser')
  vi.mocked(createGenericKMSAdapter).mockReturnValue(mockCryptoAdapter)

  const space = {
    did: vi.fn().mockReturnValue(SpaceDID),
    meta: vi.fn().mockReturnValue({
      access: {
        type: 'private',
        encryption: {
          provider: 'google-kms',
        },
      },
    }),
  }

  const client = {
    currentSpace: vi.fn().mockReturnValue(space),
    agent: {
      issuer: { did: () => 'did:key:agent123' },
      proofs: vi.fn().mockReturnValue([]),
    },
  }

  const contextValue: ContextValue = [
    {
      ...ContextDefaultValue[0],
      // @ts-expect-error not a real client
      client,
    },
    ContextDefaultValue[1],
  ]

  const handleComplete = vi.fn()
  render(
    <Context.Provider value={contextValue}>
      <Uploader onUploadComplete={handleComplete}>
        <Uploader.Form>
          <Uploader.Input data-testid="file-upload" />
          <input type="submit" value="Upload" />
        </Uploader.Form>
      </Uploader>
    </Context.Provider>
  )

  const file = new File(['encrypted content'], 'secret.txt', { type: 'text/plain' })

  const fileInput = screen.getByTestId('file-upload')
  await user.upload(fileInput, file)

  const submitButton = screen.getByText('Upload')
  await user.click(submitButton)

  // Wait for async operations to complete
  await new Promise(resolve => setTimeout(resolve, 100))

  // Verify encrypted client was created
  expect(createEncryptedClient).toHaveBeenCalledWith({
    storachaClient: client,
    cryptoAdapter: mockCryptoAdapter,
  })

  // Verify KMS adapter was created
  expect(createGenericKMSAdapter).toHaveBeenCalledWith(
    'https://kms.storacha.network',
    'did:web:kms.storacha.network',
    {
      allowInsecureHttp: false,
    }
  )

  // Verify encrypted upload was called
  expect(mockEncryptedClient.encryptAndUploadFile).toHaveBeenCalledWith(
    file,
    {
      issuer: client.agent.issuer,
      spaceDID: space.did(),
      proofs: [],
      fileMetadata: {
        name: 'secret.txt',
        type: 'text/plain',
        extension: 'txt',
      },
    },
    expect.objectContaining({
      onShardStored: expect.any(Function),
      onUploadProgress: expect.any(Function),
    })
  )

  // Verify completion handler was called
  expect(handleComplete).toHaveBeenCalledWith({
    file,
    files: [file],
    dataCID: cid,
  })
})

test('encrypted upload with custom KMS config', async () => {
  const cid = Link.parse(
    'bafybeibrqc2se2p3k4kfdwg7deigdggamlumemkiggrnqw3edrjosqhvnm'
  )
  
  const mockEncryptedClient = {
    encryptAndUploadFile: vi.fn().mockResolvedValue(cid),
  } as any
  
  const mockCryptoAdapter = {
    encrypt: vi.fn(),
    decrypt: vi.fn(),
  } as any

  const { create: createEncryptedClient } = await import('@storacha/encrypt-upload-client')
  vi.mocked(createEncryptedClient).mockResolvedValue(mockEncryptedClient)

  const { createGenericKMSAdapter } = await import('@storacha/encrypt-upload-client/factories.browser')
  vi.mocked(createGenericKMSAdapter).mockReturnValue(mockCryptoAdapter)

  const space = {
    did: vi.fn().mockReturnValue(SpaceDID),
    meta: vi.fn().mockReturnValue({
      access: {
        type: 'private',
        encryption: {
          provider: 'google-kms',
        },
      },
    }),
  }

  const client = {
    currentSpace: vi.fn().mockReturnValue(space),
    agent: {
      issuer: { did: () => 'did:key:agent123' },
      proofs: vi.fn().mockReturnValue([]),
    },
  }

  const customKmsConfig = {
    keyManagerServiceURL: 'https://custom-kms.example.com',
    keyManagerServiceDID: 'did:web:custom-kms.example.com',
    location: 'us-west1',
    keyring: 'test-keyring',
  }

  const contextValue: ContextValue = [
    {
      ...ContextDefaultValue[0],
      // @ts-expect-error not a real client
      client,
    },
    ContextDefaultValue[1],
  ]

  render(
    <Context.Provider value={contextValue}>
      <Uploader kmsConfig={customKmsConfig}>
        <Uploader.Form>
          <Uploader.Input data-testid="file-upload" />
          <input type="submit" value="Upload" />
        </Uploader.Form>
      </Uploader>
    </Context.Provider>
  )

  const file = new File(['encrypted content'], 'secret.txt', { type: 'text/plain' })

  const fileInput = screen.getByTestId('file-upload')
  await user.upload(fileInput, file)

  const submitButton = screen.getByText('Upload')
  await user.click(submitButton)

  // Wait for async operations to complete
  await new Promise(resolve => setTimeout(resolve, 100))

  // Verify custom KMS config was used
  expect(createGenericKMSAdapter).toHaveBeenCalledWith(
    customKmsConfig.keyManagerServiceURL,
    customKmsConfig.keyManagerServiceDID,
    {
      allowInsecureHttp: false,
    }
  )

  // Verify encryption config includes custom KMS settings
  expect(mockEncryptedClient.encryptAndUploadFile).toHaveBeenCalledWith(
    file,
    {
      issuer: client.agent.issuer,
      spaceDID: space.did(),
      location: customKmsConfig.location,
      keyring: customKmsConfig.keyring,
      proofs: [],
      fileMetadata: {
        name: 'secret.txt',
        type: 'text/plain',
        extension: 'txt',
      },
    },
    expect.objectContaining({
      onShardStored: expect.any(Function),
      onUploadProgress: expect.any(Function),
    })
  )
})

test('encrypted upload fails with multiple files', async () => {
  // We don't need to mock the encryption functions because the error should happen before they're called
  const space = {
    did: vi.fn().mockReturnValue('did:key:z6Mkit3tepJFA1Em9S1BTLVNdJ6rmXTrBaTTbt55dxyQvKZF'),
    meta: vi.fn().mockReturnValue({
      access: {
        type: 'private',
        encryption: {
          provider: 'google-kms',
          algorithm: 'aes-256'
        },
      },
    }),
  }

  const client = {
    currentSpace: vi.fn().mockReturnValue(space),
    agent: {
      issuer: { did: () => 'did:key:agent123' },
    },
  }

  let uploaderState: any
  const TestComponent = () => {
    const state = useContext(UploaderContext)
    uploaderState = state[0] // Store the state for assertions
    return (
      <Uploader.Form>
        <Uploader.Input data-testid="file-upload" multiple />
        <input type="submit" value="Upload" />
      </Uploader.Form>
    )
  }

  const contextValue: ContextValue = [
    {
      ...ContextDefaultValue[0],
      // @ts-expect-error not a real client
      client,
    },
    ContextDefaultValue[1],
  ]

  render(
    <Context.Provider value={contextValue}>
      <Uploader>
        <TestComponent />
      </Uploader>
    </Context.Provider>
  )

  const files = [
    new File(['content1'], 'file1.txt', { type: 'text/plain' }),
    new File(['content2'], 'file2.txt', { type: 'text/plain' }),
  ]

  const fileInput = screen.getByTestId('file-upload')
  await user.upload(fileInput, files)

  const submitButton = screen.getByText('Upload')
  await user.click(submitButton)

  // Wait for the error to propagate
  await new Promise(resolve => setTimeout(resolve, 1000))

  // Verify the upload failed with the correct error
  expect(uploaderState.status).toBe('failed')
  expect(uploaderState.error?.message).toBe('Encrypted uploads currently only support single files')

  // Verify NO encryption functions were called since the error happens before them
  const { create: createEncryptedClient } = await import('@storacha/encrypt-upload-client')
  expect(createEncryptedClient).not.toHaveBeenCalled()
})

test('encrypted upload falls back to regular upload for public space', async () => {
  const cid = Link.parse(
    'bafybeibrqc2se2p3k4kfdwg7deigdggamlumemkiggrnqw3edrjosqhvnm'
  )

  const space = {
    did: vi.fn().mockReturnValue(SpaceDID),
    meta: vi.fn().mockReturnValue({
      access: {
        type: 'public', // Not a private space
      },
    }),
  }

  const client = {
    currentSpace: vi.fn().mockReturnValue(space),
    uploadFile: vi.fn().mockResolvedValue(cid), // Mock regular upload
    agent: {
      issuer: { did: () => 'did:key:agent123' },
    },
  }

  const contextValue: ContextValue = [
    {
      ...ContextDefaultValue[0],
      // @ts-expect-error not a real client
      client,
    },
    ContextDefaultValue[1],
  ]

  const handleComplete = vi.fn()
  render(
    <Context.Provider value={contextValue}>
      <Uploader onUploadComplete={handleComplete} defaultEncryptionStrategy="kms">
        <Uploader.Form>
          <Uploader.Input data-testid="file-upload" />
          <input type="submit" value="Upload" />
        </Uploader.Form>
      </Uploader>
    </Context.Provider>
  )

  const file = new File(['content'], 'file.txt', { type: 'text/plain' })

  const fileInput = screen.getByTestId('file-upload')
  await user.upload(fileInput, file)

  const submitButton = screen.getByText('Upload')
  await user.click(submitButton)

  // Since this is a public space, it should use regular upload, not encrypted
  expect(client.uploadFile).toHaveBeenCalled()
  expect(handleComplete).toHaveBeenCalledWith({
    file,
    files: [file],
    dataCID: cid,
  })
})

test('encrypted upload fails with unsupported provider', async () => {
  const space = {
    did: vi.fn().mockReturnValue(SpaceDID),
    meta: vi.fn().mockReturnValue({
      access: {
        type: 'private',
        encryption: {
          provider: 'lit', // Unsupported provider
        },
      },
    }),
  }

  const client = {
    currentSpace: vi.fn().mockReturnValue(space),
    agent: {
      issuer: { did: () => 'did:key:agent123' },
    },
  }

  let uploaderState: any
  const TestComponent = () => {
    const state = useContext(UploaderContext)
    uploaderState = state[0] // Store the state for assertions
    return (
      <Uploader.Form>
        <Uploader.Input data-testid="file-upload" />
        <input type="submit" value="Upload" />
      </Uploader.Form>
    )
  }

  const contextValue: ContextValue = [
    {
      ...ContextDefaultValue[0],
      // @ts-expect-error not a real client
      client,
    },
    ContextDefaultValue[1],
  ]

  render(
    <Context.Provider value={contextValue}>
      <Uploader defaultEncryptionStrategy="kms">
        <TestComponent />
      </Uploader>
    </Context.Provider>
  )

  const file = new File(['content'], 'secret.txt', { type: 'text/plain' })

  const fileInput = screen.getByTestId('file-upload')
  await user.upload(fileInput, file)

  const submitButton = screen.getByText('Upload')
  await user.click(submitButton)

  // Wait for the error to propagate
  await new Promise(resolve => setTimeout(resolve, 1000))

  // Verify the upload failed with the correct error
  expect(uploaderState.status).toBe('failed')
  expect(uploaderState.error?.message).toBe('Encryption provider not supported')
  
  // Verify NO encryption functions were called since the provider is unsupported
  const { create: createEncryptedClient } = await import('@storacha/encrypt-upload-client')
  expect(createEncryptedClient).not.toHaveBeenCalled()
})

test('upload fails without space', async () => {
  const client = {
    currentSpace: vi.fn().mockReturnValue(null), // No space selected
    agent: {
      issuer: { did: () => 'did:key:agent123' },
    },
  }

  let uploaderState: any
  const TestComponent = () => {
    const state = useContext(UploaderContext)
    uploaderState = state[0] // Store the state for assertions
    return (
      <Uploader.Form>
        <Uploader.Input data-testid="file-upload" />
        <input type="submit" value="Upload" />
      </Uploader.Form>
    )
  }

  const contextValue: ContextValue = [
    {
      ...ContextDefaultValue[0],
      // @ts-expect-error not a real client
      client,
    },
    ContextDefaultValue[1],
  ]

  render(
    <Context.Provider value={contextValue}>
      <Uploader>
        <TestComponent />
      </Uploader>
    </Context.Provider>
  )

  const file = new File(['content'], 'file.txt', { type: 'text/plain' })

  const fileInput = screen.getByTestId('file-upload')
  await user.upload(fileInput, file)

  const submitButton = screen.getByText('Upload')
  await user.click(submitButton)

  // Wait for the error to propagate
  await new Promise(resolve => setTimeout(resolve, 1000))

  // Verify the upload failed with the correct error
  expect(uploaderState.status).toBe('failed')
  expect(uploaderState.error?.message).toBe('No space selected for upload')
  
  // Verify that currentSpace was called but returned null
  expect(client.currentSpace).toHaveBeenCalled()
}) 