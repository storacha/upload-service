import Link from 'next/link'

export default function BlobsOrUploads({
  space,
  selected,
}: {
  space: string
  selected: string
}) {
  return (
    <div className="flex flex-row rounded-2xl overflow-hidden mb-2 w-fit text-hot-red">
      <Link
        className={`px-4 py-1 ${
          selected == 'uploads' ? 'bg-white' : 'bg-gray-100'
        }`}
        href={`/space/${space}`}
      >
        Uploads
      </Link>
      <Link
        className={`px-4 py-1 ${
          selected == 'blobs' ? 'bg-white' : 'bg-gray-100'
        }`}
        href={`/space/${space}/blobs`}
      >
        Blobs
      </Link>
    </div>
  )
}
