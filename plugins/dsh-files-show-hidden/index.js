/**
 * Host half of `dsh-files-show-hidden`.
 *
 * The feature is entirely browser-side: a header toggle on the files page that
 * flips the file browser's own hidden-entry preference. This row only keeps the
 * package in the Client boot graph, so `apply` has nothing to register.
 */
export function apply() {}
