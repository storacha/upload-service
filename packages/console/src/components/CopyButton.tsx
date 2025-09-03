import { DocumentDuplicateIcon, CheckIcon } from '@heroicons/react/24/outline'
import { useState, PropsWithChildren } from 'react'

export default function CopyButton({ text, children }: PropsWithChildren<{ text: string }>) {
  const [copied, setCopied] = useState(false)
  const [timeoutID, setTimeoutID] = useState<number>()
  const className = 'h-5 w-5 inline-block mr-1 align-middle'
  return (
    <button onClick={e => {
      e.preventDefault()
      navigator.clipboard.writeText(text)
      setCopied(true)
      clearTimeout(timeoutID)
      setTimeoutID(window.setTimeout(() => setCopied(false), 3000))
    }} className={`inline-block bg-white border border-hot-red hover:bg-hot-red hover:text-white font-epilogue text-hot-red uppercase text-xs md:text-sm px-3 md:px-6 py-2 rounded-lg whitespace-nowrap`}>
      {copied
        ? <CheckIcon className={className} style={{ marginTop: -4 }} title='Copied' />
        : (
          <DocumentDuplicateIcon
            className={`${className} cursor-pointer`}
            style={{ marginTop: -4 }}
            title='Copy to clipboard'
            onClick={e => {
              e.preventDefault()
              navigator.clipboard.writeText(text)
              setCopied(true)
              setTimeout(() => setCopied(false), 3000)
            }}
          />
        )} {children}
    </button>
  )
}
