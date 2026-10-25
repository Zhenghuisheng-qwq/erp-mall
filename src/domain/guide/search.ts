import type {GuideArticle} from './types'
export function searchGuide(articles:readonly GuideArticle[],query:string,pageId=''){
  const tokens=query.trim().toLocaleLowerCase().split(/\s+/).filter(Boolean)
  return articles.map(article=>{
    let score=pageId&&article.pageIds.includes(pageId)?5:0
    const heading=[article.title,...article.aliases].join(' ').toLocaleLowerCase()
    const body=[article.summary,...article.sections.flatMap(s=>[s.title,...s.paragraphs||[],...s.steps||[],...(s.table?.rows.flat()||[])])].join(' ').toLocaleLowerCase()
    for(const token of tokens){if(heading.includes(token))score+=heading===token?40:20;else if(body.includes(token))score+=4;else return {article,score:-1}}
    return {article,score}
  }).filter(row=>row.score>=0).sort((a,b)=>b.score-a.score||a.article.id.localeCompare(b.article.id)).map(row=>row.article)
}
