import { DocumentDuplicateIcon, CheckIcon } from '@heroicons/react/24/outline'
import { useState } from 'react'

export default function CopyIcon({ text }: { text: string }) {
  const [copied, setCopied] = useState(false)
  const className = 'w-8 inline-block align-middle mb-1 px-2 py-0'
  return copied
    ? <CheckIcon className={`${className} text-white`} title='Copied' />
    : (
      <DocumentDuplicateIcon
        className={`${className} cursor-pointer hover:text-white`}
        title='Copy to clipboard'
        onClick={e => {
          e.preventDefault()
          navigator.clipboard.writeText(text)
          setCopied(true)
          setTimeout(() => setCopied(false), 3000)
        }}
      />
    )
}