import { QrCodeIcon } from '@heroicons/react/24/outline'
import { useState } from 'react'
import { StorachaQRCode } from '@/qr'

export default function QRButton({ link }: { link: string }) {
  const [open, setOpen] = useState(false)

  return (
    <>
      <button
        onClick={e => {
          e.preventDefault()
          setOpen(true)
        }}
        className="inline-block bg-hot-red border border-hot-red hover:bg-white hover:text-hot-red font-epilogue text-white uppercase text-sm px-6 py-2 rounded-full whitespace-nowrap"
      >
        <QrCodeIcon
          className={`h-5 w-5 inline-block mr-1 align-middle cursor-pointer -mt-1`}
          title="Show QR Code"
        />
      </button>

      {open && (
        <div className="fixed inset-0 flex items-center justify-center bg-black/50 z-50 !m-0">
          <div className="bg-white rounded-lg shadow-lg p-6 relative flex flex-col items-center">
            {/* Close Button */}
            <button
              onClick={() => setOpen(false)}
              className="absolute top-2 right-2 text-gray-600 hover:text-black"
            >
              ✕
            </button>

            <StorachaQRCode value={link} />
          </div>
        </div>
      )}
    </>
  )
}
