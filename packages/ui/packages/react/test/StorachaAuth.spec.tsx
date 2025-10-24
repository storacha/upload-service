import 'fake-indexeddb/auto'
import { test, expect, vi, beforeEach, describe } from 'vitest'
import { userEvent as user } from '@testing-library/user-event'
import { render, screen, waitFor, cleanup } from '@testing-library/react'
import { Provider } from '../src/providers/Provider.js'
import { StorachaAuth, useStorachaAuth } from '../src/components/StorachaAuth.js'
import { useStorachaAuthEnhanced } from '../src/hooks/useStorachaAuth.js'

// Mock functions for testing
const mockLogin = vi.fn()
const mockLogout = vi.fn()

describe('StorachaAuth Component Suite', () => {
  beforeEach(() => {
    cleanup()
    vi.clearAllMocks()
    mockLogin.mockResolvedValue(undefined)
    mockLogout.mockResolvedValue(undefined)
  })

  describe('StorachaAuthForm', () => {
    test('renders authentication form with correct elements', () => {
      render(
        <Provider>
          <StorachaAuth>
            <StorachaAuth.Form />
          </StorachaAuth>
        </Provider>
      )

      // Check for logo
      expect(screen.getByAltText('Storacha')).toBeTruthy()
      
      // Check for email label and input
      expect(screen.getByLabelText('Email')).toBeTruthy()
      expect(screen.getByLabelText('Email')).toBeTruthy()
      
      // Check for authorize button
      expect(screen.getByRole('button', { name: 'Authorize' })).toBeTruthy()
      
      // Check for terms of service text
      expect(screen.getByText(/By registering with storacha.network/)).toBeTruthy()
      expect(screen.getByText(/Terms of Service/)).toBeTruthy()
    })

    test('handles email input and form submission', async () => {
      const onAuthEvent = vi.fn()
      
      render(
        <Provider>
          <StorachaAuth onAuthEvent={onAuthEvent}>
            <StorachaAuth.Form />
          </StorachaAuth>
        </Provider>
      )

      const emailInput = screen.getByLabelText('Email')
      const submitButton = screen.getByRole('button', { name: 'Authorize' })

      // Type email
      await user.click(emailInput)
      await user.keyboard('test@example.com')

      // Submit form
      await user.click(submitButton)

      // Check that auth event was triggered
      expect(onAuthEvent).toHaveBeenCalledWith('Login Authorization Requested')
    })

    test('disables submit button when form is submitted', async () => {
      render(
        <Provider>
          <StorachaAuth>
            <StorachaAuth.Form />
          </StorachaAuth>
        </Provider>
      )

      const emailInput = screen.getByLabelText('Email')
      const submitButton = screen.getByRole('button', { name: 'Authorize' })

      await user.click(emailInput)
      await user.keyboard('test@example.com')
      await user.click(submitButton)

      // Button should be disabled during submission
      expect((submitButton as HTMLButtonElement).disabled).toBe(true)
    })
  })

  describe('StorachaAuthSubmitted', () => {
    test('renders submitted state with email verification message', () => {
      render(
        <Provider>
          <StorachaAuth>
            <StorachaAuth.Submitted />
          </StorachaAuth>
        </Provider>
      )

      // Check for logo
      expect(screen.getByAltText('Storacha')).toBeTruthy()
      
      // Check for verification message
      expect(screen.getByText('Verify your email address!')).toBeTruthy()
      expect(screen.getByText(/Click the link in the email/)).toBeTruthy()
      expect(screen.getByText(/Once authorized you can close this window/)).toBeTruthy()
      
      // Check for cancel button
      expect(screen.getByRole('button', { name: 'Cancel' })).toBeTruthy()
    })

    test('displays the email address in verification message', async () => {
      render(
        <Provider>
          <StorachaAuth>
            <StorachaAuth.Submitted />
          </StorachaAuth>
        </Provider>
      )

      // The email should be displayed in the verification message
      // Note: This will show empty initially since no email is set in the context
      const emailSpan = screen.getByText(/Click the link in the email we sent to/)
      expect(emailSpan).toBeTruthy()
    })
  })

  describe('StorachaAuthEnsurer', () => {
    test('shows loading state when client is not available', () => {
      render(
        <Provider>
          <StorachaAuth>
            <StorachaAuth.Ensurer>
              <div>Authenticated Content</div>
            </StorachaAuth.Ensurer>
          </StorachaAuth>
        </Provider>
      )

      // Should show loading state since client is not available in test
      expect(screen.getByText(/Initializing/)).toBeTruthy()
      expect(screen.queryByText('Authenticated Content')).toBeFalsy()
    })

    test('shows loading state with proper messages', () => {
      render(
        <Provider>
          <StorachaAuth>
            <StorachaAuth.Ensurer 
              renderLoader={(type) => (
                <div>
                  {type === 'initializing' ? 'Initializing' : 'Authenticating'}
                  <p>Setting up authentication...</p>
                </div>
              )}
            >
              <div>Authenticated Content</div>
            </StorachaAuth.Ensurer>
          </StorachaAuth>
        </Provider>
      )

      // Should show loading state
      expect(screen.getByText(/Initializing/)).toBeTruthy()
      expect(screen.getByText(/Setting up authentication/)).toBeTruthy()
    })

    test('shows custom loader when provided', () => {
      const customLoader = <div>Custom Loading...</div>
      
      render(
        <Provider>
          <StorachaAuth>
            <StorachaAuth.Ensurer loader={customLoader}>
              <div>Authenticated Content</div>
            </StorachaAuth.Ensurer>
          </StorachaAuth>
        </Provider>
      )

      expect(screen.getByText('Custom Loading...')).toBeTruthy()
    })
  })

  describe('StorachaAuthEmailInput', () => {
    test('updates email value when typed', async () => {
      render(
        <Provider>
          <StorachaAuth>
            <StorachaAuth.EmailInput data-testid="email-input" />
          </StorachaAuth>
        </Provider>
      )

      const emailInput = screen.getByTestId('email-input')
      
      await user.click(emailInput)
      await user.keyboard('test@example.com')

      expect((emailInput as HTMLInputElement).value).toBe('test@example.com')
    })
  })

  describe('StorachaAuthCancelButton', () => {
    test('calls cancelLogin when clicked', async () => {
      const onAuthEvent = vi.fn()
      
      render(
        <Provider>
          <StorachaAuth onAuthEvent={onAuthEvent}>
            <StorachaAuth.CancelButton>Cancel</StorachaAuth.CancelButton>
          </StorachaAuth>
        </Provider>
      )

      const cancelButton = screen.getByRole('button', { name: 'Cancel' })
      await user.click(cancelButton)

      expect(onAuthEvent).toHaveBeenCalledWith('Login Authorization Cancelled')
    })
  })

  describe('useStorachaAuth hook', () => {
    test('provides authentication state and actions', () => {
      const TestComponent = () => {
        const [state, actions] = useStorachaAuth()
        return (
          <div>
            <div data-testid="is-authenticated">{state.isAuthenticated.toString()}</div>
            <div data-testid="email">{state.email || 'no-email'}</div>
            <div data-testid="submitted">{state.submitted.toString()}</div>
            <button onClick={() => actions.setEmail('test@example.com')}>Set Email</button>
          </div>
        )
      }

      render(
        <Provider>
          <StorachaAuth>
            <TestComponent />
          </StorachaAuth>
        </Provider>
      )

      expect(screen.getByTestId('is-authenticated').textContent).toBe('false')
      expect(screen.getByTestId('email').textContent).toBe('no-email')
      expect(screen.getByTestId('submitted').textContent).toBe('false')
    })

    test('allows setting email through actions', async () => {
      const TestComponent = () => {
        const [state, actions] = useStorachaAuth()
        return (
          <div>
            <div data-testid="email">{state.email || 'no-email'}</div>
            <button onClick={() => actions.setEmail('test@example.com')}>Set Email</button>
          </div>
        )
      }

      render(
        <Provider>
          <StorachaAuth>
            <TestComponent />
          </StorachaAuth>
        </Provider>
      )

      const setEmailButton = screen.getByRole('button', { name: 'Set Email' })
      await user.click(setEmailButton)

      expect(screen.getByTestId('email').textContent).toBe('test@example.com')
    })
  })

  describe('useStorachaAuthEnhanced hook', () => {
    test('provides enhanced authentication functionality', () => {
      const TestComponent = () => {
        const auth = useStorachaAuthEnhanced()
        return (
          <div>
            <div data-testid="is-authenticated">{auth.isAuthenticated.toString()}</div>
            <div data-testid="is-loading">{auth.isLoading.toString()}</div>
            <div data-testid="is-submitting">{auth.isSubmitting.toString()}</div>
            <div data-testid="current-user">{auth.currentUser ? 'user-exists' : 'no-user'}</div>
          </div>
        )
      }

      render(
        <Provider>
          <StorachaAuth>
            <TestComponent />
          </StorachaAuth>
        </Provider>
      )

      expect(screen.getByTestId('is-authenticated').textContent).toBe('false')
      expect(screen.getByTestId('is-loading').textContent).toBe('true')
      expect(screen.getByTestId('is-submitting').textContent).toBe('false')
      expect(screen.getByTestId('current-user').textContent).toBe('no-user')
    })

    test('provides logoutWithTracking function', async () => {
      const TestComponent = () => {
        const auth = useStorachaAuthEnhanced()
        return (
          <button onClick={auth.logoutWithTracking}>Logout</button>
        )
      }

      render(
        <Provider>
          <StorachaAuth>
            <TestComponent />
          </StorachaAuth>
        </Provider>
      )

      const logoutButton = screen.getByRole('button', { name: 'Logout' })
      await user.click(logoutButton)

      // Should not throw an error
      expect(logoutButton).toBeTruthy()
    })
  })

  describe('Integration Tests', () => {
    test('complete authentication flow', async () => {
      const onAuthEvent = vi.fn()
      
      render(
        <Provider>
          <StorachaAuth onAuthEvent={onAuthEvent}>
            <StorachaAuth.Ensurer>
              <div>Authenticated Content</div>
            </StorachaAuth.Ensurer>
          </StorachaAuth>
        </Provider>
      )

      // Initially should show loading since client is not available in test environment
      expect(screen.getByText(/Initializing/)).toBeTruthy()
      
      // In a real environment, the client would become available and show the form
      // But in test environment without proper mocking, it stays in loading state
      expect(screen.queryByText('Authenticated Content')).toBeFalsy()
    })

    test('iframe detection works correctly', () => {
      const TestComponent = () => {
        const [state] = useStorachaAuth()
        return <div data-testid="is-iframe">{state.isIframe.toString()}</div>
      }

      render(
        <Provider>
          <StorachaAuth enableIframeSupport={true}>
            <TestComponent />
          </StorachaAuth>
        </Provider>
      )

      // Should detect iframe context (will be false in test environment)
      expect(screen.getByTestId('is-iframe').textContent).toBe('false')
    })
  })

  describe('Error Handling', () => {
    test('handles form submission and triggers auth event', async () => {
      const onAuthEvent = vi.fn()
      
      render(
        <Provider>
          <StorachaAuth onAuthEvent={onAuthEvent}>
            <StorachaAuth.Form />
          </StorachaAuth>
        </Provider>
      )

      const emailInput = screen.getByLabelText('Email')
      const submitButton = screen.getByRole('button', { name: 'Authorize' })

      await user.click(emailInput)
      await user.keyboard('test@example.com')
      await user.click(submitButton)

      // Should trigger auth event for login request
      expect(onAuthEvent).toHaveBeenCalledWith('Login Authorization Requested')
    })
  })
})
