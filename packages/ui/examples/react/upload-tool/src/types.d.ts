// Type declarations for workspace packages
declare module '@storacha/ui-react' {
  export * from '@storacha/ui-react/dist/index'
  import type { ComponentType, ReactNode } from 'react'
  
  export interface UploadToolProps {
    onUploadComplete?: (props: { dataCID?: any; file?: File; files?: File[] }) => void
    space?: any
    showTypeSelector?: boolean
    showOptions?: boolean
    showExplain?: boolean
    gatewayUrl?: string
    styles?: {
      container?: React.CSSProperties
      heading?: React.CSSProperties
      dropZone?: React.CSSProperties
      button?: React.CSSProperties
    }
  }
  
  export const UploadTool: ComponentType<UploadToolProps>
  export const Provider: ComponentType<{ children?: ReactNode }>
  export const Authenticator: ComponentType<{ children?: ReactNode }>
}

declare module '@storacha/ui-example-react-components' {
  import type { ComponentType, ReactNode } from 'react'
  
  export const AuthenticationEnsurer: ComponentType<{ children?: ReactNode }>
  export const SpaceEnsurer: ComponentType<{ children?: ReactNode }>
  export const UploaderForm: ComponentType<any>
}

