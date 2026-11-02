// Show only changes this field's visibility; ordinary form submission stays native.
for (const toggle of document.querySelectorAll('[data-admin-password-toggle]')) {
  const form = toggle.closest('form');
  const password = form?.elements.namedItem('password');
  if (!password || password.type !== 'password') continue;
  const hide = () => {
    password.type = 'password';
    toggle.textContent = 'Show password';
    toggle.setAttribute('aria-pressed', 'false');
  };
  toggle.hidden = false;
  toggle.addEventListener('click', () => {
    const visible = password.type === 'password';
    password.type = visible ? 'text' : 'password';
    toggle.textContent = visible ? 'Hide password' : 'Show password';
    toggle.setAttribute('aria-pressed', String(visible));
  });
  form.addEventListener('submit', hide);
  window.addEventListener('pageshow', hide);
}
