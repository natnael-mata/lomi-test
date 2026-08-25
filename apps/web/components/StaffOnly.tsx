'use client';

/**
 * One door in front of every staff screen (T-225).
 *
 * **The server always held the line, and the client drew the tool anyway.** QA
 * signed in as an ordinary student, opened `/admin/import`, and got the complete
 * upload form — file picker, paste box, Upload button — which failed only on
 * submit. `/admin/users` was worse: the whole Students tool rendered, heading
 * and all, with a working search box, and the 403 that came back from the search
 * was displayed as "Nobody matched that." Nothing leaked, because every admin
 * API returns 403 and always did. But a student was shown an administrative
 * console for their own product, invited to type into it, and then told the
 * database was empty.
 *
 * Two separate wrongs there, and this fixes the first: **do not render a control
 * that cannot work.** A screen whose every button is a 403 is not a security
 * boundary, it is a lie about what this person can do.
 *
 * The refusal it renders is a real page — heading, explanation, a way back —
 * rather than the bare API sentence on a blank background, which is what the
 * pages that did check were showing.
 */
import { useEffect, useState } from 'react';

import { Card } from './Card';
import { api } from '../lib/api';
import { copy } from '../lib/i18n';

export type StaffRole = 'REVIEWER' | 'ADMIN' | 'PROVIDER';

/**
 * Who outranks whom.
 *
 * A provider is an admin plus the operational screens, and an admin is a
 * reviewer plus everything else — so this is a ladder rather than a set, and a
 * screen asks for the *lowest* role that may use it. Getting this backwards
 * locks admins out of admin screens, which is why it is one table and not a
 * comparison written out at each call site.
 */
const RANK: Record<StaffRole, number> = { REVIEWER: 1, ADMIN: 2, PROVIDER: 3 };

export function StaffOnly({
  need,
  children,
}: {
  /** The lowest role that may use this screen. */
  need: StaffRole;
  children: React.ReactNode;
}) {
  const c = copy();
  /** `undefined` while the answer is in flight, `null` for "not staff at all". */
  const [role, setRole] = useState<StaffRole | null | undefined>(undefined);

  useEffect(() => {
    let alive = true;
    void (async () => {
      try {
        const held = await api.myStaffRole();
        if (alive) setRole(held.role);
      } catch {
        // A failure to ask is not permission. Anything that is not a clear yes
        // is treated as no, so a server that is down cannot open a door.
        if (alive) setRole(null);
      }
    })();
    return () => {
      alive = false;
    };
  }, []);

  /*
   * Nothing at all while the answer is in flight.
   *
   * Deliberately not a spinner or a skeleton of the tool: both flash the shape
   * of an administrative console at somebody who is about to be refused, and on
   * a slow connection that flash is the whole screen for a second.
   */
  if (role === undefined) return null;

  if (role === null || RANK[role] < RANK[need]) {
    /*
     * The tab says so too.
     *
     * `metadata.title` is set per route and is right for the page the route is
     * *for* — but a refused student sat on a browser tab reading "Upload
     * questions · admin", which describes a screen they were explicitly not
     * being shown. QA noticed it, and on a phone with several tabs open the
     * title is most of what somebody has to go on.
     */
    return (
      <div className="flex flex-col gap-4">
        <title>{c.staff.refusedTitle}</title>
        <header className="flex flex-col gap-1">
          <h1 className="text-title">{c.staff.refusedTitle}</h1>
          <p className="text-body text-ink-2">{c.staff.refusedBody}</p>
        </header>
        <Card as="section" className="flex flex-col gap-3">
          {/* Somewhere to go. The refusals QA found were a single grey sentence
              on an otherwise empty page with no navigation on it at all — a dead
              end in a product the person is a paying student of. */}
          <a href="/home" className="btn-primary self-start">
            {c.staff.refusedHome}
          </a>
        </Card>
      </div>
    );
  }

  return <>{children}</>;
}
