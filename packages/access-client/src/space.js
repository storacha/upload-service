import * as ED25519 from '@ucanto/principal/ed25519'
import { delegate, Schema, UCAN, error, fail, DID } from '@ucanto/core'
import * as BIP39 from '@scure/bip39'
import { wordlist } from '@scure/bip39/wordlists/english'
import * as API from './types.js'
import * as Access from './access.js'
import * as Provider from './provider.js'
import { SpaceAccess } from './space-access.js'

/**
 * Data model for the (owned) space.
 *
 * @typedef {{
 *  signer: ED25519.EdSigner;
 *   name: string;
 *   access?: API.SpaceAccessType;
 *   agent?: API.Agent<S>;
 * }} Model
 * @template {Record<string, any>} [S=API.Service]
 */

/**
 * Generates a new space.
 *
 * @template {Record<string, any>} [S=API.Service]
 * @param {object} options
 * @param {string} options.name - The name of the space.
 * @param {API.SpaceAccessType} [options.access] - The access type for the space. Defaults to { type: 'public' }.
 * @param {API.Agent<S>} [options.agent]
 */
export const generate = async ({ name, access, agent }) => {
  const { signer } = await ED25519.generate()
  const normalizedAccess = SpaceAccess.from(access)

  return new OwnedSpace({ signer, name, access: normalizedAccess, agent })
}

/**
 * Recovers space from the saved mnemonic.
 *
 * @param {string} mnemonic
 * @param {object} options
 * @param {string} options.name - Name to give to the recovered space.
 * @param {API.SpaceAccessType} [options.access] - The access type for the space. Defaults to { type: 'public' }.
 * @param {API.Agent} [options.agent]
 */
export const fromMnemonic = async (mnemonic, { name, access, agent }) => {
  // TODO: Improve recovery UX by auto-detecting access type from existing space metadata
  // or storing access type with space mnemonic. Should default to public if mnemonic
  // doesn't contain access type information.
  const secret = BIP39.mnemonicToEntropy(mnemonic, wordlist)
  const signer = await ED25519.derive(secret)
  const normalizedAccess = SpaceAccess.from(access)
  return new OwnedSpace({ signer, name, access: normalizedAccess, agent })
}

/**
 * Turns (owned) space into a BIP39 mnemonic that later can be used to recover
 * the space using `fromMnemonic` function.
 *
 * @param {object} space
 * @param {ED25519.EdSigner} space.signer
 */
export const toMnemonic = ({ signer }) => {
  /** @type {Uint8Array} */
  // @ts-expect-error - Field is defined but not in the interface
  const secret = signer.secret

  return BIP39.entropyToMnemonic(secret, wordlist)
}

/**
 * Creates a (UCAN) delegation that gives full access to the space to the
 * specified `account`. At the moment we only allow `did:mailto` principal
 * to be used as an `account`.
 *
 * @template {Record<string, any>} [S=API.Service]
 * @param {Model<S>} space
 * @param {API.AccountDID} account
 */
export const createRecovery = (space, account) =>
  createAuthorization(space, {
    audience: DID.parse(account),
    access: Access.accountAccess,
    expiration: Infinity,
  })

// Default authorization session is valid for 1 year
export const SESSION_LIFETIME = 60 * 60 * 24 * 365

/**
 * Creates (UCAN) delegation that gives specified `agent` an access to
 * specified ability (passed as `access.can` field) on this space.
 * Optionally, you can specify `access.expiration` field to set the
 * expiration time for the authorization. By default the authorization
 * is valid for 1 year and gives access to all capabilities on the space
 * that are needed to use the space.
 *
 * @template {Record<string, any>} [S=API.Service]
 * @param {Model<S>} space
 * @param {object} options
 * @param {API.Principal} options.audience
 * @param {API.Access} [options.access]
 * @param {API.UTCUnixTimestamp} [options.expiration]
 */
export const createAuthorization = async (
  { signer, name, access },
  {
    audience,
    access: spaceAccess = Access.spaceAccess,
    expiration = UCAN.now() + SESSION_LIFETIME,
  }
) => {
  const normalizedAccess = SpaceAccess.from(access)
  const facts = [{ space: { name, access: normalizedAccess } }]

  return await delegate({
    issuer: signer,
    audience: audience,
    capabilities: toCapabilities({
      [signer.did()]: spaceAccess,
    }),
    ...(expiration ? { expiration } : {}),
    facts,
  })
}

/**
 * @param {Record<API.Resource, API.Access>} allow
 * @returns {API.Capabilities}
 */
const toCapabilities = (allow) => {
  const capabilities = []
  for (const [subject, access] of Object.entries(allow)) {
    const entries = /** @type {[API.Ability, API.Unit][]} */ (
      Object.entries(access)
    )

    for (const [can, details] of entries) {
      if (details) {
        capabilities.push({ can, with: subject })
      }
    }
  }

  return /** @type {API.Capabilities} */ (capabilities)
}

