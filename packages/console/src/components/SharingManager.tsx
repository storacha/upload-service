'use client'
import React from 'react'
import { SharingTools, useSharingTools, SpaceDID } from '@storacha/ui-react'
import { CloudArrowDownIcon, PaperAirplaneIcon, ArrowDownOnSquareStackIcon, InformationCircleIcon, XMarkIcon } from '@heroicons/react/24/outline'
import { useW3 } from '@storacha/ui-react'
import { H2, H3 } from '@/components/Text'
import CopyButton from './CopyButton'
import Tooltip from './Tooltip'

interface SharingManagerProps {
  spaceDID: SpaceDID
}

function ShareForm() {
  const [{ shareValue, shareError }] = useSharingTools()

  const isDID = (value: string): boolean => {
    try {
      return /^did:[a-z0-9]+:[a-zA-Z0-9._%-]+$/i.test(value.trim())
    } catch {
      return false
    }
  }

  const isEmail = (value: string): boolean => {
    const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/
    return !isDID(value) && emailRegex.test(value)
  }

  return (
    <div className='bg-white rounded-2xl border border-hot-red p-5 font-epilogue'>
      <p className='mb-4'>
        Ask your friend for their Email or Decentralized Identifier (DID) and paste it
        below:
      </p>
      
      <SharingTools.ShareForm>
        <SharingTools.ShareInput
          className='text-black py-2 px-2 rounded-xl block mb-4 border border-hot-red w-11/12'
          required
        />
        
        <SharingTools.ShareButton
          className={`inline-block bg-hot-red border border-hot-red ${isEmail(shareValue) || isDID(shareValue) ? 'hover:bg-white hover:text-hot-red' : 'opacity-20'} font-epilogue text-white uppercase text-sm px-6 py-2 rounded-full whitespace-nowrap`}
        >
          {isEmail(shareValue) ? 'Share via Email' : isDID(shareValue) ? (
            <>
              <CloudArrowDownIcon className='h-5 w-5 inline-block mr-1 align-middle' style={{ marginTop: -4 }} />
              {'Download UCAN'}
            </>
          ) : 'Enter a valid email or DID'}
        </SharingTools.ShareButton>
      </SharingTools.ShareForm>

      {shareError && (
        <div className="mt-4 p-3 bg-red-50 border border-red-200 rounded-md">
          <p className="text-sm text-red-700">{shareError}</p>
        </div>
      )}
    </div>
  )
}

function DelegationsList() {
  const [{ delegations, loadingDelegations }] = useSharingTools()

  // Separate active and revoked delegations
  const activeDelegations = delegations.filter(item => !item.revoked)
  const revokedDelegations = delegations.filter(item => item.revoked)

  return (
    <>
      {/* Active Delegations Panel */}
      {(activeDelegations.length > 0 || loadingDelegations) && (
        <div className='bg-white rounded-2xl border border-hot-red p-5 mt-5 font-epilogue'>
          <p className='mb-4'>
            Shared With:
          </p>
          {loadingDelegations ? (
            <div className="flex items-center justify-center py-8">
              <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-hot-red mr-3"></div>
              <span className="text-gray-600">Checking delegation status...</span>
            </div>
          ) : (
            <SharingTools.DelegationList>
              {activeDelegations.map((delegation, i) => (
                <SharingTools.DelegationItem
                  key={delegation.email}
                  delegation={delegation}
                  className="flex flex-col sm:flex-row items-start sm:items-center space-y-2 sm:space-y-0 sm:space-x-2 w-full mt-1"
                >
                  <div className="flex flex-col w-full">
                    <div className="flex items-center w-full">
                      <span className="truncate mt-1">{delegation.email}</span>
                      <InformationCircleIcon className={`h-5 w-5 ml-1 share-capabilities-${i}`} />
                      <Tooltip anchorSelect={`.share-capabilities-${i}`}>
                        <H3>Capabilities</H3>
                        {delegation.capabilities.map((c, j) => (
                          <p key={j}>{c}</p>
                        ))}
                      </Tooltip>
                    </div>
                    <div className="flex items-center mt-1">
                      <span className="text-xs text-gray-500 font-mono">
                        {truncateCID(delegation.delegation.cid.toString())}
                      </span>
                      <div className="ml-2">
                        <CopyButton text={delegation.delegation.cid.toString()}>
                          <span className="text-xs"></span>
                        </CopyButton>
                      </div>
                    </div>
                  </div>
                  <SharingTools.RevokeButton
                    delegation={delegation}
                    className="inline-flex items-center px-3 py-1 text-sm font-medium rounded-md transition-colors bg-red-50 text-red-700 hover:bg-red-100 border border-red-200"
                    title="Revoke access for this email"
                  >
                    <XMarkIcon className="h-4 w-4 mr-1" />
                    Revoke
                  </SharingTools.RevokeButton>
                </SharingTools.DelegationItem>
              ))}
            </SharingTools.DelegationList>
          )}
        </div>
      )}

      {/* Revoked Delegations Panel */}
      {revokedDelegations.length > 0 && (
        <div className='bg-gray-50 rounded-2xl border border-gray-300 p-5 mt-5 font-epilogue'>
          <p className='mb-4 text-gray-700'>
            Revoked Access:
          </p>
          <SharingTools.DelegationList>
            {revokedDelegations.map((delegation, i) => (
              <SharingTools.DelegationItem
                key={delegation.email}
                delegation={delegation}
                className="flex flex-col sm:flex-row items-start sm:items-center space-y-2 sm:space-y-0 sm:space-x-2 w-full mt-1 opacity-75"
              >
                <div className="flex flex-col w-full">
                  <div className="flex items-center w-full">
                    <span className="truncate mt-1 line-through text-gray-500">{delegation.email}</span>
                    <InformationCircleIcon className={`h-5 w-5 ml-1 text-gray-400 revoked-capabilities-${i}`} />
                    <Tooltip anchorSelect={`.revoked-capabilities-${i}`}>
                      <H3>Capabilities (Revoked)</H3>
                      {delegation.capabilities.map((c, j) => (
                        <p key={j} className="text-gray-500">{c}</p>
                      ))}
                    </Tooltip>
                  </div>
                  <div className="flex items-center mt-1">
                    <span className="text-xs text-gray-400 font-mono">
                      {truncateCID(delegation.delegation.cid.toString())}
                    </span>
                    <div className="ml-2">
                      <CopyButton text={delegation.delegation.cid.toString()}>
                        <span className="text-xs text-gray-500"></span>
                      </CopyButton>
                    </div>
                  </div>
                </div>
                <span className="inline-flex items-center px-3 py-1 text-sm font-medium text-gray-500 bg-gray-200 rounded-md">
                  <XMarkIcon className="h-4 w-4 mr-1" />
                  Revoked
                </span>
              </SharingTools.DelegationItem>
            ))}
          </SharingTools.DelegationList>
        </div>
      )}
    </>
  )
}

