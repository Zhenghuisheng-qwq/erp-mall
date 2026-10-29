import type {GuideManualContent} from '../types'
import {foundationManuals} from './manuals-foundation'
import {catalogManuals} from './manuals-catalog'

// One authored source for the full explanation workspace and in-page help.
export const guideManualContents: Readonly<Record<string,GuideManualContent>> = {...foundationManuals,...catalogManuals}
