export type GuideStatus = 'business-pending' | 'historical'
export type GuideKind = 'page' | 'action' | 'rule' | 'concept' | 'troubleshooting'
export interface GuideSection { id: string; title: string; paragraphs?: string[]; steps?: string[]; table?: { headers: string[]; rows: string[][] } }
export interface GuideArticle {
  id: string; title: string; kind: GuideKind; summary: string; aliases: string[]
  pageIds: string[]; actionIds: string[]; ruleIds: string[]; related: string[]
  status?: GuideStatus
  sections: GuideSection[]
}
export interface GuidePage { id: string; title: string; patterns: string[]; articleId: string; actionIds: string[]; formal: boolean; historical?: boolean }
/** Authored from the actual page controls, rather than inferred from article prose. */
export interface GuideFeatureRow {
  id: string; title: string; description: string; operation: string; result: string
  primary?: boolean; risk?: boolean; actionIds?: string[]
}
export interface GuideRestrictionRow {
  id: string; condition: string; effect: string; resolution: string
  ruleIds?: string[]; warning?: boolean
}
export interface GuideOperationDetail { id: string; title: string; sections: GuideSection[]; actionIds?: string[] }
export interface GuideManualContent {
  purpose: string; features: GuideFeatureRow[]; restrictions: GuideRestrictionRow[]; details?: GuideOperationDetail[]
}
export type FailureKind = 'business' | 'input' | 'permission' | 'persistence' | 'conflict' | 'unknown'
export interface GuideFailure { kind: FailureKind; ruleId?: string; actionId: string; context?: Record<string,string>; fields?: string[]; recovery?: string[]; savedState: 'unchanged' | 'memory-only' | 'unconfirmed'; message: string }
export interface GuideFailureBranch { id: string; actionId: string; ruleId?: string; kind: FailureKind; source: string; exact: boolean; validation: string; note?: string }
