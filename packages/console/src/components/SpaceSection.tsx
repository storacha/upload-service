import { useEffect } from 'react';
import { useKeyring } from '@w3ui/react-keyring';
import { useUploadsList } from '@w3ui/react-uploads-list';
import { ShareSpace } from '@/share';
import { Uploader } from './Uploader';
import { UploadsList } from './UploadsList';
import { SpaceRegistrar } from './SpaceRegistrar';
import { DidIcon } from './DidIcon';
import { DIDKey } from '@ucanto/interface';
import { H2 } from './Text';

interface SpaceSectionProps {
  viewSpace: (did: DIDKey) => void;
  setShare: (share: boolean) => void;
  share: boolean;
}
export function SpaceSection (props: SpaceSectionProps): JSX.Element {
  const { viewSpace, share } = props;
  const [{ space }] = useKeyring();
  const [, { reload }] = useUploadsList();
  // reload the uploads list when the space changes
  // TODO: this currently does a network request - we'd like to just reset
  // to the latest state we have and revalidate in the background (SWR)
  // but it's not clear how all that state should work yet - perhaps
  // we need some sort of state management primitive in the uploads list?
  useEffect(() => {
//    void reload();
  }, [space, reload]);
  const registered = Boolean(space?.registered());
  return (
    <div>
      <div className='container mx-auto'>
        {share && <ShareSpace viewSpace={viewSpace} />}
        {(space && !registered) && !share && <SpaceRegistrar />}
        {!space && (
          <div className="text-center">
            <h1 className="text-xl">Select a space from the dropdown on the left to get started.</h1>
          </div>
        )}
        {registered && !share && (
          <>
            <div className='mt-8'>
              <UploadsList />
            </div>
            <div className='mt-8'>
            <H2>Upload</H2>
            <Uploader
              onUploadComplete={() => {
                void reload();
              }} />
            </div>
          </>
        )}
      </div>
    </div>
  );
}
