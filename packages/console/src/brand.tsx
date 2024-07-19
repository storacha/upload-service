import Link from 'next/link'

export const serviceName = 'w3up.web3.storage'
export const tosUrl = 'https://web3.storage/terms'
export const StorachaLogoIcon = () => <img src='/storacha-logo.svg' />

export const StorachaLogo = ({ className = '' }) => (
  <Link href='/' className={className}>
    <StorachaLogoIcon />
  </Link>
)

export const Logo = StorachaLogo
