'use client'

import { Uploader } from '@/components/Uploader'
import { useUploadsList } from '@w3ui/react-uploads-list'

export default function UploadPage (): JSX.Element {
  const [, { reload }] = useUploadsList()
  return (
    <Uploader onUploadComplete={reload} />
  )
}
