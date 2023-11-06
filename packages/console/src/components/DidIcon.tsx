import md5 from 'blueimp-md5'

export function DidIcon({ did }: { did: string }): JSX.Element {
  const src = `https://www.gravatar.com/avatar/${md5(did)}?d=identicon`
  return (
    <img
      title={did}
      alt={`gravatar for did ${did}`}
      src={src}
      className='w-10 hover:saturate-200 saturate-0 invert border-solid border-white border'
    />
  )
}
