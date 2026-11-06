import {readFileSync, statSync} from 'node:fs';
import {featureAudio, attachFeatureAudioAssets} from './feature-audio.js';

const manifest = new URL('./articles/audio-summaries.json', import.meta.url);

export function articleAudioMarkup(html, path) {
  const canonicalPath = String(path || '').replace(/\/index\.html$/, '/');
  if (canonicalPath === '/articles/' || html.includes('data-article-audio')) return html;

  let entries;
  try { entries = JSON.parse(readFileSync(manifest, 'utf8')); }
  catch { return html; }
  if (!Array.isArray(entries)) return html;
  const matches = entries.filter(entry => entry?.path === canonicalPath);
  if (matches.length !== 1) return html;
  const entry = matches[0];
  if (![entry.title, entry.script, entry.src].every(value => typeof value === 'string' && value.trim())) return html;
  if (!/^\/assets\/audio\/(?:[a-z0-9][a-z0-9_-]*\/)*[a-z0-9][a-z0-9._-]*\.mp3$/i.test(entry.src)) return html;
  try {
    const clip = statSync(new URL('../dist' + entry.src, import.meta.url));
    if (!clip.isFile() || !clip.size) return html;
  } catch { return html; }

  const article = /<article\b[^>]*>/i.exec(html);
  if (!article) return html;
  const start = article.index + article[0].length;
  const end = html.slice(start).search(/<\/article\s*>/i);
  if (end < 0) return html;
  const heading = /<h1\b[^>]*>[\s\S]*?<\/h1\s*>/i.exec(html.slice(start, start + end));
  if (!heading) return html;
  const slug = canonicalPath.split('/').filter(Boolean).at(-1);
  if (!/^[a-z0-9-]+$/i.test(slug || '')) return html;
  const audio = featureAudio({id: 'article-' + slug, title: 'the Old-Timer’s summary of ' + entry.title, src: entry.src, transcript: entry.script, label: 'Listen to the Old-Timer'});
  const insertion = start + heading.index + heading[0].length;
  return attachFeatureAudioAssets(html.slice(0, insertion) + `<div class="article-audio" data-article-audio>${audio}</div>` + html.slice(insertion));
}
