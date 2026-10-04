'use client';

/**
 * Account (redesign handoff, § Account). It replaced a redirect to
 * `/checkout`, where the device list sat under the plans.
 *
 * Four cards: who you are, what access you have, where you are signed in, and
 * the ways out (the staff console for staff, and sign out).
 *
 * **Built from the handoff, with three things left out:**
 *
 * 1. The English and Amharic toggle. The product is English only, by the
 *    owner's decision, because the exam is sat in English.
 * 2. The Fayda status line. Identity checks were dropped.
 * 3. Editing the display name. The handoff has a field and a Save button; the
 *    API has no endpoint to change the name, so a field that looked editable
 *    would save nothing. The name is shown, the reason it exists is said, and
 *    `DISPLAY_NAME_EDITABLE` is the switch for when the endpoint lands (asked
 *    for in docs/HANDOFFS.md).
 *
 * Each card reads on its own and fails on its own: a slow device list must not
 * hide the access card a student came here to check.
 */
import { useCallback, useEffect, useState } from 'react';

import { Chip } from '../../components/Chip';
import { SignOutButton } from '../../components/SignOutButton';
import {
  api,
  refusalMessage,
  signInRequired,
  type DeviceEntry,
  type Identity,
} from '../../lib/api';
import { day, dayAndTime } from '../../lib/dates';
import { copy } from '../../lib/i18n';

/**
 * TODO(display name): there is no endpoint to change it.
 *
 * Asked for in docs/HANDOFFS.md (PATCH /me with { displayName }). Until it
 * exists the name is shown read only, with a sentence saying so.
 */
const DISPLAY_NAME_EDITABLE = false;

type Subscription = Awaited<ReturnType<typeof api.mySubscription>>;

export function AccountScreen() {
  const c = copy();
  const [me, setMe] = useState<Identity | null>(null);
  const [phone, setPhone] = useState<{ phone: string | null; verifiedAt: string | null } | null>(
    null,
  );
  const [subscription, setSubscription] = useState<Subscription | null>(null);

  useEffect(() => {
    let live = true;
    void (async () => {
      const [who, contact, sub] = await Promise.allSettled([
        api.me(),
        api.myContact(),
        api.mySubscription(),
      ]);
      if (!live) return;
      // Signed out is the one failure that has somewhere better to go.
      const refused = [who, contact, sub].find(
        (r) => r.status === 'rejected' && signInRequired(r.reason),
      );
      if (refused) {
        window.location.assign('/signin');
        return;
      }
      if (who.status === 'fulfilled') setMe(who.value);
      if (contact.status === 'fulfilled') setPhone(contact.value);
      if (sub.status === 'fulfilled') setSubscription(sub.value);
    })();
    return () => {
      live = false;
    };
  }, []);

  const name = me?.displayName ?? '';
  const initial = name.trim().charAt(0).toUpperCase();

  return (
    <div className="flex flex-col gap-5">
      <h1 className="font-display text-[clamp(26px,3vw,32px)] leading-[1.2] font-extrabold tracking-[-0.025em]">
        {c.account.pageTitle}
      </h1>

      {/* One column: Account sits on the 640px reading measure, and two cards
          side by side at that width wrapped every sentence in them. */}
      <div className="grid grid-cols-1 gap-4">
        {/* Who you are. */}
        <section className="border-border bg-surface rounded-card flex flex-col gap-5 border p-6">
          <h2 className="sr-only">{c.account.profileTitle}</h2>
          <div className="flex items-center gap-4">
            <span
              aria-hidden="true"
              className="bg-brand-soft text-link font-display grid size-14 shrink-0 place-items-center rounded-full text-[20px] font-extrabold"
            >
              {initial}
            </span>
            <div className="flex min-w-0 flex-col">
              <span className="font-display truncate text-[17px] font-bold">{name}</span>
              {phone?.phone ? (
                <span className="text-ink-3 num text-[14px]">
                  {phone.phone}
                  {phone.verifiedAt ? ` · ${c.account.phoneVerified}` : ''}
                </span>
              ) : null}
            </div>
          </div>

          <div className="flex flex-col gap-1.5">
            <span className="text-ink text-[14px] font-semibold">{c.account.displayNameLabel}</span>
            <span className="text-ink-2 text-[13px]">{c.account.displayNameWhy}</span>
            {DISPLAY_NAME_EDITABLE ? null : (
              <>
                {/* Plain text, not a field drawn to look like one: something
                    with an input's border invites a tap that does nothing. */}
                <span className="text-ink text-[15px] font-semibold">{name}</span>
                <span className="text-ink-3 text-[13px]">{c.account.displayNameFixed}</span>
              </>
            )}
          </div>
        </section>

        {/* What access you have, and the way to more of it. */}
        <AccessCard subscription={subscription} />
      </div>

      <DevicesCard />

      {/*
        The ways out. The student navigation has no staff link, so a reviewer
        who also practises lands here without one; the console is a press away
        rather than an address to remember.
      */}
      <section className="border-border bg-surface rounded-card flex flex-col gap-3 border p-6">
        {me?.staffRole ? (
          <a
            href={me.staffRole === 'PROVIDER' ? '/provider/activity' : '/admin/dashboard'}
            className="btn-ghost"
          >
            {me.staffRole === 'PROVIDER' ? c.account.staffConsoleProvider : c.account.staffConsole}
          </a>
        ) : null}
        <SignOutButton variant="danger" />
      </section>
    </div>
  );
}

/**
 * The access card: active, lapsed, or free, each with its own sentence and the
 * one button that moves it forward.
 *
 * Null until the subscription is read, and then still nothing if that read
 * failed: an access card that guesses is the one card on this page that would
 * be believed.
 */