/**
 * Represents an owned space, meaning a space for which we have a private key
 * and consequently have full authority over.
 *
 * @template {Record<string, any>} [S=API.Service]
 */
export class OwnedSpace {
  /**
   * @param {Model<S>} model
   */
  constructor(model) {
    this.model = model
  }

  get signer() {
    return this.model.signer
  }

  get name() {
    return this.model.name
  }

  get access() {
    return SpaceAccess.from(this.model.access)
  }

  did() {
    return this.signer.did()
  }

  /**
   * Creates a renamed version of this space.
   *
   * @param {string} name
   */
  withName(name) {
    return new OwnedSpace({
      signer: this.signer,
      name,
      access: this.access,
    })
  }

  /**
   * Saves account in the agent store so it can be accessed across sessions.
   *
   * @param {object} input
   * @param {API.Agent<S>} [input.agent]
   * @returns {Promise<API.Result<API.Unit, Error>>}
   */
  async save({ agent = this.model.agent } = {}) {
    if (!agent) {
      return fail('Please provide an agent to save the space into')
    }

    const proof = await createAuthorization(this, { audience: agent })
    await agent.importSpaceFromDelegation(proof)
    await agent.setCurrentSpace(this.did())

    return { ok: {} }
  }

  /**
   * @param {Authorization} authorization
   * @param {object} options
   * @param {API.Agent<S>} [options.agent]
   */
  provision({ proofs }, { agent = this.model.agent } = {}) {
    if (!agent) {
      return fail('Please provide an agent to save the space into')
    }

    return provision(this, { proofs, agent })
  }

  /**
   * Creates a (UCAN) delegation that gives full access to the space to the
   * specified `account`. At the moment we only allow `did:mailto` principal
   * to be used as an `account`.
   *
   * @param {API.AccountDID} account
   */
  async createRecovery(account) {
    return createRecovery(this, account)
  }

  /**
   * Creates (UCAN) delegation that gives specified `agent` an access to
   * specified ability (passed as `access.can` field) on the this space.
   * Optionally, you can specify `access.expiration` field to set the
   *
   * @param {API.Principal} principal
   * @param {object} [input]
   * @param {API.Access} [input.access]
   * @param {API.UCAN.UTCUnixTimestamp} [input.expiration]
   */
  createAuthorization(principal, input) {
    return createAuthorization(this, { ...input, audience: principal })
  }

  /**
   * Derives BIP39 mnemonic that can be used to recover the space.
   *
   * @returns {string}
   */
  toMnemonic() {
    return toMnemonic(this)
  }
}

const SpaceDID = Schema.did({ method: 'key' })

/**
 * Creates a (shared) space from given delegation.
 *
 * @param {API.Delegation} delegation
 */
export const fromDelegation = (delegation) => {
  const result = SpaceDID.read(delegation.capabilities[0].with)
  if (result.error) {
    throw Object.assign(
      new Error(
        `Invalid delegation, expected capabilities[0].with to be DID, ${result.error}`
      ),
      {
        cause: result.error,
      }
    )
  }

  /** @type {{name?:string, access?:API.SpaceAccessType}} */
  const meta = delegation.facts[0]?.space ?? {}

  // Ensure access defaults to public for backwards compatibility
  meta.access = SpaceAccess.from(meta.access)

  return new SharedSpace({ id: result.ok, delegation, meta })
}

/**
 * @typedef {object} Authorization
 * @property {API.Delegation[]} proofs
 *
 * @typedef {object} Space
 * @property {() => API.SpaceDID} did
 */

/**
 * @template {Record<string, any>} [S=API.Service]
 * @param {Space} space
 * @param {object} options
 * @param {API.Delegation[]} options.proofs
 * @param {API.Agent<S>} options.agent
 */
export const provision = async (space, { proofs, agent }) => {
  const [capability] = proofs[0].capabilities

  const { ok: account, error: reason } = Provider.AccountDID.read(
    capability.with
  )
  if (reason) {
    return error(reason)
  }

  return await Provider.add(agent, {
    consumer: space.did(),
    account,
    proofs,
  })
}

/**
 * Represents a shared space, meaning a space for which we have a delegation
 * and consequently have limited authority over.
 */
export class SharedSpace {
  /**
   * @typedef {object} SharedSpaceModel
   * @property {API.SpaceDID} id
   * @property {API.Delegation} delegation
   * @property {{name?:string, access?:API.SpaceAccessType}} meta
   * @property {API.Agent} [agent]
   *
   * @param {SharedSpaceModel} model
   */
  constructor(model) {
    this.model = model
  }

  get delegation() {
    return this.model.delegation
  }

  get meta() {
    return this.model.meta
  }

  get name() {
    return this.meta.name ?? ''
  }

  get access() {
    return SpaceAccess.from(this.meta.access)
  }

  did() {
    return this.model.id
  }

  /**
   * @param {string} name
   */
  withName(name) {
    return new SharedSpace({
      ...this.model,
      meta: { ...this.meta, name, access: this.access },
    })
  }
}
