import {bundleArticles,generalFeatures} from './content/manuals-type-bundles'
import type { GuideArticle } from './types'
import { guidePageArticles } from './content/pages'
import { guideActionArticles } from './content/actions'
import { guideRuleArticles } from './content/rules'
import { guideConceptArticles } from './content/concepts'
import { guideTroubleshootingArticles } from './content/troubleshooting'
import { catalogArticles } from './content/manuals-catalog'
export { guidePages } from './content/pageRegistry'

export const guideArticles: GuideArticle[] = [...bundleArticles,...guidePageArticles, ...catalogArticles, ...guideActionArticles, ...guideRuleArticles, ...guideConceptArticles, ...guideTroubleshootingArticles].map(a=>a.id==='manual-compatibility'?{...a,sections:[...a.sections,...generalFeatures.map(f=>({id:f.id,title:f.title,paragraphs:[f.description,f.operation,f.result]}))]}:a)