function AccessCard({ subscription }: { subscription: Subscription | null }) {
  const c = copy();
  if (!subscription) {
    return (
      <section className="border-border bg-surface rounded-card flex flex-col gap-4 border p-6">
        <h2 className="font-display text-[18px] font-bold">{c.account.accessTitle}</h2>
        <p className="text-ink-2 text-[14px]">{c.account.devicesLoading}</p>
      </section>
    );
  }

  const active = subscription.active && subscription.expiresAt;
  const lapsed = !subscription.active && subscription.hasEverPaid && subscription.expiresAt;

  return (
    <section className="border-border bg-surface rounded-card flex flex-col gap-4 border p-6">
      <h2 className="font-display text-[18px] font-bold">{c.account.accessTitle}</h2>
      <div
        data-access={active ? 'active' : lapsed ? 'lapsed' : 'free'}
        className={`rounded-option flex flex-col gap-1 p-4 ${
          active ? 'bg-correct-soft' : lapsed ? 'bg-pending-soft' : 'bg-surface-2'
        }`}
      >
        <span
          className={`text-[16px] font-bold ${
            active ? 'text-correct-deep' : lapsed ? 'text-pending' : 'text-ink'
          }`}
        >
          {active
            ? c.account.accessActive(day(subscription.expiresAt!))
            : lapsed
              ? c.account.accessLapsed(day(subscription.expiresAt!))
              : c.account.accessFree}
        </span>
        <span className="text-ink-2 text-[14px]">
          {active
            ? c.account.accessActiveWhy
            : lapsed
              ? c.account.accessLapsedWhy
              : c.account.accessFreeWhy(subscription.freeRemaining)}
        </span>
      </div>
      {/* Money already sent, named by its reference: the thing somebody
          quotes when they ask where it went. */}
      {subscription.pendingClaim ? (
        <p className="text-ink-2 text-[14px]" data-pending-claim="">
          {copy().home.claimWaiting(subscription.pendingClaim.txRef)}
        </p>
      ) : null}
      <a href="/checkout" className={active ? 'btn-ghost' : 'btn-primary'}>
        {active ? c.account.extend : c.account.seePlans}
      </a>
    </section>
  );
}

type DevicesPhase =
  | { kind: 'loading' }
  | { kind: 'ready'; devices: DeviceEntry[]; maxDevices: number }
  | { kind: 'error'; message: string };

/**
 * Where this account is signed in (T-260), moved here from the foot of
 * `/checkout`, where it sat under the plans.
 *
 * "Log out" on every device except this one, the handoff's way: this one
 * signs out with the button at the foot of the page, and a "log out" beside
 * "This device" is the same action twice with two names. The cap comes from
 * the server, because school tracks get four.
 */
function DevicesCard() {
  const c = copy();
  const [phase, setPhase] = useState<DevicesPhase>({ kind: 'loading' });
  const [busy, setBusy] = useState<string | null>(null);
  const [problem, setProblem] = useState<string | null>(null);

  const load = useCallback(async (): Promise<void> => {
    try {
      const list = await api.devices();
      setPhase({ kind: 'ready', devices: list.devices, maxDevices: list.maxDevices });
    } catch (error) {
      if (signInRequired(error)) {
        window.location.assign('/signin');
        return;
      }
      setPhase({ kind: 'error', message: refusalMessage(error) ?? c.account.devicesFailed });
    }
  }, [c.account.devicesFailed]);

  useEffect(() => {
    void load();
  }, [load]);

  const revoke = async (id: string): Promise<void> => {
    setBusy(id);
    setProblem(null);
    try {
      await api.revokeDevice(id);
      await load();
    } catch (error) {
      setProblem(refusalMessage(error) ?? c.account.devicesFailed);
    } finally {
      setBusy(null);
    }
  };

  return (
    <section
      data-account-panel=""
      className="border-border bg-surface rounded-card flex flex-col gap-4 border p-6"
    >
      <div className="flex flex-col gap-1">
        <h2 className="font-display text-[18px] font-bold">{c.account.devicesTitleShort}</h2>
        {phase.kind === 'ready' ? (
          <p className="text-ink-2 text-[13px] leading-[19px]">
            {c.account.devicesIntro(phase.maxDevices)}
          </p>
        ) : null}
      </div>

      {phase.kind === 'loading' && (
        <p className="text-body text-ink-2">{c.account.devicesLoading}</p>
      )}
      {phase.kind === 'error' && <p className="text-caption text-wrong">{phase.message}</p>}

      {phase.kind === 'ready' &&
        (phase.devices.length === 0 ? (
          <p className="text-body text-ink-2">{c.account.noDevices}</p>
        ) : (
          <ul className="divide-border flex flex-col divide-y">
            {phase.devices.map((device) => (
              <li
                key={device.id}
                data-device=""
                data-current={device.isCurrent}
                className="flex min-h-14 flex-wrap items-center gap-3 py-2"
              >
                <span className="flex min-w-0 flex-1 flex-col gap-0.5">
                  <span className="text-ink text-[14px] font-semibold">
                    {device.deviceLabel ?? c.account.unknownDevice}
                  </span>
                  <span className="text-ink-3 num text-[12px]">
                    {c.account.lastSeen(dayAndTime(device.lastSeenAt))}
                  </span>
                </span>
                {device.isCurrent ? (
                  <Chip tone="brand">{c.account.thisDevice}</Chip>
                ) : (
                  <button
                    type="button"
                    className="btn-ghost w-auto px-4"
                    disabled={busy === device.id}
                    onClick={() => void revoke(device.id)}
                  >
                    {busy === device.id ? c.account.revoking : c.account.logOutDevice}
                  </button>
                )}
              </li>
            ))}
          </ul>
        ))}

      {problem && <p className="text-caption text-wrong">{problem}</p>}
    </section>
  );
}
