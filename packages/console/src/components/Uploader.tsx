import type { JSX } from 'react'
import { FullUploader } from '@storacha/ui-react'

export interface SimpleUploaderProps {
  onUploadComplete?: (props: { file?: File; files?: File[]; dataCID?: any }) => void
  space?: any
}

export const Uploader = ({ onUploadComplete, space }: SimpleUploaderProps): JSX.Element => {
  return <FullUploader onUploadComplete={onUploadComplete} space={space} />
}

export default Uploader