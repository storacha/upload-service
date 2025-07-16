'use client'

import { Uploader } from '@/components/Uploader'
import { useW3 } from '@storacha/ui-react'
import { useParams } from 'next/navigation'

export default function UploadPage (): JSX.Element {
  const { did } = useParams() as { did: string }
  const [{ spaces }] = useW3()
  const space = spaces.find(s => s.did() === decodeURIComponent(did))
  return <Uploader space={space} />
}
