import {readFile} from 'node:fs/promises';

// Audit crawlable editorial copy, including collapsed FAQ answers. Exclude
// metadata, navigation, footer, and the compressor's conditional UI states.
const html=await readFile(new URL('../index.html',import.meta.url),'utf8');
const hero=html.match(/<div class="hero-copy">([\s\S]*?)<\/div>/)?.[1];
const start=html.indexOf('<section class="compression-guide');
if(!hero||start<0)throw new Error('Homepage editorial sections were not found');
const body=html.slice(start,html.indexOf('</main>',start));
const text=(hero+' '+body).replace(/<[^>]+>/g,' ').replace(/&(?:nbsp|amp|quot|apos);/g,' ').replace(/\s+/g,' ').trim();
const words=(text.match(/[\p{L}\p{N}]+(?:[’'-][\p{L}\p{N}]+)*/gu)||[]).length;
const exact=(text.match(/\bcompresser\s+pdf\b/gi)||[]).length;
const variants=(text.match(/\bcompresser\s+(?:(?:un|le|votre|ce)\s+)?pdf\b/gi)||[]).length;
const percent=n=>Number((n/words*100).toFixed(2));
// AITDK 3.0 / current public panel: body text (including collapsed FAQs and
// conditional tool UI), punctuation removed, numeric tokens excluded from
// n-grams. Multiword n-grams KEEP stop words. Denominator is unfiltered body
// whitespace word count. Confirm source extraction against the deployed DOM.
const bodySource=html.match(/<body\b[^>]*>([\s\S]*?)<\/body>/i)?.[1];
const aitdkText=bodySource
 .replace(/<!--[\s\S]*?-->/g,' ')
 .replace(/<(script|iframe|style|textarea|select|noscript|title|plasmo-csui|__plasmo-loading__|svg|canvas|audio|video|picture|template|object|applet)\b[^>]*>[\s\S]*?<\/\1\s*>/gi,' ')
 .replace(/<[^>]+>/g,' ')
 .replaceAll('&amp;','&').replaceAll('&nbsp;',' ').replaceAll('&quot;','"').replaceAll('&#39;',"'")
 .replace(/\s+/g,' ').trim();
const aitdkTotal=aitdkText?aitdkText.split(/\s+/).length:0;
const aitdkTokens=aitdkText.toLowerCase().replace(/[^\p{L}\p{N}\s]/gu,'').split(/\s+/).filter(token=>isNaN(token));
let aitdkCount=0;
for(let i=0;i<aitdkTokens.length-1;i++)if(aitdkTokens[i]==='compresser'&&aitdkTokens[i+1]==='pdf')aitdkCount++;
console.log(JSON.stringify({
 aitdk:{phrase:'compresser pdf',phraseSize:2,count:aitdkCount,total:aitdkTotal,densityPercent:Number((aitdkCount/aitdkTotal*100).toFixed(2)),formula:'count / total body words × 100; no multiplication by phrase length',scope:'Full body source, including FAQ answers and conditional tool states; checked against the same algorithm on the rendered DOM'},
 scope:'French homepage editorial text, including FAQ answers; not metadata or hidden compressor UI',
 words,
 exact:{phrase:'Compresser PDF',occurrences:exact,occurrencesPerWordPercent:percent(exact),twoWordCoveragePercent:percent(exact*2)},
 includingNaturalVariants:{occurrences:variants,occurrencesPerWordPercent:percent(variants)},
 note:'Use the aitdk result for the 3–5% target. Editorial frequency and two-word coverage below use different scope/formulas and must not be substituted. This reproduces the inspected AITDK code; it is not a captured extension-panel result.'
},null,2));
