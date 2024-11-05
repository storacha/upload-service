# Changelog

## 1.0.0 (2024-11-05)


### ⚠ BREAKING CHANGES

* `AllocationsStorage` and `BlobsStorage` methods not take `MultihashDigest` types instead of `Uint8Array`s.
* updates agent-store api to unblock integration with w3infra ([#1479](https://github.com/storacha/upload-service/issues/1479))
* **upload-api:** integrate agent store for idempotence & invocation/receipt persistence  ([#1444](https://github.com/storacha/upload-service/issues/1444))
* add download URL method to `BlobsStorage` ([#1469](https://github.com/storacha/upload-service/issues/1469))
* delegated capabilities required to use `uploadFile`, `uploadDirectory` and `uploadCAR` have changed. In order to use these methods your agent will now need to be delegated `blob/add`, `index/add`, `filecoin/offer` and `upload/add` capabilities. Note: no code changes are required.
* deprecate issuer ([#1344](https://github.com/storacha/upload-service/issues/1344))
* add `index/add` handler ([#1421](https://github.com/storacha/upload-service/issues/1421))
* restrict store API to CARs ([#1415](https://github.com/storacha/upload-service/issues/1415))
* **capabilities:** `BlobMultihash` type in `@web3-storage/capabilities` renamed to `Multihash`.
* allocations storage interface now requires remove to be implemented
* release upload api with new filecoin api service for storefront ([#1347](https://github.com/storacha/upload-service/issues/1347))
* return allocated bytes in `store/add` receipt ([#1213](https://github.com/storacha/upload-service/issues/1213))
* add storefront filecoin api to upload api ([#1052](https://github.com/storacha/upload-service/issues/1052))

### Features

* access agent proofs method would fail to return some session proofs ([#1047](https://github.com/storacha/upload-service/issues/1047)) ([d23a1c9](https://github.com/storacha/upload-service/commit/d23a1c972f91b855ee91f862da15bab0e68cca0a))
* add "plan/create-admin-session" capability ([#1411](https://github.com/storacha/upload-service/issues/1411)) ([50eeeb5](https://github.com/storacha/upload-service/commit/50eeeb502335ba0413318b5047869a275901824b))
* add `index/add` handler ([#1421](https://github.com/storacha/upload-service/issues/1421)) ([cbe9524](https://github.com/storacha/upload-service/commit/cbe952451b719fe7ae2f7480d26865eca80aba55))
* add `initialize` method to `PlansStorage` ([#1278](https://github.com/storacha/upload-service/issues/1278)) ([6792126](https://github.com/storacha/upload-service/commit/6792126d63a1e983713c3886eeba64038cb7cf34))
* add `set` method to `AccountPlan` ([#1281](https://github.com/storacha/upload-service/issues/1281)) ([b94f0d4](https://github.com/storacha/upload-service/commit/b94f0d48ea71454cef867feb9291c500f676faa3))
* add `store/get` and `upload/get` capabilities ([#942](https://github.com/storacha/upload-service/issues/942)) ([40c79eb](https://github.com/storacha/upload-service/commit/40c79eb8f246775b9e1828240f271fa75ef696be))
* add `subscription/list` capability ([#1088](https://github.com/storacha/upload-service/issues/1088)) ([471d7e5](https://github.com/storacha/upload-service/commit/471d7e5db24e12a06c1c52ae76bf95ff9471bac8))
* add blob list and remove ([#1385](https://github.com/storacha/upload-service/issues/1385)) ([2f69946](https://github.com/storacha/upload-service/commit/2f6994600e8cc0f70cedc5afe06003a2a0b70af3))
* add blob protocol to upload-client ([#1425](https://github.com/storacha/upload-service/issues/1425)) ([49aef56](https://github.com/storacha/upload-service/commit/49aef564a726d34dbbedbd83f5366d9320180f99))
* add blob/get ([#1484](https://github.com/storacha/upload-service/issues/1484)) ([328039d](https://github.com/storacha/upload-service/commit/328039d8a29fec3c1bbab28d1bb9de1643f54f71))
* add download URL method to `BlobsStorage` ([#1469](https://github.com/storacha/upload-service/issues/1469)) ([4a2c994](https://github.com/storacha/upload-service/commit/4a2c99478fdcb129da260c1fc14da0ba1842e5ff))
* add storefront filecoin api to upload api ([#1052](https://github.com/storacha/upload-service/issues/1052)) ([39916c2](https://github.com/storacha/upload-service/commit/39916c25cbbfce6392fbb7cc71112987185c798c))
* add usage/report capability ([#1079](https://github.com/storacha/upload-service/issues/1079)) ([6418b4b](https://github.com/storacha/upload-service/commit/6418b4b22329a118fb258928bd9a6a45ced5ce45))
* allow customers to create more than one space ([#989](https://github.com/storacha/upload-service/issues/989)) ([06e0ca9](https://github.com/storacha/upload-service/commit/06e0ca9fd3e34104002023f81fc605b666ef9a5b))
* blob, web3.storage and ucan conclude capabilities together with api handlers  ([#1342](https://github.com/storacha/upload-service/issues/1342)) ([00735a8](https://github.com/storacha/upload-service/commit/00735a80dfddbe86359af78ed9bd182f4804691f))
* **capabilities:** add `index/add` capability ([#1410](https://github.com/storacha/upload-service/issues/1410)) ([1b71b89](https://github.com/storacha/upload-service/commit/1b71b89ed989cde8ef4bf35c1ebc333872cbc54c))
* change `plan/update` to `plan/set` and use existing `PlansStorage#set` to implement an invocation handler ([#1258](https://github.com/storacha/upload-service/issues/1258)) ([1ccbfe9](https://github.com/storacha/upload-service/commit/1ccbfe9f84ae5b2e99e315c92d15d2b54e9723ba))
* deprecate issuer ([#1344](https://github.com/storacha/upload-service/issues/1344)) ([afbbde3](https://github.com/storacha/upload-service/commit/afbbde340d974792699dc56946cc1c72f74c09e3))
* expose test context of upload-api ([#1069](https://github.com/storacha/upload-service/issues/1069)) ([f0757d1](https://github.com/storacha/upload-service/commit/f0757d15fbe653ae4914960ac401385afd752e57))
* filecoin info ([#1091](https://github.com/storacha/upload-service/issues/1091)) ([adb2442](https://github.com/storacha/upload-service/commit/adb24424d1faf50daf2339b77c22fdd44faa236a))
* generate sharded DAG index on client and invoke w `index/add` ([#1451](https://github.com/storacha/upload-service/issues/1451)) ([a6d9026](https://github.com/storacha/upload-service/commit/a6d9026536e60c0ce93b613acc6e337f2a21aeb2))
* Generate Space proofs on the fly, on `access/claim` ([#1555](https://github.com/storacha/upload-service/issues/1555)) ([9e2b1d4](https://github.com/storacha/upload-service/commit/9e2b1d4dc721d3e61cea008719d172909c984344))
* implement `plan/get` capability ([#1005](https://github.com/storacha/upload-service/issues/1005)) ([f0456d2](https://github.com/storacha/upload-service/commit/f0456d2e2aab462666810e22abd7dfb7e1ce21be))
* move blob index logic from upload-api to blob-index lib ([#1434](https://github.com/storacha/upload-service/issues/1434)) ([797f628](https://github.com/storacha/upload-service/commit/797f6285c1b000af9eaf0240f85deca6a0b83e06))
* optionally require plans for provisioning ([#1087](https://github.com/storacha/upload-service/issues/1087)) ([b24731b](https://github.com/storacha/upload-service/commit/b24731b0bdde785eef7785468cc1f49b92af2563))
* progress on blob/add handler ([9b16598](https://github.com/storacha/upload-service/commit/9b16598117aeafef1e5040af067e39beba42bbbe))
* publish index claim ([#1487](https://github.com/storacha/upload-service/issues/1487)) ([237b0c6](https://github.com/storacha/upload-service/commit/237b0c6cda70ae3e156bac8a011a2739b346ae4b))
* remove issuer row ([#1345](https://github.com/storacha/upload-service/issues/1345)) ([cf5b0db](https://github.com/storacha/upload-service/commit/cf5b0db276ffe3b9926dbf1d8e2cd04ef7b607c9))
* remove store protocol ([d59ec88](https://github.com/storacha/upload-service/commit/d59ec883ace9c3f084772f9520b6df81cc13b7af))
* remove store protocol ([#13](https://github.com/storacha/upload-service/issues/13)) ([0028049](https://github.com/storacha/upload-service/commit/0028049f0bd3fcb816968687694c4611a5147148))
* restrict store API to CARs ([#1415](https://github.com/storacha/upload-service/issues/1415)) ([e53aa87](https://github.com/storacha/upload-service/commit/e53aa87780446458ef9a19c88877073c1470d50e))
* return allocated bytes in `store/add` receipt ([#1213](https://github.com/storacha/upload-service/issues/1213)) ([5d52e44](https://github.com/storacha/upload-service/commit/5d52e447c14e7f7fd334e7ff575e032b7b0d89d7))
* router ([#11](https://github.com/storacha/upload-service/issues/11)) ([c810735](https://github.com/storacha/upload-service/commit/c8107354da663120228f779814eafa0c9a3e80a2))
* two more interface tweaks ([#1287](https://github.com/storacha/upload-service/issues/1287)) ([bc3c364](https://github.com/storacha/upload-service/commit/bc3c36452454398ea8e0f574aed44b318561ad94))
* updates agent-store api to unblock integration with w3infra ([#1479](https://github.com/storacha/upload-service/issues/1479)) ([2998a93](https://github.com/storacha/upload-service/commit/2998a938628a924361450d24c5fc7be572acef3e))
* upgrade ucanto/transport to 9.1.0 in all packages to get more verbose errors from HTTP transport on non-ok response ([#1312](https://github.com/storacha/upload-service/issues/1312)) ([d6978d7](https://github.com/storacha/upload-service/commit/d6978d7ab299be76987c6533d18e6857f6998fe6))
* **upload-api:** integrate agent store for idempotence & invocation/receipt persistence  ([#1444](https://github.com/storacha/upload-service/issues/1444)) ([c9bf33e](https://github.com/storacha/upload-service/commit/c9bf33e5512397a654db933a5e6b5db0c7c22da5))
* usage/record capability definition ([#1562](https://github.com/storacha/upload-service/issues/1562)) ([98c8a87](https://github.com/storacha/upload-service/commit/98c8a87c52ef88da728225259e77f65733d2d7e6))
* use digest in `blob/accept` location commitment ([#1480](https://github.com/storacha/upload-service/issues/1480)) ([ade45eb](https://github.com/storacha/upload-service/commit/ade45eb6f9b71f4bb4fcc771345ad21e966db730))
* wip router ([ffcd9c7](https://github.com/storacha/upload-service/commit/ffcd9c75aee61d37b7fdfc55f2d4b7bee7e9d724))


### Fixes

* `encodeURIComponent` on bucket origin ([#1448](https://github.com/storacha/upload-service/issues/1448)) ([5618644](https://github.com/storacha/upload-service/commit/561864422db2ec3eaddc2d790cc4ea0406eebf32))
* add debugging for allocate receipt ([315f761](https://github.com/storacha/upload-service/commit/315f76194d029fd72b1f5776a0194494af82b2e4))
* add errors to exports ([#1368](https://github.com/storacha/upload-service/issues/1368)) ([27619c5](https://github.com/storacha/upload-service/commit/27619c517e66321012f1c9ba0d8edb9c0037d6ff))
* add format specifier to blob location claim URL ([#1445](https://github.com/storacha/upload-service/issues/1445)) ([9982d12](https://github.com/storacha/upload-service/commit/9982d12b0a1f9a6da3f0d4264b9a35348e189dfb))
* add whitespace to trigger a release ([#1390](https://github.com/storacha/upload-service/issues/1390)) ([ec95a0e](https://github.com/storacha/upload-service/commit/ec95a0e5cf1bc08c6eabba1214b9803fda723393))
* allocation interface rename invocation to cause ([#1382](https://github.com/storacha/upload-service/issues/1382)) ([2d13042](https://github.com/storacha/upload-service/commit/2d1304243c2f21de449090261001a625008c5607))
* enable storefront signer to be different from main service signer ([#1072](https://github.com/storacha/upload-service/issues/1072)) ([21ded3c](https://github.com/storacha/upload-service/commit/21ded3c171ca66480e4f74329943527dcc2bac3e))
* Error should refer to Resource, not Issuer ([#1558](https://github.com/storacha/upload-service/issues/1558)) ([25e35e3](https://github.com/storacha/upload-service/commit/25e35e3c3ae86be549f11861f10894c86c46cbdd))
* export ShardedDAGIndex type ([979e2c3](https://github.com/storacha/upload-service/commit/979e2c3b070025e952e7bb490701aabb5e660e39))
* export test handlers and storages ([#1370](https://github.com/storacha/upload-service/issues/1370)) ([61de1e1](https://github.com/storacha/upload-service/commit/61de1e1eb4d2cee8eaea87913e8fd17ec17f1cd9))
* export UsageStorage ([#1334](https://github.com/storacha/upload-service/issues/1334)) ([d466211](https://github.com/storacha/upload-service/commit/d466211979e26698755f99daeaed8697c0ee2bdd))
* fix arethetypesworking errors in all packages ([#1004](https://github.com/storacha/upload-service/issues/1004)) ([2e2936a](https://github.com/storacha/upload-service/commit/2e2936a3831389dd13be5be5146a04e2b15553c5))
* floating promises and add no-floating-promises to eslint-config-w3up ([#1198](https://github.com/storacha/upload-service/issues/1198)) ([1b8c5aa](https://github.com/storacha/upload-service/commit/1b8c5aa86ec3d177bf77df4e2916699c1f522598))
* issue where typedoc docs would only show full docs for w3up-client ([#1141](https://github.com/storacha/upload-service/issues/1141)) ([0b8d3f3](https://github.com/storacha/upload-service/commit/0b8d3f3b52918b1b4d3b76ea6fea3fb0c837cd73))
* lint ([#1095](https://github.com/storacha/upload-service/issues/1095)) ([f9cc770](https://github.com/storacha/upload-service/commit/f9cc77029d7c0651cb2961d08eca6f94dc1aef6c))
* migrate repo ([#1388](https://github.com/storacha/upload-service/issues/1388)) ([10b7742](https://github.com/storacha/upload-service/commit/10b7742d3f568f4b2dc1e2f435916a9e23480952))
* migrate repo ([#1389](https://github.com/storacha/upload-service/issues/1389)) ([475a287](https://github.com/storacha/upload-service/commit/475a28743ff9f7138b46dfe4227d3c80ed75a6a2))
* missing exports ([dec43e5](https://github.com/storacha/upload-service/commit/dec43e51ee3b22a960a3769537c04f3de55d7097))
* missing exports ([#1335](https://github.com/storacha/upload-service/issues/1335)) ([4e41ff4](https://github.com/storacha/upload-service/commit/4e41ff4498cd75853204d9ae209fe36008cd8018))
* missing test export ([1fc6808](https://github.com/storacha/upload-service/commit/1fc68087ccca5798cd9c633580025bef034bcadf))
* one more tweak to the `PlanStorage` interface ([#1280](https://github.com/storacha/upload-service/issues/1280)) ([5a44565](https://github.com/storacha/upload-service/commit/5a44565feb33fc08102cd2559a2f22fb0476e86b))
* package metadata ([#1161](https://github.com/storacha/upload-service/issues/1161)) ([b8a1cc2](https://github.com/storacha/upload-service/commit/b8a1cc2e125a91be582998bda295e1ae1caab087))
* release upload api with new filecoin api service for storefront ([#1347](https://github.com/storacha/upload-service/issues/1347)) ([692751a](https://github.com/storacha/upload-service/commit/692751aa6a178ede2820990ca9a44118bd6e8e55))
* rename blob and index client capabilities ([#1478](https://github.com/storacha/upload-service/issues/1478)) ([17e3a31](https://github.com/storacha/upload-service/commit/17e3a3161c6585b1844abcf7ed27252fa8580870))
* repo URLs ([#1550](https://github.com/storacha/upload-service/issues/1550)) ([e02ddf3](https://github.com/storacha/upload-service/commit/e02ddf3696553b03f8d2f7316de0a99a9303a60f))
* reset bucket after use ([689904e](https://github.com/storacha/upload-service/commit/689904e6aca25bc6efde181448f4d5a68869854d))
* return correct response for index extract error ([67ef2b0](https://github.com/storacha/upload-service/commit/67ef2b02ab2d745e4a2f023cf03f58c2a6ee1e2f))
* revert enable storefront signer to be different from main service signer ([#1075](https://github.com/storacha/upload-service/issues/1075)) ([80cdde0](https://github.com/storacha/upload-service/commit/80cdde0f5b610cf6328dc17cb505759eddda821a))
* stop writing to DUDEWHERE ([#1500](https://github.com/storacha/upload-service/issues/1500)) ([cf0a1d6](https://github.com/storacha/upload-service/commit/cf0a1d6e08d515854080899e57d16dca420f81e6))
* storage operation failed type name instead of store ([#1374](https://github.com/storacha/upload-service/issues/1374)) ([a99251e](https://github.com/storacha/upload-service/commit/a99251efc712888bf76270a4fe372163f938eddf))
* test against actual api ([#1438](https://github.com/storacha/upload-service/issues/1438)) ([f8132ca](https://github.com/storacha/upload-service/commit/f8132ca1fced72a4addc7e9f0a2162e823c1ea5f))
* **test:** await promise and check error ([#1563](https://github.com/storacha/upload-service/issues/1563)) ([86e7a46](https://github.com/storacha/upload-service/commit/86e7a46e289ee176fcfa6827827302510434ffb5))
* tests ([b179910](https://github.com/storacha/upload-service/commit/b179910a3b5259a1da0607340d23669c30e34c9e))
* trigger release for upload api ([#1107](https://github.com/storacha/upload-service/issues/1107)) ([9930b10](https://github.com/storacha/upload-service/commit/9930b10962d365303ae45467a44f414aeac3dccb))
* ucan conclude scheduler invocation type and improve test ([#1379](https://github.com/storacha/upload-service/issues/1379)) ([11e0864](https://github.com/storacha/upload-service/commit/11e0864bfdc49852127d2d55ef08954d775d7901))
* upgrade @ucanto/validator with bugfix ([#1151](https://github.com/storacha/upload-service/issues/1151)) ([d4e961b](https://github.com/storacha/upload-service/commit/d4e961bab09e88245e7d9323146849271e78eb57))
* upgrade ucanto core ([#1127](https://github.com/storacha/upload-service/issues/1127)) ([5ce4d22](https://github.com/storacha/upload-service/commit/5ce4d2292d7e980da4a2ea0f1583f608a81157d2))
* upgrade ucanto libs and format filecoin api ([#1359](https://github.com/storacha/upload-service/issues/1359)) ([87ca098](https://github.com/storacha/upload-service/commit/87ca098186fe204ff3409a2684719f1c54148c97))
* upload API test fixes ([6b0d72d](https://github.com/storacha/upload-service/commit/6b0d72dee3dc9ce5320ad8de333a718d644b5c3d))
* use MultihashDigest type in stores ([#1474](https://github.com/storacha/upload-service/issues/1474)) ([6c6a3bd](https://github.com/storacha/upload-service/commit/6c6a3bdcb924cf6f9a4723f710a27f1ae34ca560))
* use one-webcrypto from npm ([#1525](https://github.com/storacha/upload-service/issues/1525)) ([9345c54](https://github.com/storacha/upload-service/commit/9345c5415bc0b0d6ce8ccdbe92eb155b11835fd8))


### Other Changes

* Add `pnpm dev` to watch-build all packages ([#1533](https://github.com/storacha/upload-service/issues/1533)) ([07970ef](https://github.com/storacha/upload-service/commit/07970efd443149158ebbfb2c4e745b5007eb9407))
* appease linter ([782c6d0](https://github.com/storacha/upload-service/commit/782c6d0b3ca93ee801b38126339a262bcd713ede))
* formatter ([f4f5f5a](https://github.com/storacha/upload-service/commit/f4f5f5accc0c80f3dfb1b6916d04df0e594c89af))
* **main:** release upload-api 10.0.0 ([#1387](https://github.com/storacha/upload-service/issues/1387)) ([1161326](https://github.com/storacha/upload-service/commit/1161326aa0d6e2307f34419d4418b3eb1df96537))
* **main:** release upload-api 10.0.1 ([#1393](https://github.com/storacha/upload-service/issues/1393)) ([60a1aeb](https://github.com/storacha/upload-service/commit/60a1aeb7208b2f4a692d94b510f6fa1a4f56ca50))
* **main:** release upload-api 11.0.0 ([#1413](https://github.com/storacha/upload-service/issues/1413)) ([4e8e349](https://github.com/storacha/upload-service/commit/4e8e349707eb176b189c6e7b7556c449e6bd4d3e))
* **main:** release upload-api 12.0.0 ([#1417](https://github.com/storacha/upload-service/issues/1417)) ([a769934](https://github.com/storacha/upload-service/commit/a769934ac6dbd9586d08c87983882caa2ce7dd07))
* **main:** release upload-api 13.0.0 ([#1427](https://github.com/storacha/upload-service/issues/1427)) ([9e4774e](https://github.com/storacha/upload-service/commit/9e4774e5d329de7f2806f7c6ae3dae0def824c24))
* **main:** release upload-api 13.0.1 ([#1432](https://github.com/storacha/upload-service/issues/1432)) ([cf7519e](https://github.com/storacha/upload-service/commit/cf7519ea0e92939477b191c7f92ab6a106a49fa2))
* **main:** release upload-api 13.0.2 ([#1433](https://github.com/storacha/upload-service/issues/1433)) ([b54173a](https://github.com/storacha/upload-service/commit/b54173a81f7daff63fcd2899c44f89a475b20a0c))
* **main:** release upload-api 14.0.0 ([#1441](https://github.com/storacha/upload-service/issues/1441)) ([dc336bd](https://github.com/storacha/upload-service/commit/dc336bd30bd6be0f92680d28620e1ae803d619ef))
* **main:** release upload-api 15.0.0 ([#1463](https://github.com/storacha/upload-service/issues/1463)) ([e68794b](https://github.com/storacha/upload-service/commit/e68794bc488f88fa942d8395660dc3825759d199))
* **main:** release upload-api 15.0.1 ([#1466](https://github.com/storacha/upload-service/issues/1466)) ([f2192f8](https://github.com/storacha/upload-service/commit/f2192f81ae665db9e72f74467ca281684c2d9ecc))
* **main:** release upload-api 16.0.0 ([#1470](https://github.com/storacha/upload-service/issues/1470)) ([92f3017](https://github.com/storacha/upload-service/commit/92f3017c740faca1f818783b1a6f1ff38f7073e8))
* **main:** release upload-api 17.0.0 ([#1471](https://github.com/storacha/upload-service/issues/1471)) ([99937ba](https://github.com/storacha/upload-service/commit/99937babe13b7b6572bba4b945733b9020f89cef))
* **main:** release upload-api 17.1.0 ([#1491](https://github.com/storacha/upload-service/issues/1491)) ([7ed2b16](https://github.com/storacha/upload-service/commit/7ed2b16ddeaad03f881363f805ff63a7045f6882))
* **main:** release upload-api 18.0.0 ([#1501](https://github.com/storacha/upload-service/issues/1501)) ([02e3bca](https://github.com/storacha/upload-service/commit/02e3bca252519953a3943e5922ab171e3f34feab))
* **main:** release upload-api 18.0.1 ([#1511](https://github.com/storacha/upload-service/issues/1511)) ([28fc0cb](https://github.com/storacha/upload-service/commit/28fc0cb1c1e798720dc2e34a4ecbc6df8d78b606))
* **main:** release upload-api 18.0.2 ([#1519](https://github.com/storacha/upload-service/issues/1519)) ([9421a2e](https://github.com/storacha/upload-service/commit/9421a2ef1ad9cea8986099afaea9e2af7faa225f))
* **main:** release upload-api 18.0.3 ([#1527](https://github.com/storacha/upload-service/issues/1527)) ([9a954bb](https://github.com/storacha/upload-service/commit/9a954bb11b762cf1ca1cfa95368ee66287549155))
* **main:** release upload-api 18.1.0 ([#1543](https://github.com/storacha/upload-service/issues/1543)) ([e93190d](https://github.com/storacha/upload-service/commit/e93190dc9c924b054ad2e5fede5deb3f6728b2af))
* **main:** release upload-api 6.1.0 ([#981](https://github.com/storacha/upload-service/issues/981)) ([b7dc1c9](https://github.com/storacha/upload-service/commit/b7dc1c9f5b03479c362bc570690da4df843bbd61))
* **main:** release upload-api 6.2.0 ([#985](https://github.com/storacha/upload-service/issues/985)) ([84ebb2d](https://github.com/storacha/upload-service/commit/84ebb2d4b19c22a3abebaf25db45fbc08e3f5a6b))
* **main:** release upload-api 6.3.0 ([#1003](https://github.com/storacha/upload-service/issues/1003)) ([c078d92](https://github.com/storacha/upload-service/commit/c078d92f62cacda9fdd7a46db430f25dc20d6b2a))
* **main:** release upload-api 7.0.0 ([#1027](https://github.com/storacha/upload-service/issues/1027)) ([dbb1307](https://github.com/storacha/upload-service/commit/dbb13071593cbf3c415f85b2384597da9bc47e2b))
* **main:** release upload-api 7.1.0 ([#1057](https://github.com/storacha/upload-service/issues/1057)) ([b76af65](https://github.com/storacha/upload-service/commit/b76af65571f1f11c9e3ad4866012c29011fe2cc0))
* **main:** release upload-api 7.1.1 ([#1074](https://github.com/storacha/upload-service/issues/1074)) ([47bcf6d](https://github.com/storacha/upload-service/commit/47bcf6d409b0e742f1e779d550b6e8c25935ae87))
* **main:** release upload-api 7.1.2 ([#1076](https://github.com/storacha/upload-service/issues/1076)) ([7131092](https://github.com/storacha/upload-service/commit/7131092decb5371bec69955862fd0772461e94be))
* **main:** release upload-api 7.2.0 ([#1082](https://github.com/storacha/upload-service/issues/1082)) ([2364872](https://github.com/storacha/upload-service/commit/2364872f3d9113843d8ee431a121fdcb43a04792))
* **main:** release upload-api 7.3.0 ([#1096](https://github.com/storacha/upload-service/issues/1096)) ([44ffd44](https://github.com/storacha/upload-service/commit/44ffd44dce60a71b433f3be5af86213934591b6a))
* **main:** release upload-api 7.3.1 ([#1108](https://github.com/storacha/upload-service/issues/1108)) ([78ce4ee](https://github.com/storacha/upload-service/commit/78ce4ee9ddb82c02966d430f1c774aed88b7f4bf))
* **main:** release upload-api 7.3.2 ([#1128](https://github.com/storacha/upload-service/issues/1128)) ([a6590fe](https://github.com/storacha/upload-service/commit/a6590feadac043a094028f6a62f5d14e7f7d1fba))
* **main:** release upload-api 7.3.3 ([#1143](https://github.com/storacha/upload-service/issues/1143)) ([f3513d0](https://github.com/storacha/upload-service/commit/f3513d0accc34c17f73142c36a99408b538f0ecf))
* **main:** release upload-api 7.3.4 ([#1165](https://github.com/storacha/upload-service/issues/1165)) ([131b552](https://github.com/storacha/upload-service/commit/131b5520b41b3ec7694d3eb252c54eb97ad6519c))
* **main:** release upload-api 7.3.5 ([#1201](https://github.com/storacha/upload-service/issues/1201)) ([24aed89](https://github.com/storacha/upload-service/commit/24aed890b27cfb079f705ddb3e0f3cd7b878c121))
* **main:** release upload-api 8.0.0 ([#1232](https://github.com/storacha/upload-service/issues/1232)) ([26b4c2d](https://github.com/storacha/upload-service/commit/26b4c2d7c189558387363fa09462f2721cfc0aca))
* **main:** release upload-api 8.1.0 ([#1262](https://github.com/storacha/upload-service/issues/1262)) ([e3dfe17](https://github.com/storacha/upload-service/commit/e3dfe1743fee586627f7898e54aed8f78040f2a5))
* **main:** release upload-api 8.2.0 ([#1282](https://github.com/storacha/upload-service/issues/1282)) ([c328d77](https://github.com/storacha/upload-service/commit/c328d778b5f50e892e83922fa707633277cf5714))
* **main:** release upload-api 8.3.0 ([#1289](https://github.com/storacha/upload-service/issues/1289)) ([4760a85](https://github.com/storacha/upload-service/commit/4760a85534bddfbd9c1cb89b523aa5b09c0726b8))
* **main:** release upload-api 8.4.0 ([#1316](https://github.com/storacha/upload-service/issues/1316)) ([fa3e3a2](https://github.com/storacha/upload-service/commit/fa3e3a2863b20309395236eecfc34efb9d631461))
* **main:** release upload-api 8.4.1 ([#1336](https://github.com/storacha/upload-service/issues/1336)) ([f5bac9d](https://github.com/storacha/upload-service/commit/f5bac9d27610d976d1144ea12a5c6f9448e7974a))
* **main:** release upload-api 9.0.0 ([#1348](https://github.com/storacha/upload-service/issues/1348)) ([d88706e](https://github.com/storacha/upload-service/commit/d88706edd7afc2d8bfabcef41038f83ad89410ea))
* **main:** release upload-api 9.0.1 ([#1360](https://github.com/storacha/upload-service/issues/1360)) ([f99bf92](https://github.com/storacha/upload-service/commit/f99bf923cb3420c44cb3872f4105d4352c3c5d95))
* **main:** release upload-api 9.1.0 ([#1367](https://github.com/storacha/upload-service/issues/1367)) ([8721d93](https://github.com/storacha/upload-service/commit/8721d93a1104c94f836b4035bea1344cd269174e))
* **main:** release upload-api 9.1.1 ([#1369](https://github.com/storacha/upload-service/issues/1369)) ([8ee276d](https://github.com/storacha/upload-service/commit/8ee276d3ec0886dc09eca80a42c9c5f14c935861))
* **main:** release upload-api 9.1.2 ([#1372](https://github.com/storacha/upload-service/issues/1372)) ([0fc7bd1](https://github.com/storacha/upload-service/commit/0fc7bd13a8d08a60f5f83a0c4e789670d19c7f70))
* **main:** release upload-api 9.1.3 ([#1375](https://github.com/storacha/upload-service/issues/1375)) ([e05ea7e](https://github.com/storacha/upload-service/commit/e05ea7ec38833c9b6e8ea651fb3a1001050ce2b2))
* **main:** release upload-api 9.1.4 ([#1380](https://github.com/storacha/upload-service/issues/1380)) ([c64a7ff](https://github.com/storacha/upload-service/commit/c64a7ff51b9aa89c2b16739d7acabee91040676e))
* **main:** release upload-api 9.1.5 ([#1383](https://github.com/storacha/upload-service/issues/1383)) ([3da0bf1](https://github.com/storacha/upload-service/commit/3da0bf130cbecd0114cfe570902b1208aea8623d))
* no longer depends on hd-scripts, packages use/configure eslint directly, fixes warnings from npm lint script ([#1058](https://github.com/storacha/upload-service/issues/1058)) ([ebdb99b](https://github.com/storacha/upload-service/commit/ebdb99b0d3fc912f93ace3d533b915f844b35856))
* package renames ([0f797ed](https://github.com/storacha/upload-service/commit/0f797ed298b570dd649aa18055f801b0ab6fbfd8))
* remove unused dependency ([e60c74d](https://github.com/storacha/upload-service/commit/e60c74dbbd2449a07a7e23671c82aa664d8b82b3))

## [18.1.0](https://github.com/storacha/w3up/compare/upload-api-v18.0.3...upload-api-v18.1.0) (2024-10-24)


### Features

* Generate Space proofs on the fly, on `access/claim` ([#1555](https://github.com/storacha/w3up/issues/1555)) ([9e2b1d4](https://github.com/storacha/w3up/commit/9e2b1d4dc721d3e61cea008719d172909c984344))
* usage/record capability definition ([#1562](https://github.com/storacha/w3up/issues/1562)) ([98c8a87](https://github.com/storacha/w3up/commit/98c8a87c52ef88da728225259e77f65733d2d7e6))


### Fixes

* Error should refer to Resource, not Issuer ([#1558](https://github.com/storacha/w3up/issues/1558)) ([25e35e3](https://github.com/storacha/w3up/commit/25e35e3c3ae86be549f11861f10894c86c46cbdd))
* repo URLs ([#1550](https://github.com/storacha/w3up/issues/1550)) ([e02ddf3](https://github.com/storacha/w3up/commit/e02ddf3696553b03f8d2f7316de0a99a9303a60f))
* **test:** await promise and check error ([#1563](https://github.com/storacha/w3up/issues/1563)) ([86e7a46](https://github.com/storacha/w3up/commit/86e7a46e289ee176fcfa6827827302510434ffb5))


### Other Changes

* Add `pnpm dev` to watch-build all packages ([#1533](https://github.com/storacha/w3up/issues/1533)) ([07970ef](https://github.com/storacha/w3up/commit/07970efd443149158ebbfb2c4e745b5007eb9407))

## [18.0.3](https://github.com/storacha-network/w3up/compare/upload-api-v18.0.2...upload-api-v18.0.3) (2024-07-29)


### Fixes

* use one-webcrypto from npm ([#1525](https://github.com/storacha-network/w3up/issues/1525)) ([9345c54](https://github.com/storacha-network/w3up/commit/9345c5415bc0b0d6ce8ccdbe92eb155b11835fd8))

## [18.0.2](https://github.com/storacha-network/w3up/compare/upload-api-v18.0.1...upload-api-v18.0.2) (2024-07-16)


### Fixes

* add debugging for allocate receipt ([315f761](https://github.com/storacha-network/w3up/commit/315f76194d029fd72b1f5776a0194494af82b2e4))

## [18.0.1](https://github.com/storacha-network/w3up/compare/upload-api-v18.0.0...upload-api-v18.0.1) (2024-06-20)


### Fixes

* return correct response for index extract error ([67ef2b0](https://github.com/storacha-network/w3up/commit/67ef2b02ab2d745e4a2f023cf03f58c2a6ee1e2f))

## [18.0.0](https://github.com/w3s-project/w3up/compare/upload-api-v17.1.0...upload-api-v18.0.0) (2024-06-07)


### ⚠ BREAKING CHANGES

* `AllocationsStorage` and `BlobsStorage` methods not take `MultihashDigest` types instead of `Uint8Array`s.

### Features

* publish index claim ([#1487](https://github.com/w3s-project/w3up/issues/1487)) ([237b0c6](https://github.com/w3s-project/w3up/commit/237b0c6cda70ae3e156bac8a011a2739b346ae4b))


### Fixes

* stop writing to DUDEWHERE ([#1500](https://github.com/w3s-project/w3up/issues/1500)) ([cf0a1d6](https://github.com/w3s-project/w3up/commit/cf0a1d6e08d515854080899e57d16dca420f81e6))
* use MultihashDigest type in stores ([#1474](https://github.com/w3s-project/w3up/issues/1474)) ([6c6a3bd](https://github.com/w3s-project/w3up/commit/6c6a3bdcb924cf6f9a4723f710a27f1ae34ca560))

## [17.1.0](https://github.com/w3s-project/w3up/compare/upload-api-v17.0.0...upload-api-v17.1.0) (2024-06-04)


### Features

* add blob/get ([#1484](https://github.com/w3s-project/w3up/issues/1484)) ([328039d](https://github.com/w3s-project/w3up/commit/328039d8a29fec3c1bbab28d1bb9de1643f54f71))

## [17.0.0](https://github.com/w3s-project/w3up/compare/upload-api-v16.0.0...upload-api-v17.0.0) (2024-05-30)


### ⚠ BREAKING CHANGES

* updates agent-store api to unblock integration with w3infra ([#1479](https://github.com/w3s-project/w3up/issues/1479))
* **upload-api:** integrate agent store for idempotence & invocation/receipt persistence  ([#1444](https://github.com/w3s-project/w3up/issues/1444))

### Features

* updates agent-store api to unblock integration with w3infra ([#1479](https://github.com/w3s-project/w3up/issues/1479)) ([2998a93](https://github.com/w3s-project/w3up/commit/2998a938628a924361450d24c5fc7be572acef3e))
* **upload-api:** integrate agent store for idempotence & invocation/receipt persistence  ([#1444](https://github.com/w3s-project/w3up/issues/1444)) ([c9bf33e](https://github.com/w3s-project/w3up/commit/c9bf33e5512397a654db933a5e6b5db0c7c22da5))
* use digest in `blob/accept` location commitment ([#1480](https://github.com/w3s-project/w3up/issues/1480)) ([ade45eb](https://github.com/w3s-project/w3up/commit/ade45eb6f9b71f4bb4fcc771345ad21e966db730))


### Fixes

* rename blob and index client capabilities ([#1478](https://github.com/w3s-project/w3up/issues/1478)) ([17e3a31](https://github.com/w3s-project/w3up/commit/17e3a3161c6585b1844abcf7ed27252fa8580870))

## [16.0.0](https://github.com/w3s-project/w3up/compare/upload-api-v15.0.1...upload-api-v16.0.0) (2024-05-16)


### ⚠ BREAKING CHANGES

* add download URL method to `BlobsStorage` ([#1469](https://github.com/w3s-project/w3up/issues/1469))

### Features

* add download URL method to `BlobsStorage` ([#1469](https://github.com/w3s-project/w3up/issues/1469)) ([4a2c994](https://github.com/w3s-project/w3up/commit/4a2c99478fdcb129da260c1fc14da0ba1842e5ff))

## [15.0.1](https://github.com/w3s-project/w3up/compare/upload-api-v15.0.0...upload-api-v15.0.1) (2024-05-15)


### Fixes

* export ShardedDAGIndex type ([979e2c3](https://github.com/w3s-project/w3up/commit/979e2c3b070025e952e7bb490701aabb5e660e39))

## [15.0.0](https://github.com/w3s-project/w3up/compare/upload-api-v14.0.0...upload-api-v15.0.0) (2024-05-15)


### ⚠ BREAKING CHANGES

* delegated capabilities required to use `uploadFile`, `uploadDirectory` and `uploadCAR` have changed. In order to use these methods your agent will now need to be delegated `blob/add`, `index/add`, `filecoin/offer` and `upload/add` capabilities. Note: no code changes are required.

### Features

* generate sharded DAG index on client and invoke w `index/add` ([#1451](https://github.com/w3s-project/w3up/issues/1451)) ([a6d9026](https://github.com/w3s-project/w3up/commit/a6d9026536e60c0ce93b613acc6e337f2a21aeb2))

## [14.0.0](https://github.com/w3s-project/w3up/compare/upload-api-v13.0.2...upload-api-v14.0.0) (2024-05-14)


### ⚠ BREAKING CHANGES

* deprecate issuer ([#1344](https://github.com/w3s-project/w3up/issues/1344))

### Features

* add "plan/create-admin-session" capability ([#1411](https://github.com/w3s-project/w3up/issues/1411)) ([50eeeb5](https://github.com/w3s-project/w3up/commit/50eeeb502335ba0413318b5047869a275901824b))
* add blob protocol to upload-client ([#1425](https://github.com/w3s-project/w3up/issues/1425)) ([49aef56](https://github.com/w3s-project/w3up/commit/49aef564a726d34dbbedbd83f5366d9320180f99))
* deprecate issuer ([#1344](https://github.com/w3s-project/w3up/issues/1344)) ([afbbde3](https://github.com/w3s-project/w3up/commit/afbbde340d974792699dc56946cc1c72f74c09e3))
* move blob index logic from upload-api to blob-index lib ([#1434](https://github.com/w3s-project/w3up/issues/1434)) ([797f628](https://github.com/w3s-project/w3up/commit/797f6285c1b000af9eaf0240f85deca6a0b83e06))
* remove issuer row ([#1345](https://github.com/w3s-project/w3up/issues/1345)) ([cf5b0db](https://github.com/w3s-project/w3up/commit/cf5b0db276ffe3b9926dbf1d8e2cd04ef7b607c9))


### Fixes

* `encodeURIComponent` on bucket origin ([#1448](https://github.com/w3s-project/w3up/issues/1448)) ([5618644](https://github.com/w3s-project/w3up/commit/561864422db2ec3eaddc2d790cc4ea0406eebf32))
* add format specifier to blob location claim URL ([#1445](https://github.com/w3s-project/w3up/issues/1445)) ([9982d12](https://github.com/w3s-project/w3up/commit/9982d12b0a1f9a6da3f0d4264b9a35348e189dfb))
* test against actual api ([#1438](https://github.com/w3s-project/w3up/issues/1438)) ([f8132ca](https://github.com/w3s-project/w3up/commit/f8132ca1fced72a4addc7e9f0a2162e823c1ea5f))

## [13.0.2](https://github.com/w3s-project/w3up/compare/upload-api-v13.0.1...upload-api-v13.0.2) (2024-05-02)


### Fixes

* missing test export ([1fc6808](https://github.com/w3s-project/w3up/commit/1fc68087ccca5798cd9c633580025bef034bcadf))

## [13.0.1](https://github.com/w3s-project/w3up/compare/upload-api-v13.0.0...upload-api-v13.0.1) (2024-05-01)


### Fixes

* missing exports ([dec43e5](https://github.com/w3s-project/w3up/commit/dec43e51ee3b22a960a3769537c04f3de55d7097))


### Other Changes

* appease linter ([782c6d0](https://github.com/w3s-project/w3up/commit/782c6d0b3ca93ee801b38126339a262bcd713ede))

## [13.0.0](https://github.com/w3s-project/w3up/compare/upload-api-v12.0.0...upload-api-v13.0.0) (2024-05-01)


### ⚠ BREAKING CHANGES

* add `index/add` handler ([#1421](https://github.com/w3s-project/w3up/issues/1421))

### Features

* add `index/add` handler ([#1421](https://github.com/w3s-project/w3up/issues/1421)) ([cbe9524](https://github.com/w3s-project/w3up/commit/cbe952451b719fe7ae2f7480d26865eca80aba55))

## [12.0.0](https://github.com/w3s-project/w3up/compare/upload-api-v11.0.0...upload-api-v12.0.0) (2024-04-29)


### ⚠ BREAKING CHANGES

* restrict store API to CARs ([#1415](https://github.com/w3s-project/w3up/issues/1415))

### Features

* restrict store API to CARs ([#1415](https://github.com/w3s-project/w3up/issues/1415)) ([e53aa87](https://github.com/w3s-project/w3up/commit/e53aa87780446458ef9a19c88877073c1470d50e))

## [11.0.0](https://github.com/w3s-project/w3up/compare/upload-api-v10.0.1...upload-api-v11.0.0) (2024-04-26)


### ⚠ BREAKING CHANGES

* **capabilities:** `BlobMultihash` type in `@web3-storage/capabilities` renamed to `Multihash`.

### Features

* **capabilities:** add `index/add` capability ([#1410](https://github.com/w3s-project/w3up/issues/1410)) ([1b71b89](https://github.com/w3s-project/w3up/commit/1b71b89ed989cde8ef4bf35c1ebc333872cbc54c))

## [10.0.1](https://github.com/w3s-project/w3up/compare/upload-api-v10.0.0...upload-api-v10.0.1) (2024-04-25)


### Fixes

* add whitespace to trigger a release ([#1390](https://github.com/w3s-project/w3up/issues/1390)) ([ec95a0e](https://github.com/w3s-project/w3up/commit/ec95a0e5cf1bc08c6eabba1214b9803fda723393))
* migrate repo ([#1388](https://github.com/w3s-project/w3up/issues/1388)) ([10b7742](https://github.com/w3s-project/w3up/commit/10b7742d3f568f4b2dc1e2f435916a9e23480952))
* migrate repo ([#1389](https://github.com/w3s-project/w3up/issues/1389)) ([475a287](https://github.com/w3s-project/w3up/commit/475a28743ff9f7138b46dfe4227d3c80ed75a6a2))

## [10.0.0](https://github.com/web3-storage/w3up/compare/upload-api-v9.1.5...upload-api-v10.0.0) (2024-04-23)


### ⚠ BREAKING CHANGES

* allocations storage interface now requires remove to be implemented

### Features

* add blob list and remove ([#1385](https://github.com/web3-storage/w3up/issues/1385)) ([2f69946](https://github.com/web3-storage/w3up/commit/2f6994600e8cc0f70cedc5afe06003a2a0b70af3))

## [9.1.5](https://github.com/web3-storage/w3up/compare/upload-api-v9.1.4...upload-api-v9.1.5) (2024-04-18)


### Fixes

* allocation interface rename invocation to cause ([#1382](https://github.com/web3-storage/w3up/issues/1382)) ([2d13042](https://github.com/web3-storage/w3up/commit/2d1304243c2f21de449090261001a625008c5607))

## [9.1.4](https://github.com/web3-storage/w3up/compare/upload-api-v9.1.3...upload-api-v9.1.4) (2024-04-17)


### Fixes

* ucan conclude scheduler invocation type and improve test ([#1379](https://github.com/web3-storage/w3up/issues/1379)) ([11e0864](https://github.com/web3-storage/w3up/commit/11e0864bfdc49852127d2d55ef08954d775d7901))

## [9.1.3](https://github.com/web3-storage/w3up/compare/upload-api-v9.1.2...upload-api-v9.1.3) (2024-04-16)


### Fixes

* storage operation failed type name instead of store ([#1374](https://github.com/web3-storage/w3up/issues/1374)) ([a99251e](https://github.com/web3-storage/w3up/commit/a99251efc712888bf76270a4fe372163f938eddf))

## [9.1.2](https://github.com/web3-storage/w3up/compare/upload-api-v9.1.1...upload-api-v9.1.2) (2024-04-15)


### Fixes

* export test handlers and storages ([#1370](https://github.com/web3-storage/w3up/issues/1370)) ([61de1e1](https://github.com/web3-storage/w3up/commit/61de1e1eb4d2cee8eaea87913e8fd17ec17f1cd9))

## [9.1.1](https://github.com/web3-storage/w3up/compare/upload-api-v9.1.0...upload-api-v9.1.1) (2024-04-12)


### Fixes

* add errors to exports ([#1368](https://github.com/web3-storage/w3up/issues/1368)) ([27619c5](https://github.com/web3-storage/w3up/commit/27619c517e66321012f1c9ba0d8edb9c0037d6ff))

## [9.1.0](https://github.com/web3-storage/w3up/compare/upload-api-v9.0.1...upload-api-v9.1.0) (2024-04-12)


### Features

* blob, web3.storage and ucan conclude capabilities together with api handlers  ([#1342](https://github.com/web3-storage/w3up/issues/1342)) ([00735a8](https://github.com/web3-storage/w3up/commit/00735a80dfddbe86359af78ed9bd182f4804691f))

## [9.0.1](https://github.com/web3-storage/w3up/compare/upload-api-v9.0.0...upload-api-v9.0.1) (2024-04-12)


### Fixes

* upgrade ucanto libs and format filecoin api ([#1359](https://github.com/web3-storage/w3up/issues/1359)) ([87ca098](https://github.com/web3-storage/w3up/commit/87ca098186fe204ff3409a2684719f1c54148c97))

## [9.0.0](https://github.com/web3-storage/w3up/compare/upload-api-v8.4.1...upload-api-v9.0.0) (2024-03-26)


### ⚠ BREAKING CHANGES

* release upload api with new filecoin api service for storefront ([#1347](https://github.com/web3-storage/w3up/issues/1347))

### Fixes

* release upload api with new filecoin api service for storefront ([#1347](https://github.com/web3-storage/w3up/issues/1347)) ([692751a](https://github.com/web3-storage/w3up/commit/692751aa6a178ede2820990ca9a44118bd6e8e55))

## [8.4.1](https://github.com/web3-storage/w3up/compare/upload-api-v8.4.0...upload-api-v8.4.1) (2024-03-20)


### Fixes

* missing exports ([#1335](https://github.com/web3-storage/w3up/issues/1335)) ([4e41ff4](https://github.com/web3-storage/w3up/commit/4e41ff4498cd75853204d9ae209fe36008cd8018))

## [8.4.0](https://github.com/web3-storage/w3up/compare/upload-api-v8.3.0...upload-api-v8.4.0) (2024-03-20)


### Features

* upgrade ucanto/transport to 9.1.0 in all packages to get more verbose errors from HTTP transport on non-ok response ([#1312](https://github.com/web3-storage/w3up/issues/1312)) ([d6978d7](https://github.com/web3-storage/w3up/commit/d6978d7ab299be76987c6533d18e6857f6998fe6))


### Fixes

* export UsageStorage ([#1334](https://github.com/web3-storage/w3up/issues/1334)) ([d466211](https://github.com/web3-storage/w3up/commit/d466211979e26698755f99daeaed8697c0ee2bdd))

## [8.3.0](https://github.com/web3-storage/w3up/compare/upload-api-v8.2.0...upload-api-v8.3.0) (2024-01-29)


### Features

* two more interface tweaks ([#1287](https://github.com/web3-storage/w3up/issues/1287)) ([bc3c364](https://github.com/web3-storage/w3up/commit/bc3c36452454398ea8e0f574aed44b318561ad94))

## [8.2.0](https://github.com/web3-storage/w3up/compare/upload-api-v8.1.0...upload-api-v8.2.0) (2024-01-29)


### Features

* add `set` method to `AccountPlan` ([#1281](https://github.com/web3-storage/w3up/issues/1281)) ([b94f0d4](https://github.com/web3-storage/w3up/commit/b94f0d48ea71454cef867feb9291c500f676faa3))


### Fixes

* one more tweak to the `PlanStorage` interface ([#1280](https://github.com/web3-storage/w3up/issues/1280)) ([5a44565](https://github.com/web3-storage/w3up/commit/5a44565feb33fc08102cd2559a2f22fb0476e86b))

## [8.1.0](https://github.com/web3-storage/w3up/compare/upload-api-v8.0.0...upload-api-v8.1.0) (2024-01-25)


### Features

* add `initialize` method to `PlansStorage` ([#1278](https://github.com/web3-storage/w3up/issues/1278)) ([6792126](https://github.com/web3-storage/w3up/commit/6792126d63a1e983713c3886eeba64038cb7cf34))
* change `plan/update` to `plan/set` and use existing `PlansStorage#set` to implement an invocation handler ([#1258](https://github.com/web3-storage/w3up/issues/1258)) ([1ccbfe9](https://github.com/web3-storage/w3up/commit/1ccbfe9f84ae5b2e99e315c92d15d2b54e9723ba))

## [8.0.0](https://github.com/web3-storage/w3up/compare/upload-api-v7.3.5...upload-api-v8.0.0) (2023-12-07)


### ⚠ BREAKING CHANGES

* return allocated bytes in `store/add` receipt ([#1213](https://github.com/web3-storage/w3up/issues/1213))

### Features

* return allocated bytes in `store/add` receipt ([#1213](https://github.com/web3-storage/w3up/issues/1213)) ([5d52e44](https://github.com/web3-storage/w3up/commit/5d52e447c14e7f7fd334e7ff575e032b7b0d89d7))

## [7.3.5](https://github.com/web3-storage/w3up/compare/upload-api-v7.3.4...upload-api-v7.3.5) (2023-11-29)


### Fixes

* floating promises and add no-floating-promises to eslint-config-w3up ([#1198](https://github.com/web3-storage/w3up/issues/1198)) ([1b8c5aa](https://github.com/web3-storage/w3up/commit/1b8c5aa86ec3d177bf77df4e2916699c1f522598))

## [7.3.4](https://github.com/web3-storage/w3up/compare/upload-api-v7.3.3...upload-api-v7.3.4) (2023-11-28)


### Fixes

* package metadata ([#1161](https://github.com/web3-storage/w3up/issues/1161)) ([b8a1cc2](https://github.com/web3-storage/w3up/commit/b8a1cc2e125a91be582998bda295e1ae1caab087))

## [7.3.3](https://github.com/web3-storage/w3up/compare/upload-api-v7.3.2...upload-api-v7.3.3) (2023-11-16)


### Bug Fixes

* issue where typedoc docs would only show full docs for w3up-client ([#1141](https://github.com/web3-storage/w3up/issues/1141)) ([0b8d3f3](https://github.com/web3-storage/w3up/commit/0b8d3f3b52918b1b4d3b76ea6fea3fb0c837cd73))
* upgrade @ucanto/validator with bugfix ([#1151](https://github.com/web3-storage/w3up/issues/1151)) ([d4e961b](https://github.com/web3-storage/w3up/commit/d4e961bab09e88245e7d9323146849271e78eb57))

## [7.3.2](https://github.com/web3-storage/w3up/compare/upload-api-v7.3.1...upload-api-v7.3.2) (2023-11-15)


### Bug Fixes

* upgrade ucanto core ([#1127](https://github.com/web3-storage/w3up/issues/1127)) ([5ce4d22](https://github.com/web3-storage/w3up/commit/5ce4d2292d7e980da4a2ea0f1583f608a81157d2))

## [7.3.1](https://github.com/web3-storage/w3up/compare/upload-api-v7.3.0...upload-api-v7.3.1) (2023-11-09)


### Bug Fixes

* trigger release for upload api ([#1107](https://github.com/web3-storage/w3up/issues/1107)) ([9930b10](https://github.com/web3-storage/w3up/commit/9930b10962d365303ae45467a44f414aeac3dccb))

## [7.3.0](https://github.com/web3-storage/w3up/compare/upload-api-v7.2.0...upload-api-v7.3.0) (2023-11-09)


### Features

* add `subscription/list` capability ([#1088](https://github.com/web3-storage/w3up/issues/1088)) ([471d7e5](https://github.com/web3-storage/w3up/commit/471d7e5db24e12a06c1c52ae76bf95ff9471bac8))
* filecoin info ([#1091](https://github.com/web3-storage/w3up/issues/1091)) ([adb2442](https://github.com/web3-storage/w3up/commit/adb24424d1faf50daf2339b77c22fdd44faa236a))


### Bug Fixes

* lint ([#1095](https://github.com/web3-storage/w3up/issues/1095)) ([f9cc770](https://github.com/web3-storage/w3up/commit/f9cc77029d7c0651cb2961d08eca6f94dc1aef6c))

## [7.2.0](https://github.com/web3-storage/w3up/compare/upload-api-v7.1.2...upload-api-v7.2.0) (2023-11-07)


### Features

* add usage/report capability ([#1079](https://github.com/web3-storage/w3up/issues/1079)) ([6418b4b](https://github.com/web3-storage/w3up/commit/6418b4b22329a118fb258928bd9a6a45ced5ce45))
* optionally require plans for provisioning ([#1087](https://github.com/web3-storage/w3up/issues/1087)) ([b24731b](https://github.com/web3-storage/w3up/commit/b24731b0bdde785eef7785468cc1f49b92af2563))

## [7.1.2](https://github.com/web3-storage/w3up/compare/upload-api-v7.1.1...upload-api-v7.1.2) (2023-11-05)


### Bug Fixes

* revert enable storefront signer to be different from main service signer ([#1075](https://github.com/web3-storage/w3up/issues/1075)) ([80cdde0](https://github.com/web3-storage/w3up/commit/80cdde0f5b610cf6328dc17cb505759eddda821a))

## [7.1.1](https://github.com/web3-storage/w3up/compare/upload-api-v7.1.0...upload-api-v7.1.1) (2023-11-04)


### Bug Fixes

* enable storefront signer to be different from main service signer ([#1072](https://github.com/web3-storage/w3up/issues/1072)) ([21ded3c](https://github.com/web3-storage/w3up/commit/21ded3c171ca66480e4f74329943527dcc2bac3e))

## [7.1.0](https://github.com/web3-storage/w3up/compare/upload-api-v7.0.0...upload-api-v7.1.0) (2023-11-03)


### Features

* access agent proofs method would fail to return some session proofs ([#1047](https://github.com/web3-storage/w3up/issues/1047)) ([d23a1c9](https://github.com/web3-storage/w3up/commit/d23a1c972f91b855ee91f862da15bab0e68cca0a))
* expose test context of upload-api ([#1069](https://github.com/web3-storage/w3up/issues/1069)) ([f0757d1](https://github.com/web3-storage/w3up/commit/f0757d15fbe653ae4914960ac401385afd752e57))

## [7.0.0](https://github.com/web3-storage/w3up/compare/upload-api-v6.3.0...upload-api-v7.0.0) (2023-11-01)


### ⚠ BREAKING CHANGES

* add storefront filecoin api to upload api ([#1052](https://github.com/web3-storage/w3up/issues/1052))

### Features

* add storefront filecoin api to upload api ([#1052](https://github.com/web3-storage/w3up/issues/1052)) ([39916c2](https://github.com/web3-storage/w3up/commit/39916c25cbbfce6392fbb7cc71112987185c798c))
* implement `plan/get` capability ([#1005](https://github.com/web3-storage/w3up/issues/1005)) ([f0456d2](https://github.com/web3-storage/w3up/commit/f0456d2e2aab462666810e22abd7dfb7e1ce21be))

## [6.3.0](https://github.com/web3-storage/w3up/compare/upload-api-v6.2.0...upload-api-v6.3.0) (2023-10-25)


### Features

* allow customers to create more than one space ([#989](https://github.com/web3-storage/w3up/issues/989)) ([06e0ca9](https://github.com/web3-storage/w3up/commit/06e0ca9fd3e34104002023f81fc605b666ef9a5b))


### Bug Fixes

* fix arethetypesworking errors in all packages ([#1004](https://github.com/web3-storage/w3up/issues/1004)) ([2e2936a](https://github.com/web3-storage/w3up/commit/2e2936a3831389dd13be5be5146a04e2b15553c5))

## [6.2.0](https://github.com/web3-storage/w3up/compare/upload-api-v6.1.0...upload-api-v6.2.0) (2023-10-20)


### Features

* add `store/get` and `upload/get` capabilities ([#942](https://github.com/web3-storage/w3up/issues/942)) ([40c79eb](https://github.com/web3-storage/w3up/commit/40c79eb8f246775b9e1828240f271fa75ef696be))

## [6.1.0](https://github.com/web3-storage/w3up/compare/upload-api-v6.0.0...upload-api-v6.1.0) (2023-10-19)


### Features

* add revocation to access-client and w3up-client ([#975](https://github.com/web3-storage/w3up/issues/975)) ([6c877aa](https://github.com/web3-storage/w3up/commit/6c877aac78eddb924e999dc3270cba010e48e30a))

## [6.0.0](https://github.com/web3-storage/w3up/compare/upload-api-v5.9.0...upload-api-v6.0.0) (2023-10-13)


### ⚠ BREAKING CHANGES

* Returning the `size` means that we need to fetch the stored item beforehand, and if it does not exist throw a `StoreItemNotFound` error. This is a change from the current behaviour which returns successfully even if the item is not present in the space.

### Features

* add size to `store/remove` receipt ([#969](https://github.com/web3-storage/w3up/issues/969)) ([d2100eb](https://github.com/web3-storage/w3up/commit/d2100eb0ffa5968c326d58d583a258187f9119eb))

## [5.9.0](https://github.com/web3-storage/w3up/compare/upload-api-v5.8.0...upload-api-v5.9.0) (2023-10-10)


### Features

* revocation handler ([#960](https://github.com/web3-storage/w3up/issues/960)) ([91f52c6](https://github.com/web3-storage/w3up/commit/91f52c6d35e4aea2a98c75d8b95ff61cdffac452))
* upgrade to ucanto@9 ([#951](https://github.com/web3-storage/w3up/issues/951)) ([d72faf1](https://github.com/web3-storage/w3up/commit/d72faf1bb07dd11462ae6dff8ee0469f8ae7e9e7))

## [5.8.0](https://github.com/web3-storage/w3up/compare/upload-api-v5.7.0...upload-api-v5.8.0) (2023-10-06)


### Features

* Add basic README to upload-api ([#949](https://github.com/web3-storage/w3up/issues/949)) ([d09db73](https://github.com/web3-storage/w3up/commit/d09db734da5eec55d5a21106fecc07bddd5f14dc))

## [5.7.0](https://github.com/web3-storage/w3up/compare/upload-api-v5.6.0...upload-api-v5.7.0) (2023-10-05)


### Features

* add `RevocationsStorage` ([#941](https://github.com/web3-storage/w3up/issues/941)) ([0069701](https://github.com/web3-storage/w3up/commit/0069701c76eff9ce0ac229658d217dac42d9adc8))

## [5.6.0](https://github.com/web3-storage/w3up/compare/upload-api-v5.5.0...upload-api-v5.6.0) (2023-09-18)


### Features

* rename getCID to inspect ([#931](https://github.com/web3-storage/w3up/issues/931)) ([2f8dbe6](https://github.com/web3-storage/w3up/commit/2f8dbe6bfbfbac2e2f4b8819e5fa91f8141df1bf))

## [5.5.0](https://github.com/web3-storage/w3up/compare/upload-api-v5.4.0...upload-api-v5.5.0) (2023-09-14)


### Features

* reorg tests ([#926](https://github.com/web3-storage/w3up/issues/926)) ([946db3c](https://github.com/web3-storage/w3up/commit/946db3c329c893139ee3e5eac640899796aa307c))

## [5.4.0](https://github.com/web3-storage/w3up/compare/upload-api-v5.3.1...upload-api-v5.4.0) (2023-09-13)


### Features

* implement `admin/upload/inspect` and `admin/store/inspect` capabilities ([#918](https://github.com/web3-storage/w3up/issues/918)) ([5616a12](https://github.com/web3-storage/w3up/commit/5616a12125500a1d5ee41f0504812d82c0451852))

## [5.3.1](https://github.com/web3-storage/w3up/compare/upload-api-v5.3.0...upload-api-v5.3.1) (2023-09-12)


### Bug Fixes

* store add should validate size right away ([#917](https://github.com/web3-storage/w3up/issues/917)) ([2770e6c](https://github.com/web3-storage/w3up/commit/2770e6cfde60236b12d043caa72fd944f6b80918))

## [5.3.0](https://github.com/web3-storage/w3up/compare/upload-api-v5.2.0...upload-api-v5.3.0) (2023-09-05)


### Features

* make agent Service generic ([#875](https://github.com/web3-storage/w3up/issues/875)) ([cdfe36d](https://github.com/web3-storage/w3up/commit/cdfe36dc7298e92066d0454144f598b0e0535b19))


### Bug Fixes

* add a test that exercises ProvisionsStorage#getConsumer ([#893](https://github.com/web3-storage/w3up/issues/893)) ([ed60572](https://github.com/web3-storage/w3up/commit/ed605725a71102b6584bb1c7039ee1a1f50dd7c6))

## [5.2.0](https://github.com/web3-storage/w3up/compare/upload-api-v5.1.0...upload-api-v5.2.0) (2023-08-28)


### Features

* return ID from ProvisionsStorage `put` ([#869](https://github.com/web3-storage/w3up/issues/869)) ([d165c23](https://github.com/web3-storage/w3up/commit/d165c234d8ee6bf0fa31e954b3743d39c6d91699))

## [5.1.0](https://github.com/web3-storage/w3up/compare/upload-api-v5.0.0...upload-api-v5.1.0) (2023-08-22)


### Features

* add providers to space/info ([#862](https://github.com/web3-storage/w3up/issues/862)) ([ac72921](https://github.com/web3-storage/w3up/commit/ac7292177767e6456492200653f0a8b33a4cd98e))
* add subscriptions to CustomerGetSuccess ([#863](https://github.com/web3-storage/w3up/issues/863)) ([dd2e77c](https://github.com/web3-storage/w3up/commit/dd2e77c51d84a517cb50ff05199b8eebf9223bf2))
* change "total" to "limit" ([#867](https://github.com/web3-storage/w3up/issues/867)) ([8295070](https://github.com/web3-storage/w3up/commit/8295070c8fbbc508da2cfe6f32846090a530f282))


### Bug Fixes

* re-enable upload-api tests ([#864](https://github.com/web3-storage/w3up/issues/864)) ([d76a6af](https://github.com/web3-storage/w3up/commit/d76a6af5b48aae60e66f164f61f3c9e010395f29))

## [5.0.0](https://github.com/web3-storage/w3up/compare/upload-api-v4.1.0...upload-api-v5.0.0) (2023-08-09)


### ⚠ BREAKING CHANGES

* introduce new administrative capabilities ([#832](https://github.com/web3-storage/w3up/issues/832))

### Features

* introduce new administrative capabilities ([#832](https://github.com/web3-storage/w3up/issues/832)) ([7b8037a](https://github.com/web3-storage/w3up/commit/7b8037a6ab92f830af4aa7ba07a91bc2a20c0d8c))


### Bug Fixes

* run format for upload-api ([#825](https://github.com/web3-storage/w3up/issues/825)) ([59dc765](https://github.com/web3-storage/w3up/commit/59dc7659a6a19942fad5f73efbed84cc33381314))

## [4.1.0](https://github.com/web3-storage/w3up/compare/upload-api-v4.0.0...upload-api-v4.1.0) (2023-06-20)


### Features

* add failure type to DelegationsStorage#putMany return ([#819](https://github.com/web3-storage/w3up/issues/819)) ([ae7b7c6](https://github.com/web3-storage/w3up/commit/ae7b7c651b57cd514b9429677a420fd14237b8a8))

## [4.0.0](https://github.com/web3-storage/w3up/compare/upload-api-v3.0.0...upload-api-v4.0.0) (2023-06-08)


### ⚠ BREAKING CHANGES

* merge `@web3-storage/access-api` into `@web3-storage/upload-api` ([#790](https://github.com/web3-storage/w3up/issues/790))

### Features

* merge `@web3-storage/access-api` into `@web3-storage/upload-api` ([#790](https://github.com/web3-storage/w3up/issues/790)) ([4f6ddb6](https://github.com/web3-storage/w3up/commit/4f6ddb690c365a42a3dc4c5c6898e4999bd0f868))


### Bug Fixes

* upgrade remaining ucanto deps ([#798](https://github.com/web3-storage/w3up/issues/798)) ([7211501](https://github.com/web3-storage/w3up/commit/72115010663a62140127cdeed21f2dc37f59da08))
* upgrade ucanto to 8 ([#794](https://github.com/web3-storage/w3up/issues/794)) ([00b011d](https://github.com/web3-storage/w3up/commit/00b011d87f628d4b3040398ca6cba567a69713ff))
* use legacy codec on upload api ([#788](https://github.com/web3-storage/w3up/issues/788)) ([1514474](https://github.com/web3-storage/w3up/commit/151447414f79e9df5aba1873b962c9c2efed1935))
* use legacy codec on upload api ([#788](https://github.com/web3-storage/w3up/issues/788)) ([84a4d44](https://github.com/web3-storage/w3up/commit/84a4d440ffa0be1ea4962b32070c12b83cc95562))

## [3.0.0](https://github.com/web3-storage/w3up/compare/upload-api-v2.0.0...upload-api-v3.0.0) (2023-05-03)


### ⚠ BREAKING CHANGES

* upgrade to ucanto7.x.x ([#774](https://github.com/web3-storage/w3up/issues/774))

### Features

* upgrade to ucanto7.x.x ([#774](https://github.com/web3-storage/w3up/issues/774)) ([0cc6e66](https://github.com/web3-storage/w3up/commit/0cc6e66a80476e05c75bea94c1bee9bd12cbacf5))

## [2.0.0](https://github.com/web3-storage/w3protocol/compare/upload-api-v1.0.4...upload-api-v2.0.0) (2023-03-23)


### ⚠ BREAKING CHANGES

* ucan bucket is not part of upload-api but rather ucan-api
* implement new account-based multi-device flow ([#433](https://github.com/web3-storage/w3protocol/issues/433))

### Features

* implement new account-based multi-device flow ([#433](https://github.com/web3-storage/w3protocol/issues/433)) ([1ddc6a0](https://github.com/web3-storage/w3protocol/commit/1ddc6a0c53f8cdb6837a315d8aaf567100dfb8d7))


### Bug Fixes

* remove ucan bucket interface ([#594](https://github.com/web3-storage/w3protocol/issues/594)) ([52cf7c1](https://github.com/web3-storage/w3protocol/commit/52cf7c1f35f01aac66d475d884b87f29348a145c))


### Miscellaneous Chores

* **access-client:** release 11.0.0-rc.0 ([#573](https://github.com/web3-storage/w3protocol/issues/573)) ([be4386d](https://github.com/web3-storage/w3protocol/commit/be4386d66ceea393f289adb3c79273c250542807))

## [1.0.4](https://github.com/web3-storage/w3protocol/compare/upload-api-v1.0.3...upload-api-v1.0.4) (2023-03-08)


### Bug Fixes

* **upload-api:** include test types in the package ([#513](https://github.com/web3-storage/w3protocol/issues/513)) ([0c7a452](https://github.com/web3-storage/w3protocol/commit/0c7a452af99757aa34871c4d5c9d77938934892e))

## [1.0.3](https://github.com/web3-storage/w3protocol/compare/upload-api-v1.0.2...upload-api-v1.0.3) (2023-03-08)


### Bug Fixes

* switch upload-api to node16 ([#509](https://github.com/web3-storage/w3protocol/issues/509)) ([698a033](https://github.com/web3-storage/w3protocol/commit/698a03391221aceb1ce602c407587497d97a77ed))
* types so that w3infra would have been evident ([#507](https://github.com/web3-storage/w3protocol/issues/507)) ([544a838](https://github.com/web3-storage/w3protocol/commit/544a838fa16b316825f69fd95fcb5e35002ac958))

## [1.0.2](https://github.com/web3-storage/w3protocol/compare/upload-api-v1.0.1...upload-api-v1.0.2) (2023-03-08)


### Bug Fixes

* **upload-api:** fix incompatibilities with w3infra ([#504](https://github.com/web3-storage/w3protocol/issues/504)) ([d3dcf34](https://github.com/web3-storage/w3protocol/commit/d3dcf3493030abba62da2e16ffa52107e18d6fa8))

## [1.0.1](https://github.com/web3-storage/w3protocol/compare/upload-api-v1.0.0...upload-api-v1.0.1) (2023-03-08)


### Bug Fixes

* release upload api ([#501](https://github.com/web3-storage/w3protocol/issues/501)) ([23d536a](https://github.com/web3-storage/w3protocol/commit/23d536af6f323311721aecf75ca77b7a19f88643))

## 1.0.0 (2023-03-08)


### Features

* Migrate store/* & upload/* APIs ([#485](https://github.com/web3-storage/w3protocol/issues/485)) ([f0b1e73](https://github.com/web3-storage/w3protocol/commit/f0b1e737f4d2f1689c5da04ad5408b114928d2fe))
* upgrade to new ucanto ([#498](https://github.com/web3-storage/w3protocol/issues/498)) ([dcb41a9](https://github.com/web3-storage/w3protocol/commit/dcb41a9981c2b6bebbdbd29debcad9f510383680))
