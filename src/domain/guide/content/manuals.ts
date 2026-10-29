import {bundleManuals,generalFeatures} from './manuals-type-bundles'
import type {GuideManualContent} from '../types'
import {foundationManuals} from './manuals-foundation'
import {catalogManuals} from './manuals-catalog'

// One authored source for the full explanation workspace and in-page help.
export const guideManualContents: Readonly<Record<string,GuideManualContent>> = {...bundleManuals,...foundationManuals,...catalogManuals,'page-compatibility':{purpose:'统一维护与查询明确型号、规格及通用条件适用资料。',features:[...(foundationManuals['page-compatibility']?.features||[]),...generalFeatures],restrictions:foundationManuals['page-compatibility']?.restrictions||[]}}
