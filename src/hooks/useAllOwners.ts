import { useMemo } from 'react';
import { useAppContext } from '../context/AppContext';

/**
 * Deduplicated, sorted list of ALL owner names across every role.
 * Sources: 1) every non-admin user's ownerName  2) legacy adminOptions lists.
 * Adding any new user in Admin Panel → they instantly appear in every dropdown.
 */
export function useAllOwners(): string[] {
  const { users, adminOptions, currentUser } = useAppContext();
  return useMemo(() => {
    const fromUsers = users
      .filter(u => u.role !== 'admin' && u.ownerName?.trim())
      .map(u => u.ownerName.trim());
    const fromLists = [
      ...adminOptions.seoOwners,
      ...adminOptions.contentOwners,
      ...adminOptions.webOwners,
    ];
    const fromCurrent = currentUser?.ownerName?.trim() ? [currentUser.ownerName.trim()] : [];
    return Array.from(new Set([...fromCurrent, ...fromUsers, ...fromLists]))
      .filter(Boolean)
      .sort((a, b) => a.localeCompare(b));
  }, [users, adminOptions, currentUser]);
}
