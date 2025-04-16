export function H1 ({ children, className = '', as = 'h1', explain }: { children: React.ReactNode, className?: string, as?: 'h1' | 'h2' | 'h3', explain?: string }) {
  const As = as
  return (
    <As className={`font-epilogue text-2xl tracking-wider uppercase mt-4 mb-10 text-hot-red font-mono ${className}`}>
      {children}{explain ? <span className='opacity-50 normal-case'>: {explain}</span> : null}
    </As>
  )
}

export function H2 ({ children, className = '', as = 'h2', explain }: { children: React.ReactNode, className?: string, as?: 'h1' | 'h2' | 'h3', explain?: string }) {
  const As = as
  return (
    <As className={`text-hot-red text-sm uppercase font-epilogue my-2 text-black font-mono ${className}`}>
      {children}{explain ? <span className='opacity-50 normal-case'>: {explain}</span> : null}
    </As>
  )
}

export function H3 ({ children, className = '', as = 'h3', explain }: { children: React.ReactNode, className?: string, as?: 'h1' | 'h2' | 'h3', explain?: string }) {
  const As = as
  return (
    <As className={`text-hot-red text-xs uppercase font-epilogue my-2 text-black font-mono ${className}`}>
      {children}{explain ? <span className='opacity-50 normal-case'>: {explain}</span> : null}
    </As>
  )
}
