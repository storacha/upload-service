'use client'

import { H2 } from "@/components/Text"
import { useUploadsList } from "@w3ui/react-uploads-list"

interface PageProps {
  params: {
    cid: string
  }
}

export default function ItemPage ({ params: { cid }}: PageProps): JSX.Element {
  const [{ data }] = useUploadsList()
  if (data.length === 0) {
    return <div></div>
  }
  const item = data?.find(x => x.root.toString() === cid)
  if (!item) {
    return <h1>Not Found</h1>
  }
  const url = `https://${item.root.toString()}.ipfs.w3s.link`
  return (
    <div>
      <H2>Root CID</H2>
      <div className="pb-5 font-mono text-sm overflow-hidden no-wrap text-ellipsis">
        { item.root.toString() }
      </div>
      <H2>URL</H2>
      <div className="pb-5">
        <a href={url} className="font-mono text-sm text-blue-400 m-0 p-0 block">{url}</a>
      </div>
      <H2>Shards</H2>
      <div className=''>
         { item.shards?.map(link => <Shard cid={link.toString()} key={link.toString()} />) }
      </div>
    </div>
  )
}

function Shard ({ cid }: { cid: string}) {
  return <div className="font-mono text-sm overflow-hidden no-wrap text-ellipsis">{cid}</div> 
}
