/**
 * The one place that talks to Chapa over the network (T-142).
 *
 * Everything about the *protocol* — references, signatures, what counts as a
 * success — lives in `chapa.ts` and is tested without a socket. This file is
 * only transport: build a request, read a response, fail clearly. Keeping the
 * split means the security-critical parts are testable and the untestable part
 * is small enough to read.
 */
import { Inject, Injectable, ServiceUnavailableException } from '@nestjs/common';

import { CHAPA_DIRECT_TYPE, type DirectChannel } from './chapa';

const CHAPA_BASE_URL = 'https://api.chapa.co/v1';

/** How long we wait for Chapa before telling the student to try again. */
const TIMEOUT_MS = 15_000;

export const CHAPA_GATEWAY = Symbol('CHAPA_GATEWAY');

export interface DirectChargeInput {
  channel: DirectChannel;
  amountEtb: number;
  txRef: string;
  /** The handset that will receive the USSD push. */
  mobile: string;
  firstName?: string | undefined;
}

export interface HostedCheckoutInput {
  amountEtb: number;
  txRef: string;
  returnUrl: string;
  callbackUrl: string;
  firstName?: string | undefined;
  email?: string | undefined;
}

/** What Chapa says about a transaction when asked directly. */
export interface VerifiedCharge {
  txRef: string;
  status: string;
  amount: number | string;
  currency?: string | undefined;
  reference?: string | undefined;
  method?: string | undefined;
}

export interface ChapaGateway {
  /** Sends a USSD push to the student's handset. Returns once Chapa accepts it. */
  directCharge(input: DirectChargeInput): Promise<{ reference?: string | undefined }>;
  /** Creates a hosted checkout and returns the page to send the student to. */
  hostedCheckout(input: HostedCheckoutInput): Promise<{ checkoutUrl: string }>;
  /** Asks Chapa what really happened. `null` if it has never heard of the ref. */
  verify(txRef: string): Promise<VerifiedCharge | null>;
}

@Injectable()
export class HttpChapaGateway implements ChapaGateway {
  /**
   * Read at call time, not at construction.
   *
   * The API boots in environments that will never take a payment — tests, the
   * bot's own process — and a constructor that threw on a missing key would stop
   * all of them. Refusing at the point of use is the same protection, later.
   */
  private get secretKey(): string {
    return process.env.CHAPA_SECRET_KEY ?? '';
  }

  async directCharge(input: DirectChargeInput): Promise<{ reference?: string | undefined }> {
    const type = CHAPA_DIRECT_TYPE[input.channel];
    const body = new FormData();
    body.set('amount', String(input.amountEtb));
    // Chapa's direct charge is ETB only. Sending anything else is a 400 with a
    // message about currency, which is a confusing way to learn this.
    body.set('currency', 'ETB');
    body.set('tx_ref', input.txRef);
    body.set('mobile', input.mobile);
    if (input.firstName) body.set('first_name', input.firstName);

    const payload = await this.call(`/charges?type=${type}`, { method: 'POST', body });
    const data = asRecord(payload['data']);
    return { reference: stringOrUndefined(data['reference'] ?? data['ref_id']) };
  }

  async hostedCheckout(input: HostedCheckoutInput): Promise<{ checkoutUrl: string }> {
    const payload = await this.call('/transaction/initialize', {
      method: 'POST',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify({
        amount: String(input.amountEtb),
        currency: 'ETB',
        tx_ref: input.txRef,
        // Where the student lands, and where Chapa tells *us* — two different
        // things. `return_url` is a browser redirect the student controls and
        // can never be trusted to mean payment; `callback_url` is the webhook.
        return_url: input.returnUrl,
        callback_url: input.callbackUrl,
        ...(input.firstName ? { first_name: input.firstName } : {}),
        ...(input.email ? { email: input.email } : {}),
      }),
    });

    const checkoutUrl = stringOrUndefined(asRecord(payload['data'])['checkout_url']);
    if (!checkoutUrl) {
      throw new ServiceUnavailableException({
        error: 'CHAPA_UNAVAILABLE',
        message: 'Payment could not be started. Please try again.',
      });
    }
    return { checkoutUrl };
  }

