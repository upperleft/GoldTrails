import {escapeHtml as h} from './directory-views.js';
import {assetUrl} from './asset-url.js';

export function featureAudio({id, title, src, transcript = '', variants = []}) {
  const hasTranscript = transcript || variants.some(variant => variant.transcript);
  return `<div class="feature-audio" id="${h(id)}" data-feature-audio data-audio-title="${h(title)}"${variants.length ? ` data-audio-variants="${h(JSON.stringify(variants))}"` : ''}>
    <button class="feature-audio-button" type="button" data-feature-audio-toggle aria-controls="${h(id)}-player" aria-describedby="${h(id)}-status" aria-label="${h(`Listen to ${title}`)}" aria-pressed="false" hidden><svg viewBox="0 0 24 24" width="19" height="19" aria-hidden="true" focusable="false"><path d="M11 4 5 9H2v6h3l6 5V4Z"/><path d="M15 8a6 6 0 0 1 0 8m3-11a10 10 0 0 1 0 14"/></svg><span data-feature-audio-label>Listen</span></button>
    <audio id="${h(id)}-player" controls preload="none" aria-label="${h(title)}"><source src="${h(src)}" type="audio/mpeg">Your browser does not support audio. <a href="${h(src)}">Listen to ${h(title)}</a>.</audio>
    <p class="feature-audio-status" id="${h(id)}-status" role="status" aria-live="polite" hidden></p>
    ${hasTranscript ? `<details class="feature-audio-transcript"${transcript ? '' : ' hidden'}><summary>Transcript</summary><p data-feature-audio-transcript-text>${h(transcript)}</p></details>` : ''}
  </div>`;
}

export function attachFeatureAudioAssets(html) {
  if (!html.includes('data-feature-audio') || html.includes('data-feature-audio-assets')) return html;
  return html.replace('</head>', `<link rel="stylesheet" href="${h(assetUrl('feature-audio.css'))}" data-feature-audio-assets></head>`)
    .replace('</body>', `<script src="${h(assetUrl('feature-audio.js'))}" defer></script></body>`);
}
