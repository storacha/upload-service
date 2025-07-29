import { useW3 } from '@storacha/ui-react'
import { useState } from 'react'
import type { Space, UnknownLink } from '@storacha/ui-react'
import { parse as parseLink } from 'multiformats/link'
import { create as createEncryptedClient } from '@storacha/encrypt-upload-client'
import { useKMSConfig } from '@storacha/ui-react'
import { decrypt } from '@storacha/capabilities/space'
import type { FileMetadata } from '@storacha/encrypt-upload-client/types'

interface DecryptionState {
  loading: boolean
  error: string | null
  fileMetadata?: FileMetadata
}

export const useFileDecryption = (space?: Space) => {
  const [{ client }] = useW3()
  const [state, setState] = useState<DecryptionState>({
    loading: false,
    error: null,
    fileMetadata: undefined
  })

  const { createKMSAdapter, isConfigured } = useKMSConfig()

  const downloadBlob = (blob: Blob, filename: string) => {
    const url = URL.createObjectURL(blob)
    const a = document.createElement('a')
    a.href = url
    a.download = filename
    document.body.appendChild(a)
    a.click()
    document.body.removeChild(a)
    URL.revokeObjectURL(url)
  }

  const streamToBlob = async (stream: ReadableStream, mimeType?: string): Promise<Blob> => {
    const reader = stream.getReader();
    const chunks: Uint8Array[] = [];
    let done = false;
    let totalBytes = 0;

    while (!done) {
      const { value, done: isDone } = await reader.read();
      done = isDone;
      if (value) {
        chunks.push(value);
        totalBytes += value.length;
      }
    }

    return new Blob(chunks, { type: mimeType || 'application/octet-stream' });
  };

  const decryptAndDownload = async (cid: UnknownLink | string, filename?: string) => {
    if (!client || !space || space.access?.type !== 'private') {
      throw new Error('Invalid state: client, space, or private space access required')
    }

    setState({ loading: true, error: null, fileMetadata: undefined })

    try {
      // Create crypto adapter using shared KMS config
      const cryptoAdapter = await createKMSAdapter()
      if (!cryptoAdapter) {
        throw new Error('KMS configuration required for decryption')
      }

      // Create encrypted client
      const encryptedClient = await createEncryptedClient({
        storachaClient: client,
        cryptoAdapter
      })

      // Parse CID if it's a string
      const encryptionMetadataCID = typeof cid === 'string' ? parseLink(cid) : cid
      const proofs = client.proofs([
        {
          can: 'space/content/decrypt',
          with: space.did()
        }
      ])
      .map(proof => /* @type {import('@ucanto/interface').Delegation} */ (proof))
      .filter(delegation => !delegation.capabilities.some(cap => cap.can === '*' || 
          cap.can === 'ucan/attest' ||
          cap.with === 'ucan:*'))
      
      const decryptDelegation = await decrypt.delegate({
        issuer: client.agent.issuer,
        audience: client.agent.issuer,
        with: space.did(),
        nb: {
          resource: encryptionMetadataCID,
        },
        expiration: Math.floor(Date.now() / 1000) + 60 * 15, // 15 minutes
        proofs,
      })

      // Downloads the encrypted file, and decrypts it locally
      const { stream: decryptedStream, fileMetadata } = await encryptedClient.retrieveAndDecryptFile(
        encryptionMetadataCID,
        {
          spaceDID: space.did(),
          decryptDelegation, 
          proofs,
        }
      )

      // Use metadata for filename and MIME type, with robust fallbacks
      let finalFilename: string
      if (fileMetadata?.name) {
        finalFilename = fileMetadata.name
      } else if (fileMetadata?.extension) {
        finalFilename = `decrypted-file-${Date.now()}.${fileMetadata.extension}`
      } else if (fileMetadata?.type) {
        // Try to guess extension from MIME type
        const mimeExtension = fileMetadata.type.split('/')[1] || 'bin'
        finalFilename = `decrypted-file-${Date.now()}.${mimeExtension}`
      } else {
        finalFilename = `decrypted-file-${Date.now()}`
      }
      const mimeType = fileMetadata?.type

      // Convert stream to blob to allow user to download the decrypted file
      const blob = await streamToBlob(decryptedStream, mimeType)
      downloadBlob(blob, finalFilename)
      setState({ loading: false, error: null, fileMetadata })
    } catch (error) {
      console.error('Decryption failed:', error)
      setState({ 
        loading: false, 
        error: error instanceof Error ? error.message : 'Decryption failed',
        fileMetadata: undefined
      })
      throw error
    }
  }

  const canDecrypt = Boolean(
    client && 
    space && 
    space.access?.type === 'private' &&
    isConfigured
  )

  return {
    decryptAndDownload,
    canDecrypt,
    loading: state.loading,
    error: state.error,
    fileMetadata: state.fileMetadata
  }
} 