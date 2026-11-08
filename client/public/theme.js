// Apply the theme before first paint (avoids a light flash in dark mode).
// A theme the user picked wins; otherwise follow the phone / computer setting.
try {
  var t = localStorage.getItem('theme');
  if (!t && window.matchMedia) t = window.matchMedia('(prefers-color-scheme: dark)').matches ? 'dark' : 'light';
  document.documentElement.dataset.theme = t || 'light';
} catch (e) { document.documentElement.dataset.theme = 'light'; }
