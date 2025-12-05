import React from 'react'
import { describe, it, expect } from 'vitest'
import { render, screen } from '@testing-library/react'
import { UploadTool } from '../src/UploadTool.js'
import { Provider } from '../src/providers/Provider.js'

describe('UploadTool', () => {
  it('renders without crashing', () => {
    render(
      <Provider>
        <UploadTool />
      </Provider>
    )
  })

  it('displays type selector by default', () => {
    render(
      <Provider>
        <UploadTool />
      </Provider>
    )
    expect(screen.getByText(/Type/i)).toBeDefined()
  })

  it('hides type selector when showTypeSelector is false', () => {
    render(
      <Provider>
        <UploadTool showTypeSelector={false} />
      </Provider>
    )
    expect(screen.queryByText(/Type/i)).toBeNull()
  })

  it('displays options section by default', () => {
    render(
      <Provider>
        <UploadTool />
      </Provider>
    )
    expect(screen.getByText(/Options/i)).toBeDefined()
  })

  it('hides options section when showOptions is false', () => {
    render(
      <Provider>
        <UploadTool showOptions={false} />
      </Provider>
    )
    expect(screen.queryByText(/Options/i)).toBeNull()
  })

  it('displays explain section by default', () => {
    render(
      <Provider>
        <UploadTool />
      </Provider>
    )
    expect(screen.getByText(/Explain/i)).toBeDefined()
  })

  it('hides explain section when showExplain is false', () => {
    render(
      <Provider>
        <UploadTool showExplain={false} />
      </Provider>
    )
    expect(screen.queryByText(/Explain/i)).toBeNull()
  })

  it('displays drag and drop prompt', () => {
    render(
      <Provider>
        <UploadTool />
      </Provider>
    )
    expect(screen.getByText(/Drag File or Click to Browse/i)).toBeDefined()
  })

  it('renders with custom styles', () => {
    const customStyles = {
      container: { backgroundColor: 'red' },
    }
    render(
      <Provider>
        <UploadTool styles={customStyles} />
      </Provider>
    )
    // Component should render without errors
    expect(screen.getByText(/Type/i)).toBeDefined()
  })
})

