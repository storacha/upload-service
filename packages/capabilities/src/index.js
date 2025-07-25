import * as Assert from './assert.js'
import * as Claim from './claim.js'
import * as Provider from './provider.js'
import * as Space from './space.js'
import * as Top from './top.js'
import * as Store from './store.js'
import * as Upload from './upload.js'
import * as Access from './access.js'
import * as Utils from './utils.js'
import * as Consumer from './consumer.js'
import * as Customer from './customer.js'
import * as Console from './console.js'
import * as RateLimit from './rate-limit.js'
import * as Admin from './admin.js'
import * as Subscription from './subscription.js'
import * as Filecoin from './filecoin/index.js'
import * as Storefront from './filecoin/storefront.js'
import * as Aggregator from './filecoin/aggregator.js'
import * as Dealer from './filecoin/dealer.js'
import * as DealTracker from './filecoin/deal-tracker.js'
import * as SpaceIndex from './space/index.js'
import * as UCAN from './ucan.js'
import * as Plan from './plan.js'
import * as Usage from './usage.js'
import * as Blob from './blob/index.js'
import * as SpaceBlob from './space/blob.js'
import * as W3sBlob from './web3.storage/blob.js'
import * as HTTP from './http.js'

export {
  Access,
  Assert,
  Claim,
  Provider,
  Space,
  Top,
  Store,
  Upload,
  Consumer,
  Customer,
  Console,
  Utils,
  RateLimit,
  Subscription,
  Filecoin,
  SpaceIndex,
  Storefront,
  Aggregator,
  Dealer,
  DealTracker,
  Admin,
  UCAN,
  Plan,
  Usage,
  Blob,
  SpaceBlob,
  W3sBlob,
  HTTP,
}

/** @type {import('./types.js').ServiceAbility[]} */
export const abilitiesAsStrings = [
  Top.top.can,
  Assert.assert.can,
  Assert.equals.can,
  Assert.inclusion.can,
  Assert.index.can,
  Assert.location.can,
  Assert.partition.can,
  Assert.relation.can,
  Claim.claim.can,
  Claim.cache.can,
  Provider.add.can,
  Space.space.can,
  Space.info.can,
  Space.EncryptionSetup.can,
  Space.EncryptionKeyDecrypt.can,
  Upload.upload.can,
  Upload.add.can,
  Upload.get.can,
  Upload.remove.can,
  Upload.list.can,
  Store.store.can,
  Store.add.can,
  Store.get.can,
  Store.remove.can,
  Store.list.can,
  Access.access.can,
  Access.authorize.can,
  UCAN.attest.can,
  UCAN.conclude.can,
  Customer.get.can,
  Consumer.has.can,
  Consumer.get.can,
  Subscription.get.can,
  Subscription.list.can,
  RateLimit.add.can,
  RateLimit.remove.can,
  RateLimit.list.can,
  Storefront.filecoinOffer.can,
  Storefront.filecoinSubmit.can,
  Storefront.filecoinAccept.can,
  Storefront.filecoinInfo.can,
  Aggregator.pieceOffer.can,
  Aggregator.pieceAccept.can,
  Dealer.aggregateOffer.can,
  Dealer.aggregateAccept.can,
  DealTracker.dealInfo.can,
  Admin.admin.can,
  Admin.upload.inspect.can,
  Admin.store.inspect.can,
  Plan.get.can,
  Plan.set.can,
  Plan.createAdminSession.can,
  Usage.usage.can,
  Usage.report.can,
  Blob.blob.can,
  Blob.allocate.can,
  Blob.accept.can,
  SpaceBlob.blob.can,
  SpaceBlob.add.can,
  SpaceBlob.remove.can,
  SpaceBlob.list.can,
  W3sBlob.blob.can,
  W3sBlob.allocate.can,
  W3sBlob.accept.can,
  HTTP.put.can,
  SpaceIndex.index.can,
  SpaceIndex.add.can,
]
