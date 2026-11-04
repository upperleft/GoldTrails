for (const select of document.querySelectorAll('[data-creator-email-select]')) {
  const form = select.closest('form');
  const email = form?.querySelector('[data-creator-invitation-email]');
  const hint = form?.querySelector('[data-creator-email-source]');
  if (!email || !hint) continue;

  select.addEventListener('change', () => {
    const option = select.selectedOptions[0];
    const address = option?.dataset.contactEmail || '';
    const source = option?.dataset.contactSource || '';
    email.value = address;
    hint.textContent = !select.value
      ? 'Choose a creator to show the available contact email. You can edit this address.'
      : address
        ? `${source ? `Source: ${source}. ` : ''}Review this address before creating an invitation. You can edit it.`
        : 'No email has been researched for this creator. Enter their preferred account email.';
  });
}
