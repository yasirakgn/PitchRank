function handleActionClick(target) {
  const action = target.getAttribute('data-action');
  if (!action) return;

  switch (action) {
    case 'toggle-dark':
      if (typeof window.toggleDark === 'function') window.toggleDark();
      break;
    case 'switch-main-screen':
      if (typeof window.switchMainScreen === 'function') {
        window.switchMainScreen(target.getAttribute('data-screen'), target);
      }
      break;
    case 'switch-yayin':
      if (typeof window.switchMainScreen === 'function') window.switchMainScreen('yayin', target);
      if (typeof window.loadVideos === 'function') window.loadVideos();
      break;
    case 'try-admin':
      if (typeof window.tryAdmin === 'function') window.tryAdmin(target);
      break;
    case 'set-rank-tab':
      if (typeof window.setRankTab === 'function') {
        window.setRankTab(target.getAttribute('data-tab'), target);
      }
      break;
    case 'set-stat-screen':
      if (typeof window.setStatScreen === 'function') {
        window.setStatScreen(target.getAttribute('data-stat'), target);
      }
      break;
    default:
      break;
  }
}

document.addEventListener('click', (event) => {
  const target = event.target.closest('[data-action]');
  if (!target) return;
  handleActionClick(target);
});
