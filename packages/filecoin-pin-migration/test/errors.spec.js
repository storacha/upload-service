import { describe, expect, it } from 'vitest'
import {
  CommitFailedFailure,
  InsufficientFundsFailure,
  MissingPieceCIDFailure,
  PresignFailedFailure,
  PullFailedFailure,
} from '../src/errors.js'

describe('failure classes', () => {
  const cases = [
    { Class: MissingPieceCIDFailure, name: 'MissingPieceCID' },
    { Class: InsufficientFundsFailure, name: 'InsufficientFunds' },
    { Class: PresignFailedFailure, name: 'PresignFailed' },
    { Class: PullFailedFailure, name: 'PullFailed' },
    { Class: CommitFailedFailure, name: 'CommitFailed' },
  ]

  for (const { Class, name } of cases) {
    describe(name, () => {
      it('has correct .name', () => {
        const err = new Class('test message')
        expect(err.name).toBe(name)
      })

      it('has .reason returning the message', () => {
        const err = new Class('test message')
        expect(err.reason).toBe('test message')
      })

      it('is an instance of Error', () => {
        const err = new Class('test message')
        expect(err).toBeInstanceOf(Error)
      })
    })
  }
})
