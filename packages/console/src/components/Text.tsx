export function H1 ({ children, className = '', as = 'h1', explain }: { children: React.ReactNode, className?: string, as?: 'h1' | 'h2' | 'h3', explain?: string }) {
  const As = as
  return (
    <As className={`text-sm tracking-wider uppercase font-bold my-2 text-black font-mono ${className}`}>
      {children}{explain ? <span className='opacity-50 normal-case'>: {explain}</span> : null}
    </As>
  )
}

export function H2 ({ children, className = '', as = 'h2', explain }: { children: React.ReactNode, className?: string, as?: 'h1' | 'h2' | 'h3', explain?: string }) {
  const As = as
  return (
    <As className={`text-xs tracking-wider uppercase font-bold my-2 text-black font-mono ${className}`}>
      {children}{explain ? <span className='opacity-50 normal-case'>: {explain}</span> : null}
    </As>
  )
}
