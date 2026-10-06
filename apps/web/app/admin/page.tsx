'use client';

/**
 * `/admin` on its own: the first screen this person's role can open.
 *
 * Client side because the role is read with the session cookie, and the staff
 * guard on the destination still decides who gets in. Somebody without a role
 * lands on the dashboard and meets that guard's own message.
 */
import { useEffect } from 'react';

import { api } from '../../lib/api';
import { staffHome } from '../../lib/staff-home';

export default function AdminHome() {
  useEffect(() => {
    void api
      .myStaffRole()
      .then(({ role }) => staffHome(role))
      .catch(() => null)
      .then((home) => window.location.replace(home ?? '/admin/dashboard'));
  }, []);
  return null;
}
