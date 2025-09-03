import Link from 'next/link'

export const serviceName = 'w3up.web3.storage'
export const tosUrl = 'https://web3.storage/terms'

export const StorachaLogoIcon = ({ className = 'h-20', darkBackground = false }: { className?: string, darkBackground?: boolean }) => (
  <img 
    src='/storacha-logo.svg' 
    alt="Storacha"
    className={`${className} ${darkBackground ? 'brightness-210 contrast-125' : ''}`}
  />
)

export const StorachaLogo = ({ className = '', darkBackground = false }: { className?: string, darkBackground?: boolean }) => (
  <Link href='/' className="inline-block">
    <StorachaLogoIcon className={className} darkBackground={darkBackground} />
  </Link>
)

export const Logo = StorachaLogo
