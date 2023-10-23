import { tosUrl } from '../../brand'
import Link from 'next/link'

export default function Terms () {
  const serviceName = process.env.NEXT_PUBLIC_W3UP_SERVICE_BRAND_NAME || 'dev.web3.storage'
  return (
    <div className='py-8 text-left text-white max-w-4xl font-mono mx-auto'>
      <h1 className='text-2xl mb-8 font-bold'>Terms of Service</h1>
      <p className='mb-4'>
        {serviceName} w3up is currently a beta preview feature for web3.storage,
        and will eventually be used as the primary upload API for web3.storage.{' '}
        This includes <Link href="https://github.com/web3-storage/w3up-client">w3up-client</Link>,{' '}
        <Link href="https://github.com/web3-storage/w3ui">w3ui</Link>,{' '}
        <Link href="https://github.com/web3-storage/w3cli">w3cli</Link>, and the{' '}
        <Link href="https://github.com/web3-storage/w3protocol">underlying APIs and services</Link>{' '}
        for uploading data (collectively, the “w3up beta”). By using the web3.storage{' '}
        w3up beta, you consent to the general web3.storage <Link href={tosUrl}>Terms of Service</Link>.
      </p>
      <p className='mb-4'>
        In order to register for the web3.storage w3up beta, you will be required to provide and verify an
        email address, which will be permanently associated with your web3.storage w3up account and cannot be 
        changed, even at the end of the beta period.
      </p>
      <p className='mb-4'>
        Registering for and uploading data to the web3.storage w3up beta is currently free. However, at the 
        end of the beta period, you will be required to pay for usage over the Free tier limit of 5GB.
        Please refer to the web3.storage website for <Link href="https://web3.storage/pricing/">information on pricing</Link>. If you exceed
        the Free Tier data limits of web3.storage and do not intend to pay, please do not use the w3up beta for long-term storage.
      </p>
    </div>
  )
}
