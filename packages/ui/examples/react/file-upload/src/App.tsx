import { Authenticator, Provider, Uploader } from '@storacha/ui-react'
import {
  AuthenticationEnsurer,
  SpaceEnsurer,
  UploaderForm,
} from '@storacha/ui-example-react-components'

function App() {
  return (
    <div className="bg-grad flex flex-col items-center h-screen">
      <Provider>
        <Authenticator>
          <AuthenticationEnsurer>
            <SpaceEnsurer>
              <Uploader>
                <UploaderForm />
              </Uploader>
            </SpaceEnsurer>
          </AuthenticationEnsurer>
        </Authenticator>
      </Provider>
    </div>
  )
}

export default App
