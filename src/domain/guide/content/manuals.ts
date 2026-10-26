import type {GuideManualContent} from '../types'
import {foundationManuals} from './manuals-foundation'
import {salesManuals} from './manuals-sales'
import {salesOptionManuals} from './manuals-sales-options'

// One authored source for the full explanation workspace and in-page help.
export const guideManualContents: Readonly<Record<string,GuideManualContent>> = {...foundationManuals,...salesManuals,...salesOptionManuals}
