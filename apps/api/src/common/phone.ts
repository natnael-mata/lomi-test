/**
 * Ethiopian mobile numbers, normalised (T-262).
 *
 * **Moved here from `payments/chapa.ts`, unchanged.** It was written for a
 * checkout — the form Chapa's direct charge expects — and it is now the shape of
 * a student's *identity*: the phone number is the username, so the same string
 * has to come back the same way whether it was typed at sign-up, at sign-in, or
 * into a payment form six months later. A normaliser that lives in the payments
 * module and is also the primary key of the account is a normaliser that will
 * one day be forked.
 */

/**
 * An Ethiopian mobile number in the form Chapa's direct charge expects.
 *
 * People write their number every way there is: `0911223344`, `+251911223344`,
 * `251 91 122 33 44`, with hyphens, with a leading `00`. All of those are the
 * same handset, and refusing four of the five would be a checkout that fails for
 * reasons nobody can see. Normalised to the local ten-digit form (`09…`/`07…`)
 * because that is what Chapa's examples use.
 *
 * Returns `null` rather than a best guess when it is not a mobile number at all
 * — a landline or a mistyped digit should stop the purchase here, not produce a
 * USSD push to a stranger.
 */
export function normaliseEthiopianMobile(input: string): string | null {
  const digits = input.replace(/[^\d]/g, '').replace(/^00/, '');
  const local = digits.startsWith('251')
    ? `0${digits.slice(3)}`
    : digits.startsWith('9') || digits.startsWith('7')
      ? `0${digits}`
      : digits;

  return /^0[97]\d{8}$/.test(local) ? local : null;
}
