(() => {
  'use strict';

  const widgets = [...document.querySelectorAll('[data-feature-audio]')];
  const externalTriggers = [...document.querySelectorAll('[data-feature-audio-target]')];
  const players = widgets.map(widget => widget.querySelector('audio')).filter(Boolean);

  for (const widget of widgets) {
    const audio = widget.querySelector('audio');
    const button = widget.querySelector('[data-feature-audio-toggle]');
    const label = widget.querySelector('[data-feature-audio-label]');
    const status = widget.querySelector('[role="status"]');
    if (!audio || !button || !label || !status || typeof audio.play !== 'function' || widget.dataset.audioEnhanced) continue;

    const listenLabel = label.textContent || 'Listen';
    const title = widget.dataset.audioTitle || 'this introduction';
    const triggers = [button, ...externalTriggers.filter(trigger => trigger.dataset.featureAudioTarget === widget.id)];
    const transcript = widget.querySelector('.feature-audio-transcript');
    const transcriptText = widget.querySelector('[data-feature-audio-transcript-text]');
    let variants = [];
    try {
      const saved = JSON.parse(widget.dataset.audioVariants || '[]');
      if (Array.isArray(saved)) variants = saved.filter(variant => typeof variant?.src === 'string' && variant.src.startsWith('/assets/audio/'));
    } catch { /* The initial clip and its transcript remain usable. */ }
    let remaining = [], lastVariant = null;
    let currentVariant = variants.findIndex(variant => variant.src === audio.querySelector('source')?.getAttribute('src'));
    const refill = () => {
      remaining = variants.map((_, index) => index);
      for (let index = remaining.length - 1; index > 0; index--) {
        const other = Math.floor(Math.random() * (index + 1));
        [remaining[index], remaining[other]] = [remaining[other], remaining[index]];
      }
      // Keep consecutive greetings distinct when a new round begins.
      if (remaining.length > 1 && remaining[0] === lastVariant) [remaining[0], remaining[1]] = [remaining[1], remaining[0]];
    };
    refill();
    const showStatus = message => {
      status.textContent = message;
      status.hidden = !message;
    };
    const update = () => {
      const playing = !audio.paused && !audio.ended;
      label.textContent = playing ? 'Pause' : audio.ended ? 'Listen again' : listenLabel;
      for (const trigger of triggers) {
        trigger.setAttribute('aria-pressed', String(playing));
        trigger.setAttribute('aria-label', trigger.dataset.featureAudioAdvance === 'true'
          ? `Play the next audio greeting: ${title}`
          : `${playing ? 'Pause' : 'Listen to'} ${title}`);
      }
    };
    const failed = () => {
      update();
      showStatus(transcript && !transcript.hidden
        ? 'This audio could not play. Select Listen to try again, or read the transcript below.'
        : 'This audio could not play. Select Listen to try again in a moment.');
    };
    const play = () => {
      showStatus('');
      for (const player of players) if (player !== audio) player.pause();
      try {
        const playback = audio.play();
        if (playback?.catch) playback.catch(error => {
          // Switching clips or pressing Pause can interrupt a pending play.
          if (error.name !== 'AbortError') failed();
        });
      } catch { failed(); }
    };
    const toggle = () => {
      if (!audio.paused) audio.pause();
      else play();
    };
    const advance = () => {
      if (!variants.length) { toggle(); return; }
      if (!remaining.length) refill();
      currentVariant = remaining.shift();
      lastVariant = currentVariant;
      const variant = variants[currentVariant];
      audio.pause();
      audio.src = variant.src;
      audio.load();
      if (transcriptText) transcriptText.textContent = variant.transcript || '';
      if (transcript) transcript.hidden = !variant.transcript;
      play();
    };

    audio.addEventListener('play', () => {
      for (const player of players) if (player !== audio) player.pause();
      if (currentVariant >= 0) {
        remaining = remaining.filter(index => index !== currentVariant);
        lastVariant = currentVariant;
      }
      showStatus('');
      update();
    });
    audio.addEventListener('pause', update);
    audio.addEventListener('ended', update);
    audio.addEventListener('error', failed);
    for (const trigger of triggers) {
      const activate = trigger.dataset.featureAudioAdvance === 'true' ? advance : toggle;
      trigger.setAttribute('aria-controls', audio.id);
      trigger.addEventListener('click', event => { event.preventDefault(); activate(); });
      if (trigger.tagName !== 'BUTTON') {
        trigger.setAttribute('role', 'button');
        if (!trigger.hasAttribute('tabindex')) trigger.tabIndex = 0;
        trigger.addEventListener('keydown', event => {
          if (event.key !== 'Enter' && event.key !== ' ') return;
          event.preventDefault();
          if (!event.repeat) activate();
        });
      }
      if ('disabled' in trigger) trigger.disabled = false;
    }
    // Keep native controls usable until all enhanced controls are connected.
    widget.dataset.audioEnhanced = 'true';
    button.hidden = false;
    audio.controls = false;
    audio.hidden = true;
    update();
  }
})();