  /**
   * The authoritative answer.
   *
   * **Called before access is granted, even when a signed webhook already said
   * so** (T-144). Chapa's own documentation asks for this, and the reason is
   * that a webhook is a message about a transaction while this is the
   * transaction — if the two ever disagree, this one is right.
   */
  async verify(txRef: string): Promise<VerifiedCharge | null> {
    let payload: Record<string, unknown>;
    try {
      payload = await this.call(`/transaction/verify/${encodeURIComponent(txRef)}`, {
        method: 'GET',
      });
    } catch (error) {
      // A reference Chapa has never seen is a 404, and that is an answer — "no
      // such payment" — not an outage. Anything else stays an outage.
      if (error instanceof ChapaHttpError && error.status === 404) return null;
      throw error;
    }

    const data = asRecord(payload['data']);
    if (Object.keys(data).length === 0) return null;

    return {
      txRef: stringOrUndefined(data['tx_ref']) ?? txRef,
      status: stringOrUndefined(data['status']) ?? '',
      amount: (data['amount'] as number | string | undefined) ?? 0,
      currency: stringOrUndefined(data['currency']),
      reference: stringOrUndefined(data['reference']),
      method: stringOrUndefined(data['method'] ?? data['payment_method']),
    };
  }

  private async call(path: string, init: RequestInit): Promise<Record<string, unknown>> {
    if (this.secretKey.length === 0) {
      // Loud, not silent. An unconfigured gateway that pretended to work would
      // be a checkout that takes no money and grants access anyway.
      throw new ServiceUnavailableException({
        error: 'CHAPA_NOT_CONFIGURED',
        message: 'Card and wallet payments are not available right now.',
      });
    }

    let response: Response;
    try {
      response = await fetch(`${CHAPA_BASE_URL}${path}`, {
        ...init,
        headers: { ...init.headers, authorization: `Bearer ${this.secretKey}` },
        signal: AbortSignal.timeout(TIMEOUT_MS),
      });
    } catch {
      // Deliberately swallows the cause: a fetch error can carry the request
      // URL, and the URL is not where the key is, but the habit of logging the
      // whole error object is how keys end up in logs.
      throw new ServiceUnavailableException({
        error: 'CHAPA_UNREACHABLE',
        message: 'Payment could not be started. Please try again.',
      });
    }

    const payload = await readJson(response);
    if (!response.ok) {
      throw new ChapaHttpError(response.status, stringOrUndefined(payload['message']));
    }
    return payload;
  }
}

/** A non-2xx from Chapa, carrying the status so 404 can be told from a fault. */
export class ChapaHttpError extends Error {
  constructor(
    readonly status: number,
    message?: string | undefined,
  ) {
    super(message ?? `Chapa responded ${status}`);
    this.name = 'ChapaHttpError';
  }
}

async function readJson(response: Response): Promise<Record<string, unknown>> {
  try {
    return asRecord(await response.json());
  } catch {
    // Chapa has been known to return an HTML error page. Treat it as empty
    // rather than letting a parse error surface as a 500 with a stack trace.
    return {};
  }
}

function asRecord(value: unknown): Record<string, unknown> {
  return typeof value === 'object' && value !== null && !Array.isArray(value)
    ? (value as Record<string, unknown>)
    : {};
}

function stringOrUndefined(value: unknown): string | undefined {
  return typeof value === 'string' && value.length > 0 ? value : undefined;
}

/** Injects the gateway without every consumer importing the HTTP one. */
export const CHAPA_GATEWAY_PROVIDER = {
  provide: CHAPA_GATEWAY,
  useClass: HttpChapaGateway,
};

export const InjectChapa = (): ParameterDecorator => Inject(CHAPA_GATEWAY);
