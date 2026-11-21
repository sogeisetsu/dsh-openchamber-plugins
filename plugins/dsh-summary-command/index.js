/**
 * dsh-summary-command — Host half is intentionally empty.
 *
 * The `/summary` command lives entirely on the Client (`client.js`): its menu
 * row needs a localized label, a localized description and an icon, and only a
 * Client-side `/` trigger source can own those. The Host row therefore exists
 * solely so the package enters the Web boot graph.
 *
 * @module dsh-summary-command
 */

/** No Host-side registration. */
export function apply() {}
