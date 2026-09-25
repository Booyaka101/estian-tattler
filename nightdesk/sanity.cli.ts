import {defineCliConfig} from 'sanity/cli'

export default defineCliConfig({
  app: {
    organizationId: 'oj47h4o89',
    entry: './src/App.tsx',
  },
  deployment: {
    appId: 'c7c1x4pxf78nzfgaxd3ql5os',
  },
})
