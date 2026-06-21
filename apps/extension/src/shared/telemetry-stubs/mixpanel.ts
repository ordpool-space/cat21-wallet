/**
 * HACK -- Cat21 (audit C1): no-op replacement for `mixpanel-browser`.
 * Cat21 Wallet ships zero telemetry per PRIVACY-POLICY.md.
 *
 * Wired via webpack's `resolve.alias`. Zero bytes from the real
 * `mixpanel-browser` package ship in the production bundle.
 */
function noop() {
  /* see file header */
}

const noopPeople = {
  set: noop,
  set_once: noop,
  unset: noop,
  increment: noop,
  append: noop,
  union: noop,
  remove: noop,
  delete_user: noop,
  track_charge: noop,
  clear_charges: noop,
};

export const noopMixpanel = {
  init: noop,
  track: noop,
  track_pageview: noop,
  identify(_id?: string): Promise<void> {
    return Promise.resolve();
  },
  reset: noop,
  register: noop,
  register_once: noop,
  unregister: noop,
  alias: noop,
  set_group: noop,
  get_group: () => ({
    set: noop,
    set_once: noop,
    unset: noop,
    remove: noop,
    union: noop,
  }),
  add_group: noop,
  remove_group: noop,
  people: noopPeople,
  get_property: () => undefined,
  has_opted_in_tracking: () => false,
  has_opted_out_tracking: () => true,
  opt_in_tracking: noop,
  opt_out_tracking: noop,
  get_distinct_id: () => '',
  // The `OverridedMixpanel` type extends `Mixpanel` with `.people`
  // typed differently; we keep both paths covered.
  start_session_recording: noop,
  stop_session_recording: noop,
  pause_session_recording: noop,
  resume_session_recording: noop,
};

// `mixpanel-browser` exports a default that is the global client.
export default noopMixpanel;
