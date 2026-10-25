export type GuideStatus = 'verified' | 'review' | 'business-pending' | 'historical'
export type GuideKind = 'page' | 'action' | 'rule' | 'concept' | 'troubleshooting'
export interface GuideSection { id: string; title: string; paragraphs?: string[]; steps?: string[]; table?: { headers: string[]; rows: string[][] } }
export interface GuideArticle {
  id: string; title: string; kind: GuideKind; summary: string; aliases: string[]
  pageIds: string[]; actionIds: string[]; ruleIds: string[]; related: string[]
  revision: number; status: GuideStatus; implementation: string; evidence: string[]
  sections: GuideSection[]
}
export interface GuidePage { id: string; title: string; patterns: string[]; articleId: string; actionIds: string[]; source: string[]; formal: boolean; historical?: boolean }
export interface GuideFlow { id: string; title: string; goal: string; prerequisites: string[]; steps: { id: string; title: string; articleId: string; route?: string; practice: string; checkpoints: string[] }[] }
export type FailureKind = 'business' | 'input' | 'permission' | 'persistence' | 'conflict' | 'unknown'
export interface GuideFailure { kind: FailureKind; ruleId?: string; actionId: string; context?: Record<string,string>; fields?: string[]; recovery?: string[]; savedState: 'unchanged' | 'memory-only' | 'unconfirmed'; message: string }
export interface GuideFailureBranch { id: string; actionId: string; ruleId?: string; kind: FailureKind; source: string; exact: boolean; validation: string; note?: string }
export interface GuideOverride { articleId: string; title: string; summary: string; sections: GuideSection[]; status: GuideStatus; implementation: string; evidence: string[] }
export interface GuidePublication { revision: number; updatedAt: string; author: string; content: GuideOverride }
export interface GuideContentState { schema: 1; revision: number; published: Record<string,GuidePublication>; previous: Record<string,GuidePublication>; drafts: Record<string,GuideOverride> }
export interface GuideProgress { schema: 1; owner: string; favorites: string[]; read: Record<string,number>; practiced: Record<string,number>; recent: {id:string;revision:number;at:string}[] }
