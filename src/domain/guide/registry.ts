import {benefitArticles} from './content/manuals-benefits'
import type { GuideArticle } from './types'
import { guidePageArticles } from './content/pages'
import { guideActionArticles } from './content/actions'
import { guideRuleArticles } from './content/rules'
import { guideConceptArticles } from './content/concepts'
import { guideTroubleshootingArticles } from './content/troubleshooting'
import { catalogArticles } from './content/manuals-catalog'
export { guidePages } from './content/pageRegistry'

export const guideArticles: GuideArticle[] = [...benefitArticles,...guidePageArticles, ...catalogArticles, ...guideActionArticles, ...guideRuleArticles, ...guideConceptArticles, ...guideTroubleshootingArticles]
