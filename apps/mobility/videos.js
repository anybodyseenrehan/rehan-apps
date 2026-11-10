(() => {
  'use strict';

  // Read the actual runtime from each embedded player instead of estimating it.
  const labels = [...document.querySelectorAll('[data-video-runtime]')];
  function initialize() {
    labels.forEach(label => {
      let attempts = 0;
      let timer;
      const update = player => {
        const duration = Math.round(player.getDuration());
        if (!Number.isFinite(duration) || duration <= 0) return false;
        const hours = Math.floor(duration / 3600);
        const minutes = Math.floor((duration % 3600) / 60);
        const seconds = String(duration % 60).padStart(2, '0');
        label.textContent = hours ? `${hours}:${String(minutes).padStart(2, '0')}:${seconds}` : `${minutes}:${seconds}`;
        clearInterval(timer);
        return true;
      };
      new YT.Player(`video-${label.dataset.videoRuntime}`, {
        events: {
          onReady: event => {
            if (update(event.target)) return;
            timer = setInterval(() => {
              if (update(event.target) || ++attempts >= 30) clearInterval(timer);
            }, 1000);
          },
          onStateChange: event => update(event.target),
          onError: () => {
            clearInterval(timer);
            if (label.textContent === 'Runtime loading…') label.textContent = 'Runtime unavailable';
          }
        }
      });
    });
  }
  window.onYouTubeIframeAPIReady = initialize;
  if (window.YT?.Player) initialize();
  else {
    const script = document.createElement('script');
    script.src = 'https://www.youtube.com/iframe_api';
    script.onerror = () => labels.forEach(label => {
      if (label.textContent === 'Runtime loading…') label.textContent = 'Runtime unavailable';
    });
    document.head.append(script);
  }
})();
