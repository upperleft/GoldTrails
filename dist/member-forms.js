// Progressive enhancement: ordinary HTML form submission still works without JavaScript.
for (const form of document.querySelectorAll('.member-form')) {
  if (form.closest('fieldset[disabled]')) continue;
  const feedback = form.querySelector('.member-form-feedback');
  const button = form.querySelector('button[type="submit"]');
  if (!feedback || !button) continue;
  const originalLabel = button.textContent;
  let sending = false;
  let slowRequest;
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
    if (field.type === 'password' && (field.value.length < 15 || field.value.length > 128)) return 'Your password needs 15–128 characters. A longer phrase can be easier to remember.';
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
    sending = true;
    button.setAttribute('aria-disabled', 'true');
    button.textContent = 'Sending your request…';
    form.setAttribute('aria-busy', 'true');
    tell('Sending your request. Please wait for the confirmation page.');
    slowRequest = window.setTimeout(() => {
      tell('This is taking longer than expected. If the page does not change, check your connection. For signup, check your email before trying again.');
    }, 20000);
  });
  window.addEventListener('pageshow', () => {
    window.clearTimeout(slowRequest);
    sending = false;
    button.removeAttribute('aria-disabled');
    button.textContent = originalLabel;
    form.removeAttribute('aria-busy');
    feedback.hidden = true;
  });
}
