import type { GuideArticle } from './types'
import { guidePageArticles } from './content/pages'
import { guideActionArticles } from './content/actions'
import { guideRuleArticles } from './content/rules'
import { guideConceptArticles } from './content/concepts'
import { guideTroubleshootingArticles } from './content/troubleshooting'
export { guidePages } from './content/pageRegistry'
export { guideFlows } from './content/flows'

export const guideArticles: GuideArticle[] = [...guidePageArticles, ...guideActionArticles, ...guideRuleArticles, ...guideConceptArticles, ...guideTroubleshootingArticles]
