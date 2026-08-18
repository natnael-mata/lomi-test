/**
 * Capturing a phone number the way Telegram can vouch for (T-078a).
 *
 * A student pays by telebirr or CBE Birr with a number that has to be theirs.
 * Typing it into a form proves nothing — a typo sends the push to a stranger's
 * handset, and a deliberate entry sends it to an accomplice's. Telegram's
 * `request_contact` button is the one channel where the number arrives with the
 * platform's own assertion of whose it is.
 *
 * **The whole security of it is one comparison**, and it is the reason this file
 * exists rather than the check being inlined at the handler:
 *
 * > A contact message carries `user_id` only when the contact is a Telegram
 * > account. When somebody taps the button, Telegram sends *their own* contact
 * > and `user_id` equals the sender. When somebody instead shares a contact out
 * > of their address book — which the same message type carries — `user_id` is
 * > either absent or somebody else's.
 *
 * So a shared contact is indistinguishable from a tapped one except by that
 * field. Without the comparison, "verified phone" means "a number this student
 * had in their phone book", which is worse than an unverified one because it
 * carries a claim.
 *
 * **Asked for at checkout, not at sign-up.** A permission prompt before
 * somebody has seen anything worth paying for is a permission prompt they
 * decline; asked at the moment it has a purpose, it is a button that saves them
 * typing.
 */

/** The shape Telegram sends. Only the fields this decision needs. */
export interface TelegramContact {
  phone_number?: string | undefined;
  user_id?: number | string | undefined;
}

export interface ContactMessage {
  from?: { id: number | string } | undefined;
  contact?: TelegramContact | undefined;
}

export type ContactOutcome =
  | { ok: true; phone: string }
  /**
   * Why it was refused, as a code rather than a sentence.
   *
   * The bot turns these into copy; the API logs them. A refusal that only
   * exists as an English string cannot be counted, and "how often does somebody
   * share the wrong contact" is a question worth being able to answer.
   */
  | { ok: false; reason: 'no-contact' | 'not-own-contact' | 'no-number' };

/**
 * Whether this message carries a number Telegram vouches for.
 *
 * Compared as strings. Telegram ids exceed 2^32 and arrive as numbers in JSON,
 * so a strict `===` between a number and the string form of the same id is
 * false — and the failure would be silent acceptance of nothing rather than
 * acceptance of something wrong, which is how it would survive review.
 */
export function verifiedContact(message: ContactMessage): ContactOutcome {
  const contact = message.contact;
  if (!contact) return { ok: false, reason: 'no-contact' };

  const sender = message.from?.id;
  const owner = contact.user_id;

  // Absent `user_id` fails here, not by falling through: a contact with no
  // account behind it is exactly the address-book entry this rejects.
  if (sender === undefined || owner === undefined) return { ok: false, reason: 'not-own-contact' };
  if (String(owner) !== String(sender)) return { ok: false, reason: 'not-own-contact' };

  const phone = (contact.phone_number ?? '').trim();
  if (phone.length === 0) return { ok: false, reason: 'no-number' };

  return { ok: true, phone };
}

/** What the bot says when it asks. Names why, because the ask is a permission. */
export const ASK_TEXT = [
  'To pay with telebirr or CBE Birr we send the request to your phone.',
  '',
  'Tap the button below and Telegram shares your number with us — you will not have to type it,',
  'and the payment request cannot go to the wrong handset.',
  '',
  'You can pay by bank transfer instead without sharing anything.',
].join('\n');

export const ASK_BUTTON = 'Share my number';

/** What it says when the number arrives. */
export function acceptedText(phone: string): string {
  return `Thank you. We will send payment requests to ${phone}.`;
}

/**
 * What it says when a contact arrives that is not the sender's.
 *
 * Written as a mistake rather than as an accusation. Sharing the wrong contact
 * is one tap away from sharing the right one, and the overwhelming majority of
 * the people who do it meant the other thing.
 */
export const NOT_OWN_TEXT = [
  'That is somebody else’s number, so we have not saved it.',
  '',
  'Use the button rather than picking a contact from your list — the button sends your own',
  'number and nothing else.',
].join('\n');

export const NO_NUMBER_TEXT = 'That contact arrived without a number on it. Try the button again.';
