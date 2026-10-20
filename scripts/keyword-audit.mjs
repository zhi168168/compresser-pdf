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
console.log(JSON.stringify({
 scope:'French homepage editorial text, including FAQ answers; not metadata or hidden compressor UI',
 words,
 exact:{phrase:'Compresser PDF',occurrences:exact,occurrencesPerWordPercent:percent(exact),twoWordCoveragePercent:percent(exact*2)},
 includingNaturalVariants:{occurrences:variants,occurrencesPerWordPercent:percent(variants)},
 note:'Occurrence frequency and two-word coverage are different metrics. Neither is a ranking guarantee; compare using the same scope and formula as the SEO tool.'
},null,2));
