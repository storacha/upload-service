'use client'

import { ReactNode, useMemo } from 'react'
import {
  useUploader,
  UploaderContextValue,
  UploaderProvider
} from '@w3ui/react-uploader'
import {
  useUploadsList,
  UploadsListContextValue,
  UploadsListProvider
} from '@w3ui/react-uploads-list'
import {
  Authenticator,
  useKeyring,
  KeyringContextValue,
  KeyringProvider
} from '@w3ui/react-keyring'
import { serviceConnection, servicePrincipal } from './services'

export interface W3APIContextValue {
  keyring: KeyringContextValue
  uploader: UploaderContextValue
  uploadsList: UploadsListContextValue
}

export interface W3APIProviderProps {
  children: ReactNode
  uploadsListPageSize?: number
}

export function W3APIProvider ({
  children,
  uploadsListPageSize
}: W3APIProviderProps): ReactNode {
  return (
    <KeyringProvider servicePrincipal={servicePrincipal} connection={serviceConnection}>
      <UploaderProvider servicePrincipal={servicePrincipal} connection={serviceConnection}>
        <UploadsListProvider servicePrincipal={servicePrincipal} connection={serviceConnection} size={uploadsListPageSize}>
          <Authenticator>
            {children}
          </Authenticator>
        </UploadsListProvider>
      </UploaderProvider>
    </KeyringProvider>
  )
}

export function useW3API (): W3APIContextValue {
  const keyring = useKeyring()
  const uploader = useUploader()
  const uploadsList = useUploadsList()
  const value = useMemo<W3APIContextValue>(
    () => ({
      keyring,
      uploader,
      uploadsList
    }),
    [keyring, uploader, uploadsList]
  )
  return value
}
