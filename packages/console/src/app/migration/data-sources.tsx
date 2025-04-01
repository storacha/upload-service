import * as NFTStorage from '@/lib/migrations/nft-storage'
import * as Web3Storage from '@/lib/migrations/web3-storage'
import * as Web3StoragePSA from '@/lib/migrations/web3-storage-psa'

export const dataSources = [
  {
    name: 'NFT.Storage (Classic)',
    logo: <img src='/nftstorage-logo.png' width='350' />,
    source: NFTStorage
  },
  {
    name: 'Web3.Storage (Old)',
    logo: <img src='/web3storage-logo.png' width='350' />,
    source: Web3Storage
  },
  {
    name: 'Web3.Storage Pinning Service API (Old)',
    logo: <img src='/web3storage-psa-logo.png' width='274' style={{ margin: 'auto 38px' }} />,
    source: Web3StoragePSA
  }
]