function ImportSection() {
  const [{ client }] = useW3()
  const [{ importedDelegation }] = useSharingTools()

  const body = `Please send me a UCAN delegation to access to your space. My agent DID is:\\n\\n${client?.did()}`
    .replace(/ /g, '%20')
    .replace(/\\n/g, '%0A')

  return (
    <div className='border border-hot-red rounded-2xl bg-white p-5 max-w-4xl mt-5'>
      <H2>Import Space Access</H2>
      <ol className='list-decimal ml-4 text-hot-red'>
        <li className='mt-4 mb-8'>
          Send your DID to your friend.
          <div className='font-mono text-sm text-black break-words my-4'>
            {client?.did()}
          </div>
          <CopyButton text={client?.did() ?? ''}>Copy DID</CopyButton>
          <a 
            href={`mailto:?subject=Space%20Access%20Request&body=${body}`} 
            className="inline-block bg-hot-red border border-hot-red hover:bg-white hover:text-hot-red font-epilogue text-white uppercase text-sm ml-2 px-6 py-2 rounded-full whitespace-nowrap"
          >
            <PaperAirplaneIcon className='h-5 w-5 inline-block mr-1 align-middle' style={{ marginTop: -4 }} /> 
            Email DID
          </a>
        </li>
        <li className='mt-4 my-8'>
          Import the UCAN they send you.
          <p className='text-black my-2'>
            Instruct your friend to use the web console or CLI to create a UCAN, delegating your DID access to their space.
          </p>
          <div className='mt-4'>
            <label className='inline-block bg-hot-red border border-hot-red hover:bg-white hover:text-hot-red font-epilogue text-white uppercase text-sm px-6 py-2 rounded-full whitespace-nowrap cursor-pointer'>
              <ArrowDownOnSquareStackIcon className='h-5 w-5 inline-block mr-1 align-middle' style={{ marginTop: -4 }} />
              Import UCAN
              <SharingTools.ImportInput className='hidden' />
            </label>
          </div>
        </li>
      </ol>
      
      {importedDelegation && importedDelegation.capabilities && importedDelegation.capabilities.length > 0 && (
        <div className='mt-4 pt-4'>
          <H2>Added</H2>
          <div className='max-w-3xl border border-hot-red rounded-2xl p-4'>
            <div className='font-epilogue text-lg text-hot-red'>
              Space: {importedDelegation.capabilities[0].with}
            </div>
            <div className='text-sm text-gray-600 mt-2'>
              Capabilities: {importedDelegation.capabilities.map(c => c.can).join(', ')}
            </div>
          </div>
        </div>
      )}
    </div>
  )
}

// Helper function to truncate CID for display
function truncateCID(cid: string): string {
  if (cid.length <= 14) return cid
  return `${cid.slice(0, 7)}...${cid.slice(-7)}`
}

export function SharingManager({ spaceDID }: SharingManagerProps) {
  return (
    <SharingTools spaceDID={spaceDID}>
      <div className='max-w-4xl'>
        <H2>Share your space</H2>
        <ShareForm />
        <DelegationsList />
        <ImportSection />
      </div>
    </SharingTools>
  )
}