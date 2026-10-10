// Progressive enhancement: ordinary HTML form submission still works without JavaScript.
for (const form of document.querySelectorAll('.member-form')) {
  if (form.closest('fieldset[disabled]')) continue;
  const feedback = form.querySelector('.member-form-feedback');
  const button = form.querySelector('button[type="submit"]');
  if (!feedback || !button) continue;
  const originalLabel = button.textContent;
  const password = form.elements.namedItem('password');
  const toggle = form.querySelector('[data-password-toggle]');
  if (password && toggle) {
    toggle.hidden = false;
    toggle.addEventListener('click', () => {
      const visible = password.type === 'password';
      password.type = visible ? 'text' : 'password';
      toggle.textContent = visible ? 'Hide password' : 'Show password';
      toggle.setAttribute('aria-pressed', String(visible));
    });
  }
  let sending = false;
  let slowRequest;
  const resetButton = () => {
    sending = false;
    button.removeAttribute('aria-disabled');
    button.textContent = originalLabel;
    form.removeAttribute('aria-busy');
  };
  const recoveryLink = () => {
    if (feedback.querySelector('a')) return;
    const link = document.createElement('a');
    link.href = '/resend-verification/';
    link.textContent = 'Request a verification email';
    feedback.append(document.createTextNode(' '), link);
  };
  const sendSignup = async () => {
    const controller = new AbortController();
    const deadline = window.setTimeout(() => controller.abort(), 30000);
    try {
      const response = await fetch(form.action, {
        method: 'POST', credentials: 'same-origin', redirect: 'error',
        headers: { Accept: 'application/json', 'Content-Type': 'application/x-www-form-urlencoded' },
        body: new URLSearchParams(new FormData(form)), signal: controller.signal,
      });
      if (!response.headers.get('content-type')?.includes('application/json')) throw new Error('Unexpected response');
      const result = await response.json();
      if (typeof result.title !== 'string' || typeof result.message !== 'string') throw new Error('Unexpected response');
      if (!response.ok || result.outcome !== 'email_requested') {
        tell(`${result.title}: ${result.message}`, true);
        if (response.status === 403) {
          const refresh = document.createElement('a');
          refresh.href = '/signup/'; refresh.textContent = 'Open a fresh signup form';
          feedback.append(document.createTextNode(' '), refresh);
        } else if (response.status >= 500) recoveryLink();
        return;
      }
      const card = form.closest('.member-card');
      const heading = document.createElement('h2'); heading.textContent = result.title;
      const confirmation = document.createElement('div');
      confirmation.className = 'member-confirmation'; confirmation.setAttribute('role', 'status');
      const message = document.createElement('p'); message.textContent = result.message;
      confirmation.append(message);
      const recovery = document.createElement('a'); recovery.href = '/resend-verification/'; recovery.textContent = 'Request another verification email';
      const login = document.createElement('a'); login.href = '/login/'; login.textContent = 'Return to member sign-in';
      const links = document.createElement('p'); links.append(recovery, document.createTextNode(' · '), login);
      card.replaceChildren(heading, confirmation, links);
      card.setAttribute('tabindex', '-1'); card.focus();
    } catch {
      tell('We could not confirm that your signup finished. Check your email before retrying; if an account was created, you can request a new verification link.', true);
      recoveryLink();
    } finally {
      window.clearTimeout(deadline);
      window.clearTimeout(slowRequest);
      resetButton();
    }
  };
  const tell = (message, error = false) => {
    feedback.textContent = message;
    feedback.hidden = false;
    feedback.setAttribute('role', error ? 'alert' : 'status');
    feedback.dataset.state = error ? 'error' : 'pending';
  };
  // Validate explicitly so autofilled passwords receive the same length check.
  const problem = field => {
    if (field.required && !field.value) return 'Please fill in this field.';
    if (field.name === 'username' && !/^[a-zA-Z0-9_-]{3,40}$/.test(field.value)) return 'Use 3–40 letters, numbers, underscores or hyphens for your username.';
    if (field.name === 'password' && (field.value.length < 8 || field.value.length > 128)) return 'Your password needs 8–128 characters. A longer phrase can be easier to remember.';
    if (field.name === 'confirmPassword' && field.value !== form.elements.namedItem('password')?.value) return 'The two passwords do not match. Please enter the same password in both fields.';
    if (!field.validity.valid) return field.validationMessage;
    return null;
  };
  form.noValidate = true;
  form.addEventListener('input', () => {
    for (const field of form.querySelectorAll('input')) field.removeAttribute('aria-invalid');
    if (!sending) feedback.hidden = true;
  });
  form.addEventListener('submit', event => {
    if (sending) { event.preventDefault(); return; }
    for (const field of form.querySelectorAll('input:not([type="hidden"])')) {
      const message = problem(field);
      if (!message) continue;
      event.preventDefault();
      field.setAttribute('aria-invalid', 'true');
      tell(message, true);
      field.focus();
      return;
    }
    const direct = form.hasAttribute('data-async-signup') && typeof fetch === 'function' && typeof AbortController === 'function';
    if (direct) event.preventDefault();
    sending = true;
    button.setAttribute('aria-disabled', 'true');
    button.textContent = 'Sending your request…';
    form.setAttribute('aria-busy', 'true');
    tell('Sending your request. Please wait for the confirmation page.');
    slowRequest = window.setTimeout(() => {
      tell('This is taking longer than expected. If the page does not change, check your connection. For signup, check your email before trying again.');
    }, 15000);
    if (direct) void sendSignup();
  });
  window.addEventListener('pageshow', () => {
    window.clearTimeout(slowRequest);
    resetButton();
    feedback.hidden = true;
    if (password && toggle) {
      password.type = 'password';
      toggle.textContent = 'Show password';
      toggle.setAttribute('aria-pressed', 'false');
    }
  });
}
