:robot: I have created a release *beep* *boop*
---


<details><summary>@leather.io/analytics: 3.21.0</summary>

## [3.21.0](https://github.com/ordpool-space/cat21-wallet/compare/@leather.io/analytics-v3.20.1...@leather.io/analytics-v3.21.0) (2026-06-14)


### Features

* **extension:** deprecation of ordinals and runes ([d6e1fea](https://github.com/ordpool-space/cat21-wallet/commit/d6e1feaccb47de540983c9263cb198f279ed7679))
* **extension:** overhaul collectibles tab with new UI and service integration ([9412c29](https://github.com/ordpool-space/cat21-wallet/commit/9412c2951d423807a44ba4d96c3164f1956472cf))
* other settings pages ([fe93560](https://github.com/ordpool-space/cat21-wallet/commit/fe93560e5d936ba11d9800a3986deea205f6287e))
* updated settings ([af9ddbb](https://github.com/ordpool-space/cat21-wallet/commit/af9ddbb0d2124b87dfcc14efbaf1a33faafd7dee))


### Bug Fixes

* analytics package return values ([04d87af](https://github.com/ordpool-space/cat21-wallet/commit/04d87aff6b381d6388d5ac892cdf1a4db3462c46))
* **extension:** remove recover taproot feature ([145cee5](https://github.com/ordpool-space/cat21-wallet/commit/145cee55d56a20100cb11e8684b33652fd53eb66))
* legacy requests callout / analytics ([236e016](https://github.com/ordpool-space/cat21-wallet/commit/236e01633d5b26871f2d89eeb61ede098d646240))
* remove runes/ordinals pages from services/models ([#2358](https://github.com/ordpool-space/cat21-wallet/issues/2358)) ([101bf28](https://github.com/ordpool-space/cat21-wallet/commit/101bf2808285991f40d93e6eaad00f32c4435675))


### Dependencies

* The following workspace dependencies were updated
  * devDependencies
    * @leather.io/models bumped to 0.57.0
    * @leather.io/test-config bumped to 0.1.4
</details>

<details><summary>@leather.io/bitcoin: 0.38.0</summary>

## [0.38.0](https://github.com/ordpool-space/cat21-wallet/compare/@leather.io/bitcoin-v0.37.7...@leather.io/bitcoin-v0.38.0) (2026-06-14)


### Features

* add withdrawal and fee logic to sbtc swap provider service ([3d277dd](https://github.com/ordpool-space/cat21-wallet/commit/3d277dd8e1f56eae7772b4a042f66288b87101ba))
* auth infrastructure ([#2368](https://github.com/ordpool-space/cat21-wallet/issues/2368)) ([f3d4b3e](https://github.com/ordpool-space/cat21-wallet/commit/f3d4b3e91e86f0d69606c21f67985b3eed762f1f))
* **extension:** implement taproot sends ([c4bfa96](https://github.com/ordpool-space/cat21-wallet/commit/c4bfa960658d29bb0427f756725e87bdf77fd7b7))


### Bug Fixes

* add support for tpubs ([#2381](https://github.com/ordpool-space/cat21-wallet/issues/2381)) ([09d4c94](https://github.com/ordpool-space/cat21-wallet/commit/09d4c944af9b0f74bb15379382d47ad45f11832f))
* add tr related unit tests + fix bug in max send calculation ([852e8a6](https://github.com/ordpool-space/cat21-wallet/commit/852e8a6765fef7cb98014642fa94357e7dbfc1c0))
* change addresses support ([7469bcc](https://github.com/ordpool-space/cat21-wallet/commit/7469bcc3bc4b44bda655c5d86b0a66397aea419b))
* implement wsh signing in signPsbt ([#2374](https://github.com/ordpool-space/cat21-wallet/issues/2374)) ([82f6216](https://github.com/ordpool-space/cat21-wallet/commit/82f621646a4ff619e31090be9eb24ec148866349))
* **mobile:** migrate to correct fingerprint format ([ef15f7a](https://github.com/ordpool-space/cat21-wallet/commit/ef15f7a3f3ea499bf6f1037d147b95c86aef0535))
* remove runes/ordinals pages from services/models ([#2358](https://github.com/ordpool-space/cat21-wallet/issues/2358)) ([101bf28](https://github.com/ordpool-space/cat21-wallet/commit/101bf2808285991f40d93e6eaad00f32c4435675))


### Dependencies

* The following workspace dependencies were updated
  * dependencies
    * @leather.io/constants bumped to 0.37.0
    * @leather.io/crypto bumped to 1.12.24
    * @leather.io/models bumped to 0.57.0
    * @leather.io/utils bumped to 0.52.0
  * devDependencies
    * @leather.io/rpc bumped to 2.23.0
    * @leather.io/test-config bumped to 0.1.4
</details>

<details><summary>@leather.io/cms: 1.7.0</summary>

## [1.7.0](https://github.com/ordpool-space/cat21-wallet/compare/@leather.io/cms-v1.6.1...@leather.io/cms-v1.7.0) (2026-06-14)


### Features

* add breadcrumbs to top header ([46fe4b4](https://github.com/ordpool-space/cat21-wallet/commit/46fe4b493e43471041b1fa0f8fd3f97a8b2e2e2c))
* clean up styles and add search query ([3da2b47](https://github.com/ordpool-space/cat21-wallet/commit/3da2b476d1efd1ad97f22b8e24a33815aa027649))
* **cms:** add fully CMS-driven learn sections ([dc0ed7a](https://github.com/ordpool-space/cat21-wallet/commit/dc0ed7a350d2f4be1f88c9e117531eea00257110))
* **cms:** add GROQ queries for new help center schema ([e497576](https://github.com/ordpool-space/cat21-wallet/commit/e49757611ff4a7a36879eb2d7463e1f31194ef3f))
* **cms:** add help center content migration script ([5c40dc9](https://github.com/ordpool-space/cat21-wallet/commit/5c40dc97a225ca932b06d274f0939fadfa00f638))
* **cms:** add helpCenterCategory Sanity schema type ([56476f6](https://github.com/ordpool-space/cat21-wallet/commit/56476f6888d8c64193a6df6ddce25de23f3c7c8d))
* **cms:** add helpCenterGuide Sanity schema type ([7376a50](https://github.com/ordpool-space/cat21-wallet/commit/7376a50b044360b74c8d40e46d1e6f0b50fc1f1a))
* **mobile:** expo v54 ([50d0f98](https://github.com/ordpool-space/cat21-wallet/commit/50d0f98a39a00986f35193825724e7c80dcb2d94))


### Bug Fixes

* **cms:** filter orphan relatedPosts in migration script ([d4567e8](https://github.com/ordpool-space/cat21-wallet/commit/d4567e80a6480ef99382f0644ad7198ce8aa0ea7))
* ensure related posts are a separate part of post schema ([d26d189](https://github.com/ordpool-space/cat21-wallet/commit/d26d18939eb5a510f7b1bd9e5399a85969d01883))
* remove runes/ordinals pages from services/models ([#2358](https://github.com/ordpool-space/cat21-wallet/issues/2358)) ([101bf28](https://github.com/ordpool-space/cat21-wallet/commit/101bf2808285991f40d93e6eaad00f32c4435675))
</details>

<details><summary>@leather.io/constants: 0.37.0</summary>

## [0.37.0](https://github.com/ordpool-space/cat21-wallet/compare/@leather.io/constants-v0.36.0...@leather.io/constants-v0.37.0) (2026-06-14)


### Features

* **cms:** add fully CMS-driven learn sections ([dc0ed7a](https://github.com/ordpool-space/cat21-wallet/commit/dc0ed7a350d2f4be1f88c9e117531eea00257110))
* **extension:** add aeUSDC retirement callout ([#2336](https://github.com/ordpool-space/cat21-wallet/issues/2336)) ([a2f8423](https://github.com/ordpool-space/cat21-wallet/commit/a2f8423fae4074f952a016b249c291674c7878fa))
* **extension:** overhaul collectibles tab with new UI and empty states ([73e6231](https://github.com/ordpool-space/cat21-wallet/commit/73e623133b5786621a06b83bf099a68f5e3889ef))
* **extension:** overhaul collectibles tab with new UI and service integration ([9412c29](https://github.com/ordpool-space/cat21-wallet/commit/9412c2951d423807a44ba4d96c3164f1956472cf))
* **extension:** usdcx at top of asset list ([59eb61b](https://github.com/ordpool-space/cat21-wallet/commit/59eb61ba95d54440b992b813b0b8e7f95911fe03))
* **mobile:** disable sBTC bridging via LaunchDarkly flag ([2235048](https://github.com/ordpool-space/cat21-wallet/commit/2235048da2bd70046f5e9cce324c7cd6781b38a4))
* **mobile:** get your first nft section ([f5ceaeb](https://github.com/ordpool-space/cat21-wallet/commit/f5ceaeb4eba70b150e27ce8be969502afca16b25))
* **mobile:** learn section ([a56cb7f](https://github.com/ordpool-space/cat21-wallet/commit/a56cb7fedda2c395f2a3c7e2a63fa32819fab740))
* **utils:** add sip10 token name override function ref LEA-3483 ([d650958](https://github.com/ordpool-space/cat21-wallet/commit/d6509588398ac33f02ceb5272c764f6c1fb2c9b2))


### Bug Fixes

* add support for tpubs ([#2381](https://github.com/ordpool-space/cat21-wallet/issues/2381)) ([09d4c94](https://github.com/ordpool-space/cat21-wallet/commit/09d4c944af9b0f74bb15379382d47ad45f11832f))
* integration tests connected to settings ([19b9213](https://github.com/ordpool-space/cat21-wallet/commit/19b92135ac7fce715b96441877301efcb4d0ced9))


### Dependencies

* The following workspace dependencies were updated
  * dependencies
    * @leather.io/models bumped to 0.57.0
</details>

<details><summary>@leather.io/crypto: 1.12.24</summary>

## [1.12.24](https://github.com/ordpool-space/cat21-wallet/compare/@leather.io/crypto-v1.12.23...@leather.io/crypto-v1.12.24) (2026-06-14)


### Bug Fixes

* add support for tpubs ([#2381](https://github.com/ordpool-space/cat21-wallet/issues/2381)) ([09d4c94](https://github.com/ordpool-space/cat21-wallet/commit/09d4c944af9b0f74bb15379382d47ad45f11832f))
* **crypto:** leading zero loss in fingerprint calc ([af18126](https://github.com/ordpool-space/cat21-wallet/commit/af18126bf76f657452539a6d5a6522538d81ce55))
* update redux migrations and secure store migrations. add tests ([726f23a](https://github.com/ordpool-space/cat21-wallet/commit/726f23a5785f2bdfafee890faaa5008ec15b66cb))


### Dependencies

* The following workspace dependencies were updated
  * dependencies
    * @leather.io/constants bumped to 0.37.0
    * @leather.io/utils bumped to 0.52.0
  * devDependencies
    * @leather.io/test-config bumped to 0.1.4
</details>

<details><summary>@leather.io/eslint-config: 0.14.4</summary>

## [0.14.4](https://github.com/ordpool-space/cat21-wallet/compare/@leather.io/eslint-config-v0.14.3...@leather.io/eslint-config-v0.14.4) (2026-06-14)


### Bug Fixes

* enforce dimensions window ([be0a281](https://github.com/ordpool-space/cat21-wallet/commit/be0a2816d5383045045d851c9b7be90432f0554d))
</details>

<details><summary>@leather.io/extension: 6.104.0</summary>

## [6.104.0](https://github.com/ordpool-space/cat21-wallet/compare/@leather.io/extension-v6.103.0...@leather.io/extension-v6.104.0) (2026-06-14)


### Features

* add banners ([245d75f](https://github.com/ordpool-space/cat21-wallet/commit/245d75f017839f7610dbe1fdcf40b7527f690c32))
* **cms:** add fully CMS-driven learn sections ([dc0ed7a](https://github.com/ordpool-space/cat21-wallet/commit/dc0ed7a350d2f4be1f88c9e117531eea00257110))
* enable settings revamp ([406cf48](https://github.com/ordpool-space/cat21-wallet/commit/406cf4800756c8f9d6839af49fbe83d1af733c7d))
* **extension:** add "set to max" to asset balance in swap ([9f90463](https://github.com/ordpool-space/cat21-wallet/commit/9f90463d51137114cab6b285327651aaf75e4dcc))
* **extension:** add `SearchInput` component ([383e949](https://github.com/ordpool-space/cat21-wallet/commit/383e949cca7e90fb647c96ddf294f311abf41404))
* **extension:** add aeUSDC retirement callout ([#2336](https://github.com/ordpool-space/cat21-wallet/issues/2336)) ([a2f8423](https://github.com/ordpool-space/cat21-wallet/commit/a2f8423fae4074f952a016b249c291674c7878fa))
* **extension:** add base asset section to swap form ([4897fee](https://github.com/ordpool-space/cat21-wallet/commit/4897feebc903d3ba68495b11fe93e72ed1dff714))
* **extension:** add collectible details pages and manage inscriptions ([26fc7a9](https://github.com/ordpool-space/cat21-wallet/commit/26fc7a925ec71720735abd9dc9e105472301c777))
* **extension:** add empty and error states to swap review ([d2102cc](https://github.com/ordpool-space/cat21-wallet/commit/d2102cc1fa115564ff686134a5b0d433c71b2daf))
* **extension:** add few attributes to swap amount field ([9f4ca69](https://github.com/ordpool-space/cat21-wallet/commit/9f4ca69559c61ee1ac58aef09b78512b29a37a59))
* **extension:** add flip button to toggle swap assets ([efd69f9](https://github.com/ordpool-space/cat21-wallet/commit/efd69f9d0008330ef8f5e4e9fbf5e66ddce1ef01))
* **extension:** add manage tokens page ([9e16f00](https://github.com/ordpool-space/cat21-wallet/commit/9e16f0034f9afc244362b9fd4f16a1ad4628cf3d))
* **extension:** add quote preview to swap form ([aa72cd2](https://github.com/ordpool-space/cat21-wallet/commit/aa72cd26bf2de87584035fc4f5def272f64f1aa7))
* **extension:** add routing and page header to swap review page ([a98ddef](https://github.com/ordpool-space/cat21-wallet/commit/a98ddef09c62b59eb22477dbefee13d1f993cc6c))
* **extension:** add swap amount field ([5316ce2](https://github.com/ordpool-space/cat21-wallet/commit/5316ce281e6b75184644d8581536c7ca81dda062))
* **extension:** add swap asset selector ([fea3884](https://github.com/ordpool-space/cat21-wallet/commit/fea3884c5077da671c7eae11b57ce6672144f0b7))
* **extension:** add swap review detail rows for account, rate, and min. receive ([edb8771](https://github.com/ordpool-space/cat21-wallet/commit/edb8771eba7f35c1271876ff3f18642ed39d9a02))
* **extension:** add swap review details building blocks ([6acaf25](https://github.com/ordpool-space/cat21-wallet/commit/6acaf258b547861d3a19b835b369e96859a40261))
* **extension:** add swap review price impact and fee rows ([01de174](https://github.com/ordpool-space/cat21-wallet/commit/01de1744e3811c0757c716fc6662b73792b9521b))
* **extension:** add swap review slippage selector ([9f9ae97](https://github.com/ordpool-space/cat21-wallet/commit/9f9ae97f85f770928cdf20bbaf277ff2971b1c65))
* **extension:** add swap review summary section ([3c71a81](https://github.com/ordpool-space/cat21-wallet/commit/3c71a81ba2aef808bc702a3b679d7722f46ede4c))
* **extension:** add swap target amount preview ([22d1cd1](https://github.com/ordpool-space/cat21-wallet/commit/22d1cd190fdde4800f26d105374b131d21561856))
* **extension:** add tooltips for swap review details and fees breakdown ([67cfcba](https://github.com/ordpool-space/cat21-wallet/commit/67cfcbae900178042594b87ea18a5f290d7ca279))
* **extension:** add usdcx balance hook to loader ([38805f9](https://github.com/ordpool-space/cat21-wallet/commit/38805f9485d6d09daeaa2f246bbb67375e45ab91))
* **extension:** add usdcx bridge promo banner ([25aa7e3](https://github.com/ordpool-space/cat21-wallet/commit/25aa7e366f4ab134dd976e65a30f4a3808cb19d3))
* **extension:** adjust the text position in swap currency mode switcher ([9187d63](https://github.com/ordpool-space/cat21-wallet/commit/9187d63ee7a7f0333d935bda3495c827d8fbe75d))
* **extension:** assets ui redesign ([a22fde9](https://github.com/ordpool-space/cat21-wallet/commit/a22fde991f204384ade9d48253c40509ea694556))
* **extension:** deprecation of ordinals and runes ([d6e1fea](https://github.com/ordpool-space/cat21-wallet/commit/d6e1feaccb47de540983c9263cb198f279ed7679))
* **extension:** fade bottom action bar ([065ec91](https://github.com/ordpool-space/cat21-wallet/commit/065ec91a1d52c3cf833b42572eab2c6667bca727))
* **extension:** fee service usage in extension ([f295794](https://github.com/ordpool-space/cat21-wallet/commit/f29579434d4291805dc1010faeac863dcadaaf5f))
* **extension:** first token ([a945df1](https://github.com/ordpool-space/cat21-wallet/commit/a945df1e5bef1f884d3a1c670f7f5485376d6d2b))
* **extension:** fix inconsistent gaps in the swap asset selector list ([f2878b4](https://github.com/ordpool-space/cat21-wallet/commit/f2878b4e846b70c6481c94d17ec4fdd13aa67b78))
* **extension:** implement taproot sends ([c4bfa96](https://github.com/ordpool-space/cat21-wallet/commit/c4bfa960658d29bb0427f756725e87bdf77fd7b7))
* **extension:** implement token details page ([4096727](https://github.com/ordpool-space/cat21-wallet/commit/4096727fa624849cc74425e488c9a494b89c4c2a))
* **extension:** improve ledger arguments ([59d3837](https://github.com/ordpool-space/cat21-wallet/commit/59d383725a6930d4fac92cb2a7dc07b7857d9b8c))
* **extension:** include Bitflow provider config into services setup ([da97df0](https://github.com/ordpool-space/cat21-wallet/commit/da97df0fb8bc7d911534fcca7c041a7a3e31caf3))
* **extension:** maintain amount field focus on currency mode switch ([d4dc5c8](https://github.com/ordpool-space/cat21-wallet/commit/d4dc5c86cb20584cef764f019f385c9dd462fa8e))
* **extension:** make long function argument values expandable values rather than filling the screen ([c67f2de](https://github.com/ordpool-space/cat21-wallet/commit/c67f2ded97a74a1991101d852ea9aedce857919c))
* **extension:** overhaul collectibles tab with new UI and empty states ([73e6231](https://github.com/ordpool-space/cat21-wallet/commit/73e623133b5786621a06b83bf099a68f5e3889ef))
* **extension:** overhaul collectibles tab with new UI and service integration ([9412c29](https://github.com/ordpool-space/cat21-wallet/commit/9412c2951d423807a44ba4d96c3164f1956472cf))
* **extension:** rebrand manifest to Cat21 Wallet, add nativeMessaging permission ([17e479b](https://github.com/ordpool-space/cat21-wallet/commit/17e479bc965db408a91eb5f32f8923f53cab87e2))
* **extension:** remove homeTabsRevamp feature flag and go live ([25ec770](https://github.com/ordpool-space/cat21-wallet/commit/25ec7701b990ddb48c923f57a8e9ba2bbe7e116e))
* **extension:** remove runes and ordinals ([#2343](https://github.com/ordpool-space/cat21-wallet/issues/2343)) ([88d12da](https://github.com/ordpool-space/cat21-wallet/commit/88d12da1389dc241d24753f7f7f230a243b2444b))
* **extension:** support originator post-condition mode ([#2324](https://github.com/ordpool-space/cat21-wallet/issues/2324)) ([6e7d3e1](https://github.com/ordpool-space/cat21-wallet/commit/6e7d3e11b5d18a576c72fe4886f5ead6376d9d16))
* **extension:** swap Leather logo for Cat21 Genesis Cat [#0](https://github.com/ordpool-space/cat21-wallet/issues/0) ([b03d4c0](https://github.com/ordpool-space/cat21-wallet/commit/b03d4c0d37f90690478d275837faf93c8f3027ca))
* **extension:** trending tokens ([f3ec298](https://github.com/ordpool-space/cat21-wallet/commit/f3ec29826661db843dd2dc3e4b57e0acc9dcdbcb))
* **extension:** usdcx at top of asset list ([59eb61b](https://github.com/ordpool-space/cat21-wallet/commit/59eb61ba95d54440b992b813b0b8e7f95911fe03))
* **extension:** wire up SwapProvider ([d52f217](https://github.com/ordpool-space/cat21-wallet/commit/d52f21750601b39aa1197fca939019c452be5193))
* home-overview ([e361021](https://github.com/ordpool-space/cat21-wallet/commit/e3610218ab4f14681eecc8f0dd9ffb76ea54dd7c))
* **mobile:** expo v54 ([50d0f98](https://github.com/ordpool-space/cat21-wallet/commit/50d0f98a39a00986f35193825724e7c80dcb2d94))
* network badge ([7cf9b35](https://github.com/ordpool-space/cat21-wallet/commit/7cf9b352f84d7aafb7c502e015527458e589de6b))
* new action buttons ([6bb4b78](https://github.com/ordpool-space/cat21-wallet/commit/6bb4b78db34f306504762d7b87d5f4a7dde41b8a))
* non-blocking inscription check ([6e08adc](https://github.com/ordpool-space/cat21-wallet/commit/6e08adc6fba9128f0bd2718701a0083fa3718150))
* other settings pages ([fe93560](https://github.com/ordpool-space/cat21-wallet/commit/fe93560e5d936ba11d9800a3986deea205f6287e))
* remove 3rd party ext upload cli ([#2307](https://github.com/ordpool-space/cat21-wallet/issues/2307)) ([3409171](https://github.com/ordpool-space/cat21-wallet/commit/3409171ca9824932ce7555659443e75300b078b9))
* secret key page ([d96ea91](https://github.com/ordpool-space/cat21-wallet/commit/d96ea9160dda0c5b71342c84a6c02e3b0031a4e7))
* updated settings ([af9ddbb](https://github.com/ordpool-space/cat21-wallet/commit/af9ddbb0d2124b87dfcc14efbaf1a33faafd7dee))


### Bug Fixes

* accounts display ([300c929](https://github.com/ordpool-space/cat21-wallet/commit/300c929a3008efa12252caa11f402b3b2ca44f50))
* add support for tpubs ([#2381](https://github.com/ordpool-space/cat21-wallet/issues/2381)) ([09d4c94](https://github.com/ordpool-space/cat21-wallet/commit/09d4c944af9b0f74bb15379382d47ad45f11832f))
* add tr related unit tests + fix bug in max send calculation ([852e8a6](https://github.com/ordpool-space/cat21-wallet/commit/852e8a6765fef7cb98014642fa94357e7dbfc1c0))
* audit axios ([#2362](https://github.com/ordpool-space/cat21-wallet/issues/2362)) ([83e1848](https://github.com/ordpool-space/cat21-wallet/commit/83e1848b6fe5f4ac3d4478090277b3bf032d055b))
* audit cves ([4e54c65](https://github.com/ordpool-space/cat21-wallet/commit/4e54c657a2330652a4ebd8603e1579b2f659a9cc))
* audit deps ([a20e840](https://github.com/ordpool-space/cat21-wallet/commit/a20e840332768b4da14d562c9a0cd4f367d609cd))
* audit react-router ([#2369](https://github.com/ordpool-space/cat21-wallet/issues/2369)) ([80a7ed8](https://github.com/ordpool-space/cat21-wallet/commit/80a7ed886eb9981d85fdfda6736c37f488b37d06))
* axios cve ([b145cd5](https://github.com/ordpool-space/cat21-wallet/commit/b145cd5fd055201b18304b5e2b92635d56086915))
* bitflow mocks ([#2355](https://github.com/ordpool-space/cat21-wallet/issues/2355)) ([be896b5](https://github.com/ordpool-space/cat21-wallet/commit/be896b53cc9e27b777a1b8469b4b966beae175a2))
* build only mobile and related dependencies ([2681dc7](https://github.com/ordpool-space/cat21-wallet/commit/2681dc71a2cbf6b0d732b8dbcf04157478537266))
* change addresses support ([7469bcc](https://github.com/ordpool-space/cat21-wallet/commit/7469bcc3bc4b44bda655c5d86b0a66397aea419b))
* **ci:** decouple mobile build from package lifecycle hooks ([a53e33a](https://github.com/ordpool-space/cat21-wallet/commit/a53e33a6d97c3af8b52a3d4972cd7caadac2edae))
* dep audit ([f0f69d3](https://github.com/ordpool-space/cat21-wallet/commit/f0f69d3b726fc8637ba9b7b69b7bcbf3bb78d244))
* developer notice on legacy requests ([6414b17](https://github.com/ordpool-space/cat21-wallet/commit/6414b1749b6a62789bb62314fb772defbcee7705))
* do not delete client id on sign out ([20f44cd](https://github.com/ordpool-space/cat21-wallet/commit/20f44cdf24d89c13e9dba2b1f0b145a5e9bf6c6f))
* **extension:** activity txs ([4120ae2](https://github.com/ordpool-space/cat21-wallet/commit/4120ae29c6734ad90195eb310d9fb026a26c6631))
* **extension:** add back build script ([fe7fc35](https://github.com/ordpool-space/cat21-wallet/commit/fe7fc354cb37c9c5b38a1b98bcc0228b9d9a3a19))
* **extension:** add border radius to collectibles hover state ([480f77d](https://github.com/ordpool-space/cat21-wallet/commit/480f77db908c0c6ffa84b2aeb7edff76fee7c12c))
* **extension:** add loading="lazy" to collectible images ([8fe4429](https://github.com/ordpool-space/cat21-wallet/commit/8fe4429692d9280db52f16c3b6422bcf0aaa609e))
* **extension:** adds fade in mask to trending tokens ([254c693](https://github.com/ordpool-space/cat21-wallet/commit/254c693739483d5cd974f69b67cd8945e9e98185))
* **extension:** adjust size of collectible chain avatar icon, ref LEA-3414 ([994a23a](https://github.com/ordpool-space/cat21-wallet/commit/994a23a75a4b4d3a07fa6c14d480e8661e2914bb))
* **extension:** bleeding shadows ([f14bd12](https://github.com/ordpool-space/cat21-wallet/commit/f14bd123173f9377eb942de7ec3f03087c51e142))
* **extension:** broken inscrpition discard ([05a0309](https://github.com/ordpool-space/cat21-wallet/commit/05a0309577ccd076f31d14312bf317c3d48d2edd))
* **extension:** broken inscrpition discard ([5ba05bb](https://github.com/ordpool-space/cat21-wallet/commit/5ba05bb4717893b211bd0e49e264023d75ff036d))
* **extension:** catch ledger error ([7fcda54](https://github.com/ordpool-space/cat21-wallet/commit/7fcda54e9d8b437cebe6ad7bde7783aacf208a46))
* **extension:** contract principal support, closes leather-io/extension[#6334](https://github.com/ordpool-space/cat21-wallet/issues/6334) ([b428c1f](https://github.com/ordpool-space/cat21-wallet/commit/b428c1f400df8585772622c2ad195d20d6cad08f))
* **extension:** disable initial animation in flip button ([fb8ec52](https://github.com/ordpool-space/cat21-wallet/commit/fb8ec523418c9733b37234ec1fdabfee809bb1af))
* **extension:** enable account revamp ([9892d06](https://github.com/ordpool-space/cat21-wallet/commit/9892d0634690c023b429f6f4d80cae40571dc67e))
* **extension:** fingerprint not passed to window ([fc62262](https://github.com/ordpool-space/cat21-wallet/commit/fc6226292aea1d7d42856db0523fd2c4add435f4))
* **extension:** fix bug with tab navigation, ref LEA-3334 ([6030950](https://github.com/ordpool-space/cat21-wallet/commit/6030950a3f16616105edc42f45194388d1bc76c0))
* **extension:** fix collectibles hover state overflow ([6d055bf](https://github.com/ordpool-space/cat21-wallet/commit/6d055bf29ef818beb34d18c42701cd340f56d035))
* **extension:** flag token details ([c4cbb48](https://github.com/ordpool-space/cat21-wallet/commit/c4cbb480f384237d051289b24bef57403dc9e684))
* **extension:** flag trending tokens ([1f1054f](https://github.com/ordpool-space/cat21-wallet/commit/1f1054f9f5ef0a0b92c21fe819738603990eb464))
* **extension:** inaccurate total spend ([e5dbd9f](https://github.com/ordpool-space/cat21-wallet/commit/e5dbd9fe2138938825d282012eaa4626fbbd881f))
* **extension:** include protected balance in BTC token details total ([cb90d8f](https://github.com/ordpool-space/cat21-wallet/commit/cb90d8f5665329e9d8da4ef3f4a0dc72bfe02b6a))
* **extension:** incorrect account balance totals ([a299450](https://github.com/ordpool-space/cat21-wallet/commit/a299450ec583a6e7cd82f82ce61e8c0ed57284a5))
* **extension:** insufficient funds ([5508cf9](https://github.com/ordpool-space/cat21-wallet/commit/5508cf99a7347b5d9e982d86001da29ff6f488c1))
* **extension:** ledger chains connection ([be79b57](https://github.com/ordpool-space/cat21-wallet/commit/be79b57a4e5d540ac139c4f2de08aa75767e6513))
* **extension:** ledger contract call should display contract's address ([481900a](https://github.com/ordpool-space/cat21-wallet/commit/481900a1fe3fa474bd380f2e44da6fc73c4a21d7))
* **extension:** maintain focus on amount field after set to max ([1ca5801](https://github.com/ordpool-space/cat21-wallet/commit/1ca5801d51b234166740b72fa79413a6690adf52))
* **extension:** make deposits pressable ([831a1f3](https://github.com/ordpool-space/cat21-wallet/commit/831a1f3c2603ad9422d9bbe9008d72599ce24fa6))
* **extension:** make sure error boundary is centered, ref LEA-2563 ([9506bba](https://github.com/ordpool-space/cat21-wallet/commit/9506bbafcce9a34023f2c0db9c820f5dab409217))
* **extension:** move secret key files ([51fe6dc](https://github.com/ordpool-space/cat21-wallet/commit/51fe6dc871172403291ed5b0331bfd4a8267af34))
* **extension:** nested &lt;button&gt; runtime error ([8c82f9d](https://github.com/ordpool-space/cat21-wallet/commit/8c82f9de821419ee20c9b32d082cb81f17d440e5))
* **extension:** new account becomes active account ([5a4e830](https://github.com/ordpool-space/cat21-wallet/commit/5a4e8305b21447c872dbb19c27df5a7695e190a9))
* **extension:** only auto-focus on amount field when base asset is selected ([045c509](https://github.com/ordpool-space/cat21-wallet/commit/045c509344c83a2b2908a479035947cd661d9cb4))
* **extension:** package advisories ([1515c6c](https://github.com/ordpool-space/cat21-wallet/commit/1515c6c1ce0bd3cf8050dbd585516561f683b9e8))
* **extension:** preserve background location in send inscription flow ([0bb25a2](https://github.com/ordpool-space/cat21-wallet/commit/0bb25a200e9bd3de7718876fa2911c9c977423cf))
* **extension:** prevent runtime destroy error ([d3cb13a](https://github.com/ordpool-space/cat21-wallet/commit/d3cb13a644599ec4a4b261fd76dbf45dd935fe19))
* **extension:** refine collectibles tab typography and spacing ([509e784](https://github.com/ordpool-space/cat21-wallet/commit/509e78416099d4e90f47bb89eacd4abc474ee84a))
* **extension:** refine first token banner typography and spacing ([9cb2b01](https://github.com/ordpool-space/cat21-wallet/commit/9cb2b01977e4f98bf9230989dd23ed6f08d833f1))
* **extension:** refine token list typography, spacing, and hover radius ([05871e1](https://github.com/ordpool-space/cat21-wallet/commit/05871e1686e292760caba72286afd8ecf24781bd))
* **extension:** remove deprecated Lottie lib warning ([5cb0b3f](https://github.com/ordpool-space/cat21-wallet/commit/5cb0b3fdcf28b9ad8db28da0af5cae3ac3b5544a))
* **extension:** remove inscriptions buttons ([c458604](https://github.com/ordpool-space/cat21-wallet/commit/c458604d1e82e665b0be859e2705f5a79318c89d))
* **extension:** remove recover taproot feature ([145cee5](https://github.com/ordpool-space/cat21-wallet/commit/145cee55d56a20100cb11e8684b33652fd53eb66))
* **extension:** remove redundant WebkitMaskImage and fix prettier formatting ([785da18](https://github.com/ordpool-space/cat21-wallet/commit/785da187a4110aac3b66dd69593ac1df5f52d636))
* **extension:** remove uniqueArray dedupe on BitcoinTransactions query for Ledger Stacks only ([74fa211](https://github.com/ordpool-space/cat21-wallet/commit/74fa211d0f4d5e23bdb9b1314972b255fdab3e27))
* **extension:** restore IntersectionObserver lazy rendering for collectible cards ([83a6211](https://github.com/ordpool-space/cat21-wallet/commit/83a6211a1b23ec2a84c730d9cc8c108ee653e18f))
* **extension:** restore pixelated rendering for small collectible images ([bb991b8](https://github.com/ordpool-space/cat21-wallet/commit/bb991b81cd0884a536869bad585ed396bdb63ee0))
* **extension:** restore unprotected label on discarded inscriptions ([c6a719d](https://github.com/ordpool-space/cat21-wallet/commit/c6a719d57e41a18877b27fa97a7af72c2e83123d))
* **extension:** send max ([e307e40](https://github.com/ordpool-space/cat21-wallet/commit/e307e4063d036f6be564f421b230bcb2ee3dd4ea))
* **extension:** show fiat balance for zero balance tokens ([1c8de74](https://github.com/ordpool-space/cat21-wallet/commit/1c8de74bc7861385847db76c88a207d826be82d2))
* **extension:** sip10 send form service usage ([c61d4e5](https://github.com/ordpool-space/cat21-wallet/commit/c61d4e5de382c4a94686ed751120677dc6d44095))
* **extension:** slow refreshes to aid external pkg updates ([be720a1](https://github.com/ordpool-space/cat21-wallet/commit/be720a16ffc141f407a358e999b08d51de2655fc))
* **extension:** sourcemaps ([e094dd0](https://github.com/ordpool-space/cat21-wallet/commit/e094dd0a4467008fb04200381417f4ec50ef65e5))
* **extension:** stop LD warnings when key missing ([13c133e](https://github.com/ordpool-space/cat21-wallet/commit/13c133ec12b8edb8ddccd15d7658452e081369d1))
* **extension:** stop Mixpanel warning when key missing ([3f76a51](https://github.com/ordpool-space/cat21-wallet/commit/3f76a51ec3d1fc37424fe92afab04d55300a0e14))
* **extension:** swap locked balance units in STX asset row ([829a132](https://github.com/ordpool-space/cat21-wallet/commit/829a13231c51be705c5e96528d363b7fbe6491dd))
* **extension:** trending tokens click ([2a07dcc](https://github.com/ordpool-space/cat21-wallet/commit/2a07dcc97c6069c3733b42376556bef361047197))
* **extension:** update collectible design ([30076c3](https://github.com/ordpool-space/cat21-wallet/commit/30076c3616a7feb0cf3998bfc793d24093c4c518))
* **extension:** update collectible design ([be468f1](https://github.com/ordpool-space/cat21-wallet/commit/be468f184f4af48458b35236954026f48e5166c7))
* **extension:** update collectible design ([7902c68](https://github.com/ordpool-space/cat21-wallet/commit/7902c68a97f6883c17b83f0935d125fa227ee78d))
* **extension:** update e2e test for swapped BNS learn link ([ec9be16](https://github.com/ordpool-space/cat21-wallet/commit/ec9be1647891fcd3c0a520a32a02e51665bad80c))
* **extension:** update storybook version ([10f91f4](https://github.com/ordpool-space/cat21-wallet/commit/10f91f4edb59fda19e81b42654083356a33fc2bb))
* **extension:** update token details design ([96026a7](https://github.com/ordpool-space/cat21-wallet/commit/96026a76c550605f92dbab280fd5d27d94794f99))
* **extension:** update trending tokens heading to label.01 ([a852bc1](https://github.com/ordpool-space/cat21-wallet/commit/a852bc17d0a4dd122b65255772aec7ae77a4ede2))
* **extension:** use React Query for text inscription content fetching ([d2ecd5f](https://github.com/ordpool-space/cat21-wallet/commit/d2ecd5fa3cfae7382085a8960b55a5cdfa25b749))
* **extension:** z-stack promo banners ([45a10a9](https://github.com/ordpool-space/cat21-wallet/commit/45a10a9c56e19671c5a77b8d38ae39632f9ce1a6))
* implement wsh signing in signPsbt ([#2374](https://github.com/ordpool-space/cat21-wallet/issues/2374)) ([82f6216](https://github.com/ordpool-space/cat21-wallet/commit/82f621646a4ff619e31090be9eb24ec148866349))
* integration tests connected to settings ([19b9213](https://github.com/ordpool-space/cat21-wallet/commit/19b92135ac7fce715b96441877301efcb4d0ced9))
* ledger btc keychain filtration ([61b40b9](https://github.com/ordpool-space/cat21-wallet/commit/61b40b95fd6e7e7b9a1118185f48a9b6f363c054))
* legacy requests callout / analytics ([236e016](https://github.com/ordpool-space/cat21-wallet/commit/236e01633d5b26871f2d89eeb61ede098d646240))
* make buttons sticky in popup mode ([1786eac](https://github.com/ordpool-space/cat21-wallet/commit/1786eac7eaf69442ffe9d1903b9663f498a95f71))
* **mobile:** refactor avatars + fix regressions to mobile activity ([08465b6](https://github.com/ordpool-space/cat21-wallet/commit/08465b6a972002cc957cbcd9f00b7fd8fdee8cf9))
* more updates for settings revamp ([edb2895](https://github.com/ordpool-space/cat21-wallet/commit/edb289521116b96b46afd733071a16ba8ba7f9b5))
* networks bug ([#2379](https://github.com/ordpool-space/cat21-wallet/issues/2379)) ([01d0c87](https://github.com/ordpool-space/cat21-wallet/commit/01d0c87860b18ff5952cac03a12f42f8f9b9165a))
* only run panda on build, scope EAS postinstall build to mobile only ([29690bf](https://github.com/ordpool-space/cat21-wallet/commit/29690bfe4901fc691cd06d9d4487b585f9c2f60e))
* ordinals/runes fallback ([35d1bea](https://github.com/ordpool-space/cat21-wallet/commit/35d1bea0e3cde0e9ad1e6c77d33793ef48260e3b))
* playwright tests ([eaf96c9](https://github.com/ordpool-space/cat21-wallet/commit/eaf96c9400431c7fbd539b8e5cd7abc86c327f5b))
* point panda to src/preset config as its how we use it mostly ([29690bf](https://github.com/ordpool-space/cat21-wallet/commit/29690bfe4901fc691cd06d9d4487b585f9c2f60e))
* re-add pnpm prepare for web and extension ([29690bf](https://github.com/ordpool-space/cat21-wallet/commit/29690bfe4901fc691cd06d9d4487b585f9c2f60e))
* react router audit ([22190b8](https://github.com/ordpool-space/cat21-wallet/commit/22190b8ee76cbb60ec4d5c64b46dec38d3d6a41a))
* remove runes/ordinals pages from queries ([#2352](https://github.com/ordpool-space/cat21-wallet/issues/2352)) ([22578a1](https://github.com/ordpool-space/cat21-wallet/commit/22578a14ef855040b549e8ec2d39c5f23de3806b))
* remove runes/ordinals pages from services/models ([#2358](https://github.com/ordpool-space/cat21-wallet/issues/2358)) ([101bf28](https://github.com/ordpool-space/cat21-wallet/commit/101bf2808285991f40d93e6eaad00f32c4435675))
* revert modal changes ([68e109f](https://github.com/ordpool-space/cat21-wallet/commit/68e109f2097f9fa8b290dcb265aff65391a46faf))
* rollback build change ([29690bf](https://github.com/ordpool-space/cat21-wallet/commit/29690bfe4901fc691cd06d9d4487b585f9c2f60e))
* taproot rbf ([4628b20](https://github.com/ordpool-space/cat21-wallet/commit/4628b20b2385233791ac58e9afab529a7e6b1358))
* **ui:** package advisories ([61872cf](https://github.com/ordpool-space/cat21-wallet/commit/61872cfeaefcce7b97071ae4d5421ea7a64cb324))
* **ui:** truncate long titles in item layout with ellipsis ([#2360](https://github.com/ordpool-space/cat21-wallet/issues/2360)) ([58cf921](https://github.com/ordpool-space/cat21-wallet/commit/58cf92115f5ccffa6c0bfd847ec85026e85d5880))
* update extension revamp ui for tooltips and spacings ([660f4e4](https://github.com/ordpool-space/cat21-wallet/commit/660f4e431fbf68d4598a750e8f6b5ecd86235725))
* update redux migrations and secure store migrations. add tests ([726f23a](https://github.com/ordpool-space/cat21-wallet/commit/726f23a5785f2bdfafee890faaa5008ec15b66cb))
* update storybook dependancy ([4683726](https://github.com/ordpool-space/cat21-wallet/commit/4683726ada4035dba496d34718593e496716f44f))
* upgrade axios ([#2313](https://github.com/ordpool-space/cat21-wallet/issues/2313)) ([9876bb2](https://github.com/ordpool-space/cat21-wallet/commit/9876bb2a6cc764494fbcf9d57449ce5ccc821ab3))
* use uniqueArray to useQueries and cache nft to avoid duplicate queries ([b391f2b](https://github.com/ordpool-space/cat21-wallet/commit/b391f2bbb52897d6c8fe6d158bd7409ac9213231))
* utxo selection for send transfer + generally use all utxos instead of only ns ([d21f030](https://github.com/ordpool-space/cat21-wallet/commit/d21f030cabd7ec83eba14ac7c9b732d02aa5abef))


### Dependencies

* The following workspace dependencies were updated
  * dependencies
    * @leather.io/analytics bumped to 3.21.0
    * @leather.io/bitcoin bumped to 0.38.0
    * @leather.io/cms bumped to 1.7.0
    * @leather.io/constants bumped to 0.37.0
    * @leather.io/crypto bumped to 1.12.24
    * @leather.io/features bumped to 1.5.0
    * @leather.io/models bumped to 0.57.0
    * @leather.io/provider bumped to 1.6.27
    * @leather.io/queries bumped to 0.11.0
    * @leather.io/query bumped to 2.50.0
    * @leather.io/rpc bumped to 2.23.0
    * @leather.io/services bumped to 1.57.0
    * @leather.io/stacks bumped to 1.21.0
    * @leather.io/tokens bumped to 0.27.0
    * @leather.io/ui bumped to 1.112.0
    * @leather.io/utils bumped to 0.52.0
  * devDependencies
    * @leather.io/panda-preset bumped to 0.17.0
</details>

<details><summary>@leather.io/features: 1.5.0</summary>

## [1.5.0](https://github.com/ordpool-space/cat21-wallet/compare/@leather.io/features-v1.4.5...@leather.io/features-v1.5.0) (2026-06-14)


### Features

* **extension:** add collectible details pages and manage inscriptions ([26fc7a9](https://github.com/ordpool-space/cat21-wallet/commit/26fc7a925ec71720735abd9dc9e105472301c777))
* **extension:** implement token details page ([4096727](https://github.com/ordpool-space/cat21-wallet/commit/4096727fa624849cc74425e488c9a494b89c4c2a))
* **extension:** overhaul collectibles tab with new UI and service integration ([9412c29](https://github.com/ordpool-space/cat21-wallet/commit/9412c2951d423807a44ba4d96c3164f1956472cf))
* **extension:** trending tokens ([f3ec298](https://github.com/ordpool-space/cat21-wallet/commit/f3ec29826661db843dd2dc3e4b57e0acc9dcdbcb))
* **utils:** add sip10 token name override function ref LEA-3483 ([d650958](https://github.com/ordpool-space/cat21-wallet/commit/d6509588398ac33f02ceb5272c764f6c1fb2c9b2))


### Bug Fixes

* add unique identifier for activity keys ([2393dda](https://github.com/ordpool-space/cat21-wallet/commit/2393dda72affdf595c903b911acafc10f6dd1a70))
* include fingerprint in on-chain activity key preventing duplicate keys ([af358e0](https://github.com/ordpool-space/cat21-wallet/commit/af358e03c0883f55bfb897b4e217455629fd14b0))
* **mobile:** refactor avatars + fix regressions to mobile activity ([08465b6](https://github.com/ordpool-space/cat21-wallet/commit/08465b6a972002cc957cbcd9f00b7fd8fdee8cf9))
* playwright tests ([eaf96c9](https://github.com/ordpool-space/cat21-wallet/commit/eaf96c9400431c7fbd539b8e5cd7abc86c327f5b))
* remove runes/ordinals from ui packages ([#2353](https://github.com/ordpool-space/cat21-wallet/issues/2353)) ([709dbb5](https://github.com/ordpool-space/cat21-wallet/commit/709dbb53a38f221b2befc73191e44c952bee4c49))
* remove runes/ordinals pages from services/models ([#2358](https://github.com/ordpool-space/cat21-wallet/issues/2358)) ([101bf28](https://github.com/ordpool-space/cat21-wallet/commit/101bf2808285991f40d93e6eaad00f32c4435675))


### Dependencies

* The following workspace dependencies were updated
  * dependencies
    * @leather.io/constants bumped to 0.37.0
    * @leather.io/models bumped to 0.57.0
    * @leather.io/services bumped to 1.57.0
    * @leather.io/stacks bumped to 1.21.0
    * @leather.io/tokens bumped to 0.27.0
    * @leather.io/utils bumped to 0.52.0
  * devDependencies
    * @leather.io/test-config bumped to 0.1.4
</details>

<details><summary>@leather.io/mobile: 2.109.0</summary>

## [2.109.0](https://github.com/ordpool-space/cat21-wallet/compare/@leather.io/mobile-v2.108.0...@leather.io/mobile-v2.109.0) (2026-06-14)


### Features

* add withdrawal and fee logic to sbtc swap provider service ([3d277dd](https://github.com/ordpool-space/cat21-wallet/commit/3d277dd8e1f56eae7772b4a042f66288b87101ba))
* **cms:** add fully CMS-driven learn sections ([dc0ed7a](https://github.com/ordpool-space/cat21-wallet/commit/dc0ed7a350d2f4be1f88c9e117531eea00257110))
* **extension:** first token ([a945df1](https://github.com/ordpool-space/cat21-wallet/commit/a945df1e5bef1f884d3a1c670f7f5485376d6d2b))
* **extension:** implement taproot sends ([c4bfa96](https://github.com/ordpool-space/cat21-wallet/commit/c4bfa960658d29bb0427f756725e87bdf77fd7b7))
* **extension:** overhaul collectibles tab with new UI and empty states ([73e6231](https://github.com/ordpool-space/cat21-wallet/commit/73e623133b5786621a06b83bf099a68f5e3889ef))
* **extension:** remove homeTabsRevamp feature flag and go live ([25ec770](https://github.com/ordpool-space/cat21-wallet/commit/25ec7701b990ddb48c923f57a8e9ba2bbe7e116e))
* **extension:** support originator post-condition mode ([#2324](https://github.com/ordpool-space/cat21-wallet/issues/2324)) ([6e7d3e1](https://github.com/ordpool-space/cat21-wallet/commit/6e7d3e11b5d18a576c72fe4886f5ead6376d9d16))
* **extension:** trending tokens ([f3ec298](https://github.com/ordpool-space/cat21-wallet/commit/f3ec29826661db843dd2dc3e4b57e0acc9dcdbcb))
* migrate off eas ([#2306](https://github.com/ordpool-space/cat21-wallet/issues/2306)) ([66751ab](https://github.com/ordpool-space/cat21-wallet/commit/66751ab5bea4504021927313185d67848516897a))
* **mobile:** add input readiness flag to swap state ([82b2bc0](https://github.com/ordpool-space/cat21-wallet/commit/82b2bc0431088e5b1a726837adb823755cf88c4b))
* **mobile:** add support for swap execution constraints ([2dcce76](https://github.com/ordpool-space/cat21-wallet/commit/2dcce76ea480391b6122e54d924b250334367682))
* **mobile:** add swap live estimate tests ([04dd110](https://github.com/ordpool-space/cat21-wallet/commit/04dd1102eb99df3855e479a7f5b3a8035f6f049f))
* **mobile:** disable sBTC bridging via LaunchDarkly flag ([2235048](https://github.com/ordpool-space/cat21-wallet/commit/2235048da2bd70046f5e9cce324c7cd6781b38a4))
* **mobile:** expo v54 ([50d0f98](https://github.com/ordpool-space/cat21-wallet/commit/50d0f98a39a00986f35193825724e7c80dcb2d94))
* **mobile:** first token ([0a9514c](https://github.com/ordpool-space/cat21-wallet/commit/0a9514c60936f793b4a090eb7817e43561afa2bf))
* **mobile:** get your first nft section ([f5ceaeb](https://github.com/ordpool-space/cat21-wallet/commit/f5ceaeb4eba70b150e27ce8be969502afca16b25))
* **mobile:** improve target asset display ordering swap ([f6d7723](https://github.com/ordpool-space/cat21-wallet/commit/f6d7723e0980a8d5ba07b2357090df950857a8d4))
* **mobile:** integrate spendable amount query into swap state and readiness checks ([8097563](https://github.com/ordpool-space/cat21-wallet/commit/8097563b1d8f02d60b7c957e1dd27cd019f19720))
* **mobile:** learn section ([a56cb7f](https://github.com/ordpool-space/cat21-wallet/commit/a56cb7fedda2c395f2a3c7e2a63fa32819fab740))
* **mobile:** ordinals feature flag ([#2320](https://github.com/ordpool-space/cat21-wallet/issues/2320)) ([0dc1bc3](https://github.com/ordpool-space/cat21-wallet/commit/0dc1bc3d970ae1db80624585f5a4c58a9b0aff5d))
* **mobile:** remove runes/ordinals ([#2347](https://github.com/ordpool-space/cat21-wallet/issues/2347)) ([1f8437b](https://github.com/ordpool-space/cat21-wallet/commit/1f8437b44f2bb26f047c5fc0a679d92ee7ebebb8))
* **mobile:** trending tokens ([d321fc5](https://github.com/ordpool-space/cat21-wallet/commit/d321fc529f0802f06fa6c2d68ad48606dcba88bc))
* **mobile:** update enriched swap quotes with new fields ([0346010](https://github.com/ordpool-space/cat21-wallet/commit/0346010cd9e9e001eaa6fd142cd6e8fc12c7ad1e))
* **services:** integrate bitflow bff api ([8256079](https://github.com/ordpool-space/cat21-wallet/commit/8256079c4b1c5760fbaa51f978cdabf8817a0e0a))
* **web:** Leather Multisig UI (initial import, behind multisigEnabled flag) ([#2365](https://github.com/ordpool-space/cat21-wallet/issues/2365)) ([872827d](https://github.com/ordpool-space/cat21-wallet/commit/872827d28f3f848595958f197df22df6b580dd81))


### Bug Fixes

* 16kb memory ([47ea4e4](https://github.com/ordpool-space/cat21-wallet/commit/47ea4e4becd5cd51cde3d095c3d7e624bf0cb112))
* android version code ([#2309](https://github.com/ordpool-space/cat21-wallet/issues/2309)) ([283432b](https://github.com/ordpool-space/cat21-wallet/commit/283432bba7b74295c180e6a852909f930b4ed4e6))
* audit axios ([#2362](https://github.com/ordpool-space/cat21-wallet/issues/2362)) ([83e1848](https://github.com/ordpool-space/cat21-wallet/commit/83e1848b6fe5f4ac3d4478090277b3bf032d055b))
* axios cve ([b145cd5](https://github.com/ordpool-space/cat21-wallet/commit/b145cd5fd055201b18304b5e2b92635d56086915))
* build only mobile and related dependencies ([2681dc7](https://github.com/ordpool-space/cat21-wallet/commit/2681dc71a2cbf6b0d732b8dbcf04157478537266))
* **ci:** decouple mobile build from package lifecycle hooks ([a53e33a](https://github.com/ordpool-space/cat21-wallet/commit/a53e33a6d97c3af8b52a3d4972cd7caadac2edae))
* **ci:** let sentry fail in mobile CI to reduce flakiness ([4a6fb5b](https://github.com/ordpool-space/cat21-wallet/commit/4a6fb5b3758e9d26bf330072c5ff3dc83b0c3563))
* **ci:** reduce noise in fingerprints ([9b22cfd](https://github.com/ordpool-space/cat21-wallet/commit/9b22cfddbeae957b8f7bbcc7a1f387ebdb1186cc))
* dep audit ([f0f69d3](https://github.com/ordpool-space/cat21-wallet/commit/f0f69d3b726fc8637ba9b7b69b7bcbf3bb78d244))
* do not open asset details in send flow ([f930fb6](https://github.com/ordpool-space/cat21-wallet/commit/f930fb650e12c5222ffd65feb17c73b365ba2d19))
* enforce dimensions window ([be0a281](https://github.com/ordpool-space/cat21-wallet/commit/be0a2816d5383045045d851c9b7be90432f0554d))
* **extension:** incorrect account balance totals ([a299450](https://github.com/ordpool-space/cat21-wallet/commit/a299450ec583a6e7cd82f82ce61e8c0ed57284a5))
* givc usdcx priority in mobile and show in empty wallets ([22d5673](https://github.com/ordpool-space/cat21-wallet/commit/22d5673f2f71665fd3346551c6224fa2f64641a3))
* icons sheet performance ([6bc4ee4](https://github.com/ordpool-space/cat21-wallet/commit/6bc4ee4013eaeff430551e6666ba78989da17762))
* include fingerprint in on-chain activity key preventing duplicate keys ([af358e0](https://github.com/ordpool-space/cat21-wallet/commit/af358e03c0883f55bfb897b4e217455629fd14b0))
* ios team id ([#2310](https://github.com/ordpool-space/cat21-wallet/issues/2310)) ([3d40cf8](https://github.com/ordpool-space/cat21-wallet/commit/3d40cf8df8ec7aea38d36f348ccdcadbf3982215))
* menu items ([c90004d](https://github.com/ordpool-space/cat21-wallet/commit/c90004d37faa67cf7ed1bd2dc82816b2d905d04f))
* mobile release ([#2308](https://github.com/ordpool-space/cat21-wallet/issues/2308)) ([c973d9a](https://github.com/ordpool-space/cat21-wallet/commit/c973d9aef60ee2eaa84710ac204e5106a52f5843))
* **mobile:** account selector list ([0a0cd66](https://github.com/ordpool-space/cat21-wallet/commit/0a0cd66129a15c089e1258cca9a6b3074266e84c))
* **mobile:** add sBTC bridging flag in Bitcoin token details ([466723e](https://github.com/ordpool-space/cat21-wallet/commit/466723e3cce622bb5aa9b00d1a5ce6d1fab407f1))
* **mobile:** adjust SkeletonLoader height for total balance ([b33fc95](https://github.com/ordpool-space/cat21-wallet/commit/b33fc9531a181b11d9d901d1788acdeaa7d081a4))
* **mobile:** bump expo module version for build compatiblity ([540dc4a](https://github.com/ordpool-space/cat21-wallet/commit/540dc4af5db66ca662530f5b5ab2aa8e649a8cf2))
* **mobile:** display of taproot sends ([741d133](https://github.com/ordpool-space/cat21-wallet/commit/741d1330ccced495da361c93dac0c93c34b5abc9))
* **mobile:** fix Lottie animation BG colour mismatch, ref LEA-3367 ([1394124](https://github.com/ordpool-space/cat21-wallet/commit/1394124e02ca8cc338891b0ba9a9ab29eca42d80))
* **mobile:** fix status bar color ([d5edeaf](https://github.com/ordpool-space/cat21-wallet/commit/d5edeafe7a612f95647525514a9ea92053c2932b))
* **mobile:** help header ([764af25](https://github.com/ordpool-space/cat21-wallet/commit/764af257655ecb585d6805c5350c3d5fffe7a56a))
* **mobile:** make sure lottie animations stay synced with tokens, ref LEA-3367 ([dde15ed](https://github.com/ordpool-space/cat21-wallet/commit/dde15ed5ab3028cb879b516608f0563ffcbc9bd3))
* **mobile:** make sure secret key copy button is visible on small screens ([c2c9359](https://github.com/ordpool-space/cat21-wallet/commit/c2c9359c477c3272347a7f2f7df930bd8cc543ad))
* **mobile:** migrate to correct fingerprint format ([ef15f7a](https://github.com/ordpool-space/cat21-wallet/commit/ef15f7a3f3ea499bf6f1037d147b95c86aef0535))
* **mobile:** migration to v2 for older versions ([51ff2b9](https://github.com/ordpool-space/cat21-wallet/commit/51ff2b95aeaf7924d8b572a0983cc849a518e23d))
* **mobile:** package advisories ([50fb598](https://github.com/ordpool-space/cat21-wallet/commit/50fb5984f9e9c3e0a1dbd3e7f2b2bcd8083e88e4))
* **mobile:** refactor avatars + fix regressions to mobile activity ([08465b6](https://github.com/ordpool-space/cat21-wallet/commit/08465b6a972002cc957cbcd9f00b7fd8fdee8cf9))
* **mobile:** remove deep linking ([#2349](https://github.com/ordpool-space/cat21-wallet/issues/2349)) ([6d8d5f5](https://github.com/ordpool-space/cat21-wallet/commit/6d8d5f5b0e92323ce36ce0cf32bd8d867ad290d4))
* **mobile:** remove firebase-tools ([cbbddcc](https://github.com/ordpool-space/cat21-wallet/commit/cbbddccf0666df6e5b49f36d7708c3bcea833a6c))
* **mobile:** remove mobile runes/stamps ([#2288](https://github.com/ordpool-space/cat21-wallet/issues/2288)) ([66a4584](https://github.com/ordpool-space/cat21-wallet/commit/66a4584ca0abeb5e6413a0c225447fad144bfe8c))
* **mobile:** remove token details flag ([7ca9251](https://github.com/ordpool-space/cat21-wallet/commit/7ca92510f12da9c8b13084c583e42ac6c1b2dacd))
* **mobile:** show token loading state for btc/stx token details pages ([1466ca8](https://github.com/ordpool-space/cat21-wallet/commit/1466ca8670b4fa3b34b3c2e31b68b930518eb25f))
* **mobile:** skip prepare scripts during EAS build ([0ce669f](https://github.com/ordpool-space/cat21-wallet/commit/0ce669fc6b22712ee510efbc066d78fa00d08699))
* **mobile:** use correct size for receive screen asset avatar ([62f7148](https://github.com/ordpool-space/cat21-wallet/commit/62f7148f949c527c11c6aa381e8617603ceddd8c))
* **mobile:** wallet state not rehydrating after dev reload ([145d4c3](https://github.com/ordpool-space/cat21-wallet/commit/145d4c3a45488520161c4f58eb06296e1ab31071))
* networks bug ([#2379](https://github.com/ordpool-space/cat21-wallet/issues/2379)) ([01d0c87](https://github.com/ordpool-space/cat21-wallet/commit/01d0c87860b18ff5952cac03a12f42f8f9b9165a))
* remove premature error in getMnemonic function ([0655589](https://github.com/ordpool-space/cat21-wallet/commit/06555892fb28e46f3165d685b780a75d441cb7a2))
* remove runes/ordinals pages from queries ([#2352](https://github.com/ordpool-space/cat21-wallet/issues/2352)) ([22578a1](https://github.com/ordpool-space/cat21-wallet/commit/22578a14ef855040b549e8ec2d39c5f23de3806b))
* remove runes/ordinals pages from services/models ([#2358](https://github.com/ordpool-space/cat21-wallet/issues/2358)) ([101bf28](https://github.com/ordpool-space/cat21-wallet/commit/101bf2808285991f40d93e6eaad00f32c4435675))
* update redux migrations and secure store migrations. add tests ([726f23a](https://github.com/ordpool-space/cat21-wallet/commit/726f23a5785f2bdfafee890faaa5008ec15b66cb))
* upgrade axios ([#2313](https://github.com/ordpool-space/cat21-wallet/issues/2313)) ([9876bb2](https://github.com/ordpool-space/cat21-wallet/commit/9876bb2a6cc764494fbcf9d57449ce5ccc821ab3))
* use Screen.List for consistent rendering of activity list ([4c21512](https://github.com/ordpool-space/cat21-wallet/commit/4c2151276f33c996bd99cc5ee9278a547d918e0f))
* use uniqueArray to useQueries and cache nft to avoid duplicate queries ([b391f2b](https://github.com/ordpool-space/cat21-wallet/commit/b391f2bbb52897d6c8fe6d158bd7409ac9213231))
* wallet deletion ([58d7e29](https://github.com/ordpool-space/cat21-wallet/commit/58d7e2998587aa5a499e9e4410599d03856a89a8))


### Dependencies

* The following workspace dependencies were updated
  * dependencies
    * @leather.io/analytics bumped to 3.21.0
    * @leather.io/bitcoin bumped to 0.38.0
    * @leather.io/cms bumped to 1.7.0
    * @leather.io/constants bumped to 0.37.0
    * @leather.io/crypto bumped to 1.12.24
    * @leather.io/features bumped to 1.5.0
    * @leather.io/models bumped to 0.57.0
    * @leather.io/provider bumped to 1.6.27
    * @leather.io/queries bumped to 0.11.0
    * @leather.io/query bumped to 2.50.0
    * @leather.io/rpc bumped to 2.23.0
    * @leather.io/services bumped to 1.57.0
    * @leather.io/stacks bumped to 1.21.0
    * @leather.io/ui bumped to 1.112.0
    * @leather.io/utils bumped to 0.52.0
  * devDependencies
    * @leather.io/test-config bumped to 0.1.4
</details>

<details><summary>@leather.io/models: 0.57.0</summary>

## [0.57.0](https://github.com/ordpool-space/cat21-wallet/compare/@leather.io/models-v0.56.1...@leather.io/models-v0.57.0) (2026-06-14)


### Features

* add withdrawal and fee logic to sbtc swap provider service ([3d277dd](https://github.com/ordpool-space/cat21-wallet/commit/3d277dd8e1f56eae7772b4a042f66288b87101ba))
* adds market stats and token analytics services ([b5c47ae](https://github.com/ordpool-space/cat21-wallet/commit/b5c47ae2401e3e1431343a11cd8398e7a5c1bc6b))
* auth infrastructure ([#2368](https://github.com/ordpool-space/cat21-wallet/issues/2368)) ([f3d4b3e](https://github.com/ordpool-space/cat21-wallet/commit/f3d4b3e91e86f0d69606c21f67985b3eed762f1f))
* **extension:** fee service usage in extension ([f295794](https://github.com/ordpool-space/cat21-wallet/commit/f29579434d4291805dc1010faeac863dcadaaf5f))
* **models,services:** unify SwapDex and YieldProvider into StacksProtocol model ([0d7f44c](https://github.com/ordpool-space/cat21-wallet/commit/0d7f44cb2961c57aa0730066b39697e5ab7ca632))
* **services:** activity v2 ([ae29c23](https://github.com/ordpool-space/cat21-wallet/commit/ae29c23a6001bffc5ab81c89400e2d9768930478))
* **services:** integrate bitflow bff api ([8256079](https://github.com/ordpool-space/cat21-wallet/commit/8256079c4b1c5760fbaa51f978cdabf8817a0e0a))
* **services:** multisig service vaults ([#2378](https://github.com/ordpool-space/cat21-wallet/issues/2378)) ([4351c6c](https://github.com/ordpool-space/cat21-wallet/commit/4351c6c26b256fd4007d70020bc588bf109f7b89))


### Bug Fixes

* remove runes/ordinals pages from services/models ([#2358](https://github.com/ordpool-space/cat21-wallet/issues/2358)) ([101bf28](https://github.com/ordpool-space/cat21-wallet/commit/101bf2808285991f40d93e6eaad00f32c4435675))
</details>

<details><summary>@leather.io/panda-preset: 0.17.0</summary>

## [0.17.0](https://github.com/ordpool-space/cat21-wallet/compare/@leather.io/panda-preset-v0.16.2...@leather.io/panda-preset-v0.17.0) (2026-06-14)


### Features

* **extension:** fade bottom action bar ([065ec91](https://github.com/ordpool-space/cat21-wallet/commit/065ec91a1d52c3cf833b42572eab2c6667bca727))
* secret key page ([d96ea91](https://github.com/ordpool-space/cat21-wallet/commit/d96ea9160dda0c5b71342c84a6c02e3b0031a4e7))
* updated settings ([af9ddbb](https://github.com/ordpool-space/cat21-wallet/commit/af9ddbb0d2124b87dfcc14efbaf1a33faafd7dee))


### Bug Fixes

* **ci:** decouple mobile build from package lifecycle hooks ([a53e33a](https://github.com/ordpool-space/cat21-wallet/commit/a53e33a6d97c3af8b52a3d4972cd7caadac2edae))
* **mobile:** skip prepare scripts during EAS build ([0ce669f](https://github.com/ordpool-space/cat21-wallet/commit/0ce669fc6b22712ee510efbc066d78fa00d08699))
* only run panda on build, scope EAS postinstall build to mobile only ([29690bf](https://github.com/ordpool-space/cat21-wallet/commit/29690bfe4901fc691cd06d9d4487b585f9c2f60e))
* **panda-preset:** resolve tokens import during EAS build ([ebabad1](https://github.com/ordpool-space/cat21-wallet/commit/ebabad12cbbb1ee2d481e52533d5c9eb30c67f28))
* point panda to src/preset config as its how we use it mostly ([29690bf](https://github.com/ordpool-space/cat21-wallet/commit/29690bfe4901fc691cd06d9d4487b585f9c2f60e))
* re-add pnpm prepare for web and extension ([29690bf](https://github.com/ordpool-space/cat21-wallet/commit/29690bfe4901fc691cd06d9d4487b585f9c2f60e))
* rollback build change ([29690bf](https://github.com/ordpool-space/cat21-wallet/commit/29690bfe4901fc691cd06d9d4487b585f9c2f60e))


### Dependencies

* The following workspace dependencies were updated
  * devDependencies
    * @leather.io/tokens bumped to 0.27.0
</details>

<details><summary>@leather.io/provider: 1.6.27</summary>

## [1.6.27](https://github.com/ordpool-space/cat21-wallet/compare/@leather.io/provider-v1.6.26...@leather.io/provider-v1.6.27) (2026-06-14)


### Bug Fixes

* **mobile:** injected provider. add tests ([90c66bb](https://github.com/ordpool-space/cat21-wallet/commit/90c66bb99c6704e4d3d77e7aa4663d9e53949446))


### Dependencies

* The following workspace dependencies were updated
  * dependencies
    * @leather.io/rpc bumped to 2.23.0
  * devDependencies
    * @leather.io/test-config bumped to 0.1.4
</details>

<details><summary>@leather.io/queries: 0.11.0</summary>

## [0.11.0](https://github.com/ordpool-space/cat21-wallet/compare/@leather.io/queries-v0.10.1...@leather.io/queries-v0.11.0) (2026-06-14)


### Features

* adds market stats and token analytics services ([b5c47ae](https://github.com/ordpool-space/cat21-wallet/commit/b5c47ae2401e3e1431343a11cd8398e7a5c1bc6b))
* asset-list service ([c4dcb11](https://github.com/ordpool-space/cat21-wallet/commit/c4dcb11d79fdaf318dade7d7f52ca81d2c33ecf0))
* **cms:** add fully CMS-driven learn sections ([dc0ed7a](https://github.com/ordpool-space/cat21-wallet/commit/dc0ed7a350d2f4be1f88c9e117531eea00257110))
* **extension:** add usdcx balance hook to loader ([38805f9](https://github.com/ordpool-space/cat21-wallet/commit/38805f9485d6d09daeaa2f246bbb67375e45ab91))
* **extension:** fee service usage in extension ([f295794](https://github.com/ordpool-space/cat21-wallet/commit/f29579434d4291805dc1010faeac863dcadaaf5f))
* **extension:** support originator post-condition mode ([#2324](https://github.com/ordpool-space/cat21-wallet/issues/2324)) ([6e7d3e1](https://github.com/ordpool-space/cat21-wallet/commit/6e7d3e11b5d18a576c72fe4886f5ead6376d9d16))
* **services:** activity v2 ([ae29c23](https://github.com/ordpool-space/cat21-wallet/commit/ae29c23a6001bffc5ab81c89400e2d9768930478))
* update query layer for collectibles and add shared utilities ([a7c9046](https://github.com/ordpool-space/cat21-wallet/commit/a7c904652b8ec7f61cef415dee4b84a27db52c55))


### Bug Fixes

* **extension:** incorrect account balance totals ([a299450](https://github.com/ordpool-space/cat21-wallet/commit/a299450ec583a6e7cd82f82ce61e8c0ed57284a5))
* **extension:** sip10 send form service usage ([c61d4e5](https://github.com/ordpool-space/cat21-wallet/commit/c61d4e5de382c4a94686ed751120677dc6d44095))
* remove runes/ordinals pages from queries ([#2352](https://github.com/ordpool-space/cat21-wallet/issues/2352)) ([22578a1](https://github.com/ordpool-space/cat21-wallet/commit/22578a14ef855040b549e8ec2d39c5f23de3806b))


### Dependencies

* The following workspace dependencies were updated
  * dependencies
    * @leather.io/cms bumped to 1.7.0
    * @leather.io/models bumped to 0.57.0
    * @leather.io/services bumped to 1.57.0
    * @leather.io/utils bumped to 0.52.0
</details>

<details><summary>@leather.io/query: 2.50.0</summary>

## [2.50.0](https://github.com/ordpool-space/cat21-wallet/compare/@leather.io/query-v2.49.0...@leather.io/query-v2.50.0) (2026-06-14)


### Features

* add fallback responses to all bis client calls ([c81750e](https://github.com/ordpool-space/cat21-wallet/commit/c81750ee967704794efdae276f9bd3e31af50941))
* **extension:** remove runes and ordinals ([#2343](https://github.com/ordpool-space/cat21-wallet/issues/2343)) ([88d12da](https://github.com/ordpool-space/cat21-wallet/commit/88d12da1389dc241d24753f7f7f230a243b2444b))
* **extension:** support originator post-condition mode ([#2324](https://github.com/ordpool-space/cat21-wallet/issues/2324)) ([6e7d3e1](https://github.com/ordpool-space/cat21-wallet/commit/6e7d3e11b5d18a576c72fe4886f5ead6376d9d16))
* **utils:** add sip10 token name override function ref LEA-3483 ([d650958](https://github.com/ordpool-space/cat21-wallet/commit/d6509588398ac33f02ceb5272c764f6c1fb2c9b2))


### Bug Fixes

* audit axios ([#2362](https://github.com/ordpool-space/cat21-wallet/issues/2362)) ([83e1848](https://github.com/ordpool-space/cat21-wallet/commit/83e1848b6fe5f4ac3d4478090277b3bf032d055b))
* axios cve ([b145cd5](https://github.com/ordpool-space/cat21-wallet/commit/b145cd5fd055201b18304b5e2b92635d56086915))
* dep audit ([f0f69d3](https://github.com/ordpool-space/cat21-wallet/commit/f0f69d3b726fc8637ba9b7b69b7bcbf3bb78d244))
* networks bug ([#2379](https://github.com/ordpool-space/cat21-wallet/issues/2379)) ([01d0c87](https://github.com/ordpool-space/cat21-wallet/commit/01d0c87860b18ff5952cac03a12f42f8f9b9165a))
* ordinals/runes fallback ([35d1bea](https://github.com/ordpool-space/cat21-wallet/commit/35d1bea0e3cde0e9ad1e6c77d33793ef48260e3b))
* prevent calls to .../addresses//balances/ft if no address ([20b6ff7](https://github.com/ordpool-space/cat21-wallet/commit/20b6ff7116c85d7c2beb45d515b8ec1b889e6e54))
* **query:** do not retry unreliable stx20 api ([18b9f84](https://github.com/ordpool-space/cat21-wallet/commit/18b9f84524b7ad9fc3896af4bf70598e7be99e76))
* remove runes/ordinals pages from queries ([#2352](https://github.com/ordpool-space/cat21-wallet/issues/2352)) ([22578a1](https://github.com/ordpool-space/cat21-wallet/commit/22578a14ef855040b549e8ec2d39c5f23de3806b))
* upgrade axios ([#2313](https://github.com/ordpool-space/cat21-wallet/issues/2313)) ([9876bb2](https://github.com/ordpool-space/cat21-wallet/commit/9876bb2a6cc764494fbcf9d57449ce5ccc821ab3))


### Dependencies

* The following workspace dependencies were updated
  * dependencies
    * @leather.io/bitcoin bumped to 0.38.0
    * @leather.io/constants bumped to 0.37.0
    * @leather.io/models bumped to 0.57.0
    * @leather.io/stacks bumped to 1.21.0
    * @leather.io/utils bumped to 0.52.0
</details>

<details><summary>@leather.io/rpc: 2.23.0</summary>

## [2.23.0](https://github.com/ordpool-space/cat21-wallet/compare/@leather.io/rpc-v2.22.1...@leather.io/rpc-v2.23.0) (2026-06-14)


### Features

* **extension:** support originator post-condition mode ([#2324](https://github.com/ordpool-space/cat21-wallet/issues/2324)) ([6e7d3e1](https://github.com/ordpool-space/cat21-wallet/commit/6e7d3e11b5d18a576c72fe4886f5ead6376d9d16))


### Bug Fixes

* implement wsh signing in signPsbt ([#2374](https://github.com/ordpool-space/cat21-wallet/issues/2374)) ([82f6216](https://github.com/ordpool-space/cat21-wallet/commit/82f621646a4ff619e31090be9eb24ec148866349))


### Dependencies

* The following workspace dependencies were updated
  * dependencies
    * @leather.io/models bumped to 0.57.0
    * @leather.io/stacks bumped to 1.21.0
    * @leather.io/utils bumped to 0.52.0
  * devDependencies
    * @leather.io/test-config bumped to 0.1.4
</details>

<details><summary>@leather.io/sdk: 1.5.45</summary>

## [1.5.45](https://github.com/ordpool-space/cat21-wallet/compare/@leather.io/sdk-v1.5.44...@leather.io/sdk-v1.5.45) (2026-06-14)


### Dependencies

* The following workspace dependencies were updated
  * dependencies
    * @leather.io/models bumped to 0.57.0
    * @leather.io/rpc bumped to 2.23.0
  * devDependencies
    * @leather.io/test-config bumped to 0.1.4
</details>

<details><summary>@leather.io/services: 1.57.0</summary>

## [1.57.0](https://github.com/ordpool-space/cat21-wallet/compare/@leather.io/services-v1.56.0...@leather.io/services-v1.57.0) (2026-06-14)


### Features

* add fallback responses to all bis client calls ([c81750e](https://github.com/ordpool-space/cat21-wallet/commit/c81750ee967704794efdae276f9bd3e31af50941))
* add withdrawal and fee logic to sbtc swap provider service ([3d277dd](https://github.com/ordpool-space/cat21-wallet/commit/3d277dd8e1f56eae7772b4a042f66288b87101ba))
* adds market stats and token analytics services ([b5c47ae](https://github.com/ordpool-space/cat21-wallet/commit/b5c47ae2401e3e1431343a11cd8398e7a5c1bc6b))
* asset-list service ([c4dcb11](https://github.com/ordpool-space/cat21-wallet/commit/c4dcb11d79fdaf318dade7d7f52ca81d2c33ecf0))
* auth infrastructure ([#2368](https://github.com/ordpool-space/cat21-wallet/issues/2368)) ([f3d4b3e](https://github.com/ordpool-space/cat21-wallet/commit/f3d4b3e91e86f0d69606c21f67985b3eed762f1f))
* **extension:** deprecation of ordinals and runes ([d6e1fea](https://github.com/ordpool-space/cat21-wallet/commit/d6e1feaccb47de540983c9263cb198f279ed7679))
* **extension:** fee service usage in extension ([f295794](https://github.com/ordpool-space/cat21-wallet/commit/f29579434d4291805dc1010faeac863dcadaaf5f))
* **extension:** remove runes and ordinals ([#2343](https://github.com/ordpool-space/cat21-wallet/issues/2343)) ([88d12da](https://github.com/ordpool-space/cat21-wallet/commit/88d12da1389dc241d24753f7f7f230a243b2444b))
* **extension:** support originator post-condition mode ([#2324](https://github.com/ordpool-space/cat21-wallet/issues/2324)) ([6e7d3e1](https://github.com/ordpool-space/cat21-wallet/commit/6e7d3e11b5d18a576c72fe4886f5ead6376d9d16))
* implement auth service ([c414973](https://github.com/ordpool-space/cat21-wallet/commit/c4149736c63f547718d8730ff6a029273c9a7306))
* **models,services:** unify SwapDex and YieldProvider into StacksProtocol model ([0d7f44c](https://github.com/ordpool-space/cat21-wallet/commit/0d7f44cb2961c57aa0730066b39697e5ab7ca632))
* **services:** activity v2 ([ae29c23](https://github.com/ordpool-space/cat21-wallet/commit/ae29c23a6001bffc5ab81c89400e2d9768930478))
* **services:** integrate bitflow bff api ([8256079](https://github.com/ordpool-space/cat21-wallet/commit/8256079c4b1c5760fbaa51f978cdabf8817a0e0a))
* **services:** multisig service vaults ([#2378](https://github.com/ordpool-space/cat21-wallet/issues/2378)) ([4351c6c](https://github.com/ordpool-space/cat21-wallet/commit/4351c6c26b256fd4007d70020bc588bf109f7b89))
* **utils:** add sip10 token name override function ref LEA-3483 ([d650958](https://github.com/ordpool-space/cat21-wallet/commit/d6509588398ac33f02ceb5272c764f6c1fb2c9b2))
* **web:** wire multisig auth sign-in flow and session bootstrap (ref LEA-3577) ([#2372](https://github.com/ordpool-space/cat21-wallet/issues/2372)) ([6aa01ea](https://github.com/ordpool-space/cat21-wallet/commit/6aa01ea6a609ebac1dee13908c658ce871e4dd39))


### Bug Fixes

* audit axios ([#2362](https://github.com/ordpool-space/cat21-wallet/issues/2362)) ([83e1848](https://github.com/ordpool-space/cat21-wallet/commit/83e1848b6fe5f4ac3d4478090277b3bf032d055b))
* axios cve ([b145cd5](https://github.com/ordpool-space/cat21-wallet/commit/b145cd5fd055201b18304b5e2b92635d56086915))
* dep audit ([f0f69d3](https://github.com/ordpool-space/cat21-wallet/commit/f0f69d3b726fc8637ba9b7b69b7bcbf3bb78d244))
* **extension:** fix bug with tab navigation, ref LEA-3334 ([6030950](https://github.com/ordpool-space/cat21-wallet/commit/6030950a3f16616105edc42f45194388d1bc76c0))
* **extension:** incorrect account balance totals ([a299450](https://github.com/ordpool-space/cat21-wallet/commit/a299450ec583a6e7cd82f82ce61e8c0ed57284a5))
* **extension:** sip10 send form service usage ([c61d4e5](https://github.com/ordpool-space/cat21-wallet/commit/c61d4e5de382c4a94686ed751120677dc6d44095))
* networks bug ([#2379](https://github.com/ordpool-space/cat21-wallet/issues/2379)) ([01d0c87](https://github.com/ordpool-space/cat21-wallet/commit/01d0c87860b18ff5952cac03a12f42f8f9b9165a))
* ordinals/runes fallback ([35d1bea](https://github.com/ordpool-space/cat21-wallet/commit/35d1bea0e3cde0e9ad1e6c77d33793ef48260e3b))
* remove runes/ordinals pages from services/models ([#2358](https://github.com/ordpool-space/cat21-wallet/issues/2358)) ([101bf28](https://github.com/ordpool-space/cat21-wallet/commit/101bf2808285991f40d93e6eaad00f32c4435675))
* sbtc withdrawal bugs ([8f07d2e](https://github.com/ordpool-space/cat21-wallet/commit/8f07d2e61bbcaa97271ebcd37c1137d204a12994))
* **services:** add pagination for nft holdings endpoint ([4005a7a](https://github.com/ordpool-space/cat21-wallet/commit/4005a7afa93013e3de729c257065a89903c8a99b))
* **services:** failing rate limiter unit test ([2fb4ced](https://github.com/ordpool-space/cat21-wallet/commit/2fb4ced24c73db03421c0165461876a86ca4eabc))
* **services:** filter lp tokens from collectibles ([252454c](https://github.com/ordpool-space/cat21-wallet/commit/252454ca25e4aeebe099dd8bcf7ba94753ed855f))
* **services:** filter SIP-9 collectibles that duplicate owned BNS names ([11e2171](https://github.com/ordpool-space/cat21-wallet/commit/11e217153c38f4e38255de083754ec8a79ea78d7))
* **services:** handle api errors gracefully in gamma and bns services ([26af965](https://github.com/ordpool-space/cat21-wallet/commit/26af965e152ecdd27ff2a0412401d7afd41b8839))
* **services:** limit NFT holdings pagination and narrow Gamma error handling ([e63bce2](https://github.com/ordpool-space/cat21-wallet/commit/e63bce2a8f98f57c2372761fe77c907f46b0d302))
* **services:** prevent ipfs url double-encoding ([095548b](https://github.com/ordpool-space/cat21-wallet/commit/095548bc1dd79ee44a9054a4cc623144185f2d71))
* **services:** use correct execution type for sbtc withdrawals ([cb8bcb7](https://github.com/ordpool-space/cat21-wallet/commit/cb8bcb73105f0f3fb5309e11d9a30e36ccf766cb))
* **services:** use promise.allsettled for resilient nft metadata fetching ([8275367](https://github.com/ordpool-space/cat21-wallet/commit/827536792e417e1bd0a1171ad4c677a452506707))
* upgrade axios ([#2313](https://github.com/ordpool-space/cat21-wallet/issues/2313)) ([9876bb2](https://github.com/ordpool-space/cat21-wallet/commit/9876bb2a6cc764494fbcf9d57449ce5ccc821ab3))


### Dependencies

* The following workspace dependencies were updated
  * dependencies
    * @leather.io/bitcoin bumped to 0.38.0
    * @leather.io/constants bumped to 0.37.0
    * @leather.io/models bumped to 0.57.0
    * @leather.io/stacks bumped to 1.21.0
    * @leather.io/test-config bumped to 0.1.4
    * @leather.io/utils bumped to 0.52.0
  * devDependencies
    * @leather.io/rpc bumped to 2.23.0
</details>

<details><summary>@leather.io/stacks: 1.21.0</summary>

## [1.21.0](https://github.com/ordpool-space/cat21-wallet/compare/@leather.io/stacks-v1.20.1...@leather.io/stacks-v1.21.0) (2026-06-14)


### Features

* **extension:** support originator post-condition mode ([#2324](https://github.com/ordpool-space/cat21-wallet/issues/2324)) ([6e7d3e1](https://github.com/ordpool-space/cat21-wallet/commit/6e7d3e11b5d18a576c72fe4886f5ead6376d9d16))


### Bug Fixes

* **extension:** contract principal support, closes leather-io/extension[#6334](https://github.com/ordpool-space/cat21-wallet/issues/6334) ([b428c1f](https://github.com/ordpool-space/cat21-wallet/commit/b428c1f400df8585772622c2ad195d20d6cad08f))
* networks bug ([#2379](https://github.com/ordpool-space/cat21-wallet/issues/2379)) ([01d0c87](https://github.com/ordpool-space/cat21-wallet/commit/01d0c87860b18ff5952cac03a12f42f8f9b9165a))
* update redux migrations and secure store migrations. add tests ([726f23a](https://github.com/ordpool-space/cat21-wallet/commit/726f23a5785f2bdfafee890faaa5008ec15b66cb))


### Dependencies

* The following workspace dependencies were updated
  * dependencies
    * @leather.io/crypto bumped to 1.12.24
    * @leather.io/models bumped to 0.57.0
    * @leather.io/utils bumped to 0.52.0
  * devDependencies
    * @leather.io/test-config bumped to 0.1.4
</details>

<details><summary>@leather.io/test-config: 0.1.4</summary>

## [0.1.4](https://github.com/ordpool-space/cat21-wallet/compare/@leather.io/test-config-v0.1.3...@leather.io/test-config-v0.1.4) (2026-06-14)


### Bug Fixes

* update redux migrations and secure store migrations. add tests ([726f23a](https://github.com/ordpool-space/cat21-wallet/commit/726f23a5785f2bdfafee890faaa5008ec15b66cb))
</details>

<details><summary>@leather.io/tokens: 0.27.0</summary>

## [0.27.0](https://github.com/ordpool-space/cat21-wallet/compare/@leather.io/tokens-v0.26.0...@leather.io/tokens-v0.27.0) (2026-06-14)


### Features

* **extension:** add swap asset selector ([fea3884](https://github.com/ordpool-space/cat21-wallet/commit/fea3884c5077da671c7eae11b57ce6672144f0b7))


### Bug Fixes

* **ci:** decouple mobile build from package lifecycle hooks ([a53e33a](https://github.com/ordpool-space/cat21-wallet/commit/a53e33a6d97c3af8b52a3d4972cd7caadac2edae))
* **mobile:** skip prepare scripts during EAS build ([0ce669f](https://github.com/ordpool-space/cat21-wallet/commit/0ce669fc6b22712ee510efbc066d78fa00d08699))
* **panda-preset:** resolve tokens import during EAS build ([ebabad1](https://github.com/ordpool-space/cat21-wallet/commit/ebabad12cbbb1ee2d481e52533d5c9eb30c67f28))
</details>

<details><summary>@leather.io/ui: 1.112.0</summary>

## [1.112.0](https://github.com/ordpool-space/cat21-wallet/compare/@leather.io/ui-v1.111.6...@leather.io/ui-v1.112.0) (2026-06-14)


### Features

* **extension:** add swap asset selector ([fea3884](https://github.com/ordpool-space/cat21-wallet/commit/fea3884c5077da671c7eae11b57ce6672144f0b7))
* **extension:** assets ui redesign ([a22fde9](https://github.com/ordpool-space/cat21-wallet/commit/a22fde991f204384ade9d48253c40509ea694556))
* **extension:** fade bottom action bar ([065ec91](https://github.com/ordpool-space/cat21-wallet/commit/065ec91a1d52c3cf833b42572eab2c6667bca727))
* **extension:** first token ([a945df1](https://github.com/ordpool-space/cat21-wallet/commit/a945df1e5bef1f884d3a1c670f7f5485376d6d2b))
* **extension:** overhaul collectibles tab with new UI and empty states ([73e6231](https://github.com/ordpool-space/cat21-wallet/commit/73e623133b5786621a06b83bf099a68f5e3889ef))
* **mobile:** expo v54 ([50d0f98](https://github.com/ordpool-space/cat21-wallet/commit/50d0f98a39a00986f35193825724e7c80dcb2d94))
* **mobile:** get your first nft section ([f5ceaeb](https://github.com/ordpool-space/cat21-wallet/commit/f5ceaeb4eba70b150e27ce8be969502afca16b25))
* **mobile:** learn section ([a56cb7f](https://github.com/ordpool-space/cat21-wallet/commit/a56cb7fedda2c395f2a3c7e2a63fa32819fab740))
* network badge ([7cf9b35](https://github.com/ordpool-space/cat21-wallet/commit/7cf9b352f84d7aafb7c502e015527458e589de6b))
* new action buttons ([6bb4b78](https://github.com/ordpool-space/cat21-wallet/commit/6bb4b78db34f306504762d7b87d5f4a7dde41b8a))
* other settings pages ([fe93560](https://github.com/ordpool-space/cat21-wallet/commit/fe93560e5d936ba11d9800a3986deea205f6287e))
* **ui:** add `useAmountField` hooks for web and native ([ca8f983](https://github.com/ordpool-space/cat21-wallet/commit/ca8f983ab20895f384a88e7c002ad6e1ce41fb7f))
* **ui:** add a web version of the slidePair animation preset ([a08844e](https://github.com/ordpool-space/cat21-wallet/commit/a08844e6f106a9f04e98002a902c9b17faa6a514))
* **ui:** add popover web component ([a44473c](https://github.com/ordpool-space/cat21-wallet/commit/a44473c136eb1946466527f2a4e4d8150b14847e))
* **ui:** add web version of `CircularProgress` component ([7f10152](https://github.com/ordpool-space/cat21-wallet/commit/7f101529c75ce6170df846be3686e1a27c72515a))
* **ui:** add web version of numeric input ([ac33307](https://github.com/ordpool-space/cat21-wallet/commit/ac33307dd5f41f79ea7733efaba8537dcf5ab222))
* updated settings ([af9ddbb](https://github.com/ordpool-space/cat21-wallet/commit/af9ddbb0d2124b87dfcc14efbaf1a33faafd7dee))
* **web:** Leather Multisig UI (initial import, behind multisigEnabled flag) ([#2365](https://github.com/ordpool-space/cat21-wallet/issues/2365)) ([872827d](https://github.com/ordpool-space/cat21-wallet/commit/872827d28f3f848595958f197df22df6b580dd81))
* **web:** multisig per-chain connection-status dropdown ([#2376](https://github.com/ordpool-space/cat21-wallet/issues/2376)) ([98b810b](https://github.com/ordpool-space/cat21-wallet/commit/98b810b51d8b9c9994978d10637cf30ecb7662d6))


### Bug Fixes

* 16kb memory ([47ea4e4](https://github.com/ordpool-space/cat21-wallet/commit/47ea4e4becd5cd51cde3d095c3d7e624bf0cb112))
* bump versions in ui package ([92c7b70](https://github.com/ordpool-space/cat21-wallet/commit/92c7b70b600228cfbe731ebd85849b119e6d5da5))
* **ci:** decouple mobile build from package lifecycle hooks ([a53e33a](https://github.com/ordpool-space/cat21-wallet/commit/a53e33a6d97c3af8b52a3d4972cd7caadac2edae))
* **extension:** bleeding shadows ([f14bd12](https://github.com/ordpool-space/cat21-wallet/commit/f14bd123173f9377eb942de7ec3f03087c51e142))
* **extension:** make deposits pressable ([831a1f3](https://github.com/ordpool-space/cat21-wallet/commit/831a1f3c2603ad9422d9bbe9008d72599ce24fa6))
* **extension:** refine collectibles tab typography and spacing ([509e784](https://github.com/ordpool-space/cat21-wallet/commit/509e78416099d4e90f47bb89eacd4abc474ee84a))
* **extension:** refine token list typography, spacing, and hover radius ([05871e1](https://github.com/ordpool-space/cat21-wallet/commit/05871e1686e292760caba72286afd8ecf24781bd))
* **extension:** update collectible design ([7902c68](https://github.com/ordpool-space/cat21-wallet/commit/7902c68a97f6883c17b83f0935d125fa227ee78d))
* **extension:** update storybook version ([10f91f4](https://github.com/ordpool-space/cat21-wallet/commit/10f91f4edb59fda19e81b42654083356a33fc2bb))
* integration tests connected to settings ([19b9213](https://github.com/ordpool-space/cat21-wallet/commit/19b92135ac7fce715b96441877301efcb4d0ced9))
* **mobile:** adjust swap activity icon alignment, simplify styling ([53587a2](https://github.com/ordpool-space/cat21-wallet/commit/53587a2f90ba51bd5e814d66afc2ddd26ed7a4c8))
* **mobile:** refactor avatars + fix regressions to mobile activity ([08465b6](https://github.com/ordpool-space/cat21-wallet/commit/08465b6a972002cc957cbcd9f00b7fd8fdee8cf9))
* more updates for settings revamp ([edb2895](https://github.com/ordpool-space/cat21-wallet/commit/edb289521116b96b46afd733071a16ba8ba7f9b5))
* only run panda on build, scope EAS postinstall build to mobile only ([29690bf](https://github.com/ordpool-space/cat21-wallet/commit/29690bfe4901fc691cd06d9d4487b585f9c2f60e))
* point panda to src/preset config as its how we use it mostly ([29690bf](https://github.com/ordpool-space/cat21-wallet/commit/29690bfe4901fc691cd06d9d4487b585f9c2f60e))
* re-add pnpm prepare for web and extension ([29690bf](https://github.com/ordpool-space/cat21-wallet/commit/29690bfe4901fc691cd06d9d4487b585f9c2f60e))
* remove runes/ordinals from ui packages ([#2353](https://github.com/ordpool-space/cat21-wallet/issues/2353)) ([709dbb5](https://github.com/ordpool-space/cat21-wallet/commit/709dbb53a38f221b2befc73191e44c952bee4c49))
* rollback build change ([29690bf](https://github.com/ordpool-space/cat21-wallet/commit/29690bfe4901fc691cd06d9d4487b585f9c2f60e))
* svg logo ([c0163c6](https://github.com/ordpool-space/cat21-wallet/commit/c0163c61e747bf1a7c7673401daae319dfb3f945))
* **ui:** enforce logomark dimensions for mobile header ([f50d72b](https://github.com/ordpool-space/cat21-wallet/commit/f50d72b738e4af42f377ad04679b83d17f367e58))
* **ui:** improve switch on/off contrast and add focus ring ([e621993](https://github.com/ordpool-space/cat21-wallet/commit/e6219935ea01f11a8928d284187a309ae4b0e098))
* **ui:** package advisories ([61872cf](https://github.com/ordpool-space/cat21-wallet/commit/61872cfeaefcce7b97071ae4d5421ea7a64cb324))
* **ui:** prevent semantic warnings on missing attributes ([2373565](https://github.com/ordpool-space/cat21-wallet/commit/2373565ec3d3fdcc12f7bc388ba1b2f45ccbb0aa))
* **ui:** truncate long titles in item layout with ellipsis ([#2360](https://github.com/ordpool-space/cat21-wallet/issues/2360)) ([58cf921](https://github.com/ordpool-space/cat21-wallet/commit/58cf92115f5ccffa6c0bfd847ec85026e85d5880))
* **ui:** use blue.border instead of lightModeBlue.500 for switch focus ring ([a2da5b1](https://github.com/ordpool-space/cat21-wallet/commit/a2da5b143fd942ba7c61214f0e1bd01abf09a9a1))
* **ui:** use contractId to identify sBTC and USDCx for custom avatars ([3a3ebcb](https://github.com/ordpool-space/cat21-wallet/commit/3a3ebcbf470e0ade89fec2d39fb93e683cbbdceb))
* **ui:** use correct spacings for numeric input elements ([5f91542](https://github.com/ordpool-space/cat21-wallet/commit/5f9154259e841b5e2b043c17ae92417d9cd1f69a))
* update extension revamp ui for tooltips and spacings ([660f4e4](https://github.com/ordpool-space/cat21-wallet/commit/660f4e431fbf68d4598a750e8f6b5ecd86235725))
* update storybook dependancy ([4683726](https://github.com/ordpool-space/cat21-wallet/commit/4683726ada4035dba496d34718593e496716f44f))


### Dependencies

* The following workspace dependencies were updated
  * dependencies
    * @leather.io/tokens bumped to 0.27.0
    * @leather.io/utils bumped to 0.52.0
  * devDependencies
    * @leather.io/features bumped to 1.5.0
    * @leather.io/models bumped to 0.57.0
    * @leather.io/panda-preset bumped to 0.17.0
    * @leather.io/test-config bumped to 0.1.4
</details>

<details><summary>@leather.io/utils: 0.52.0</summary>

## [0.52.0](https://github.com/ordpool-space/cat21-wallet/compare/@leather.io/utils-v0.51.4...@leather.io/utils-v0.52.0) (2026-06-14)


### Features

* **extension:** overhaul collectibles tab with new UI and service integration ([9412c29](https://github.com/ordpool-space/cat21-wallet/commit/9412c2951d423807a44ba4d96c3164f1956472cf))
* **mobile:** trending tokens ([d321fc5](https://github.com/ordpool-space/cat21-wallet/commit/d321fc529f0802f06fa6c2d68ad48606dcba88bc))
* **utils:** add sip10 token name override function ref LEA-3483 ([d650958](https://github.com/ordpool-space/cat21-wallet/commit/d6509588398ac33f02ceb5272c764f6c1fb2c9b2))


### Bug Fixes

* remove runes/ordinals pages from services/models ([#2358](https://github.com/ordpool-space/cat21-wallet/issues/2358)) ([101bf28](https://github.com/ordpool-space/cat21-wallet/commit/101bf2808285991f40d93e6eaad00f32c4435675))


### Dependencies

* The following workspace dependencies were updated
  * dependencies
    * @leather.io/constants bumped to 0.37.0
    * @leather.io/models bumped to 0.57.0
  * devDependencies
    * @leather.io/test-config bumped to 0.1.4
</details>

---
This PR was generated with [Release Please](https://github.com/googleapis/release-please). See [documentation](https://github.com/googleapis/release-please#release-please).