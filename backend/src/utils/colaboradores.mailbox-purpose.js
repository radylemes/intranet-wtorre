const NON_PERSON_MAILBOX_PURPOSES = new Set(['shared', 'room', 'equipment']);

function normalizeMailboxUserPurpose(raw) {
  if (!raw) return null;
  if (typeof raw === 'string') return raw.toLowerCase();
  if (typeof raw.value === 'string') return raw.value.toLowerCase();
  return null;
}

function isNonPersonMailboxPurpose(purpose) {
  const normalized = normalizeMailboxUserPurpose(purpose);
  return normalized ? NON_PERSON_MAILBOX_PURPOSES.has(normalized) : false;
}

function isPersonMailboxPurpose(purpose) {
  const normalized = normalizeMailboxUserPurpose(purpose);
  if (!normalized) return false;
  return normalized === 'user' || normalized === 'linked';
}

module.exports = {
  NON_PERSON_MAILBOX_PURPOSES,
  normalizeMailboxUserPurpose,
  isNonPersonMailboxPurpose,
  isPersonMailboxPurpose,
};
