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
export type FailureKind = 'business' | 'input' | 'permission' | 'persistence' | 'conflict' | 'unknown'
export interface GuideFailure { kind: FailureKind; ruleId?: string; actionId: string; context?: Record<string,string>; fields?: string[]; recovery?: string[]; savedState: 'unchanged' | 'memory-only' | 'unconfirmed'; message: string }
export interface GuideFailureBranch { id: string; actionId: string; ruleId?: string; kind: FailureKind; source: string; exact: boolean; validation: string; note?: string }
