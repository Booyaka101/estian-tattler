import {defineCliConfig} from 'sanity/cli'

export default defineCliConfig({
  studioHost: 'estian-tattler',
  api: {
    projectId: 'lcvgtfvq',
    dataset: 'production'
  },
  deployment: {
    appId: 'uai6f1wkpsf49r3et3gtpiio',
    /**
     * Enable auto-updates for studios.
     * Learn more at https://www.sanity.io/docs/studio/latest-version-of-sanity#k47faf43faf56
     */
    autoUpdates: true,
  },
})
