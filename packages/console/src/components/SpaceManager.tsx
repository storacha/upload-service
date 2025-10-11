'use client'
import React from 'react'
import Link from 'next/link'
import { SpacePicker, useSpacePicker } from '@storacha/ui-react'
import { DidIcon } from './DidIcon'
import { Logo } from '../brand'
import { Space } from '@storacha/ui-react'

interface SpaceManagerProps {
  spaceType?: 'public' | 'private' | 'all'
  onSpaceSelect?: (space: Space) => void
}

interface SpaceListDisplayProps {
  spaces: Space[]
  type: 'public' | 'private' | 'all'
}

function SpaceListDisplay({ spaces, type }: SpaceListDisplayProps) {
  const [, { selectSpace }] = useSpacePicker()

  if (spaces.length === 0) {
    return (
      <div className="text-center py-8 text-gray-500">
        <p>No {type === 'all' ? '' : type + ' '}spaces yet.</p>
        <Link 
          href="/space/create" 
          className="text-hot-red hover:underline"
        >
          Create your first {type === 'all' ? '' : type + ' '}space
        </Link>
      </div>
    )
  }

  return (
    <SpacePicker.List className="max-w-lg border rounded-2xl border-hot-red bg-white max-h-[75vh] overflow-y-auto">
      {spaces.map(space => (
        <SpaceListItem key={space.did()} space={space} />
      ))}
    </SpacePicker.List>
  )
}

interface SpaceListItemProps {
  space: Space
}

function SpaceListItem({ space }: SpaceListItemProps) {
  return (
    <Link 
      href={`/space/${space.did()}`} 
      className="flex flex-row items-start gap-4 p-4 text-left hover:bg-hot-yellow-light border-b last:border-0 border-hot-red first:rounded-t-2xl last:rounded-b-2xl block"
    >
      <div className="flex items-center gap-2">
        <DidIcon did={space.did()} />
      </div>
      <div className="grow overflow-hidden whitespace-nowrap text-ellipsis">
        <div className="flex items-center gap-2">
          <span className="font-epilogue text-lg text-hot-red leading-5 m-0">
            {space.name || 'Untitled'}
          </span>
        </div>
        <span className="font-mono text-xs block">
          {space.did()}
        </span>
      </div>
    </Link>
  )
}

function CreateSpaceDialog() {
  const [{ showCreateDialog, newSpaceName, creatingSpace, createError }, { setShowCreateDialog, setNewSpaceName, createSpace }] = useSpacePicker()

  if (!showCreateDialog) return null

  return (
    <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50">
      <SpacePicker.CreateDialog className="bg-white rounded-2xl border border-hot-red p-6 max-w-md w-full mx-4">
        <div className="flex flex-row gap-4 mb-6 justify-center">
          <Logo className="w-24" />
        </div>
        
        <h2 className="text-xl font-epilogue text-hot-red mb-4">Create New Space</h2>
        
        <SpacePicker.CreateForm>
          <div className="mb-4">
            <label className="block mb-2 uppercase text-xs font-epilogue text-hot-red" htmlFor="space-name">
              Space Name (Optional)
            </label>
            <SpacePicker.NameInput 
              className="text-black py-2 px-3 rounded-xl block w-full border border-hot-red"
              id="space-name"
              placeholder="Enter space name..."
            />
          </div>

          {createError && (
            <div className="mb-4 p-3 bg-red-50 border border-red-200 rounded-md">
              <p className="text-sm text-red-700">{createError.message}</p>
            </div>
          )}

          <div className="flex gap-3 justify-end">
            <SpacePicker.CancelButton 
              className="inline-block bg-white border border-hot-red hover:bg-gray-50 font-epilogue text-hot-red uppercase text-sm px-6 py-2 rounded-full whitespace-nowrap"
            >
              Cancel
            </SpacePicker.CancelButton>
            <SpacePicker.CreateButton 
              className="inline-block bg-hot-red border border-hot-red hover:bg-white hover:text-hot-red font-epilogue text-white uppercase text-sm px-6 py-2 rounded-full whitespace-nowrap"
              disabled={creatingSpace}
            >
              {creatingSpace ? 'Creating...' : 'Create Space'}
            </SpacePicker.CreateButton>
          </div>
        </SpacePicker.CreateForm>
      </SpacePicker.CreateDialog>
    </div>
  )
}

export function SpaceManager({ spaceType = 'all', onSpaceSelect }: SpaceManagerProps) {
  return (
    <SpacePicker spaceType={spaceType} onSpaceSelect={onSpaceSelect}>
      <div>
        <SpaceManagerContent spaceType={spaceType} />
        <CreateSpaceDialog />
      </div>
    </SpacePicker>
  )
}

interface SpaceManagerContentProps {
  spaceType: 'public' | 'private' | 'all'
}

function SpaceManagerContent({ spaceType }: SpaceManagerContentProps) {
  const [{ spaces }, { setShowCreateDialog }] = useSpacePicker()

  return (
    <div>
      <div className="flex justify-between items-center mb-4">
        <h2 className="text-xl font-epilogue text-hot-red">
          {spaceType === 'all' ? 'Your Spaces' : `${spaceType.charAt(0).toUpperCase() + spaceType.slice(1)} Spaces`}
        </h2>
        <button 
          onClick={() => setShowCreateDialog(true)}
          className="inline-block bg-hot-red border border-hot-red hover:bg-white hover:text-hot-red font-epilogue text-white uppercase text-sm px-4 py-2 rounded-full whitespace-nowrap"
        >
          Create Space
        </button>
      </div>
      
      <SpaceListDisplay spaces={spaces} type={spaceType} />
    </div>
  )
}