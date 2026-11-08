/**
 * Order status state machine (kept short so restaurants tap as little as possible).
 *
 * delivery: pending -> preparing -> out_for_delivery -> delivered -> completed
 * pickup:   pending -> preparing -> ready_for_pickup -> completed
 *
 * Restaurant: accepts (pending -> preparing) or rejects (pending -> cancelled),
 *             then hands the order to a courier / marks it ready for pickup (and "picked up" for pickup orders).
 * Courier:    takes a delivery and marks it delivered (out_for_delivery -> delivered). Only the courier can do this.
 * System (automatic, see orderService.autoProgress):
 *             delivered / ready_for_pickup -> completed after a while,
 *             pending with no answer -> cancelled + refunded.
 * Customer:   only cancels while pending (people rarely confirm receipt, so delivery ends with the courier's
 *             "Delivered" and the order completes automatically a few minutes later).
 * Admin:      not part of the normal flow; may cancel an active order in exceptional cases.
 *
 * 'accepted' stays in the database enum for older orders but is no longer used.
 */
const STATUSES = ['pending', 'accepted', 'preparing', 'ready_for_pickup', 'out_for_delivery', 'delivered', 'completed', 'cancelled'];
const TERMINAL = ['completed', 'cancelled'];

const FLOW = {
  delivery: { pending: 'preparing', accepted: 'preparing', preparing: 'out_for_delivery', out_for_delivery: 'delivered', delivered: 'completed' },
  pickup: { pending: 'preparing', accepted: 'preparing', preparing: 'ready_for_pickup', ready_for_pickup: 'completed' },
};

/**
 * @param {string} from current status
 * @param {string} to requested status
 * @param {string} role customer | manager | admin
 * @param {string} type delivery | pickup
 */
function canTransition(from, to, role, type = 'delivery') {
  if (TERMINAL.includes(from) || from === to) return false;
  const forward = FLOW[type]?.[from] === to;
  switch (role) {
    case 'customer':
      return from === 'pending' && to === 'cancelled';
    case 'manager':
      if (to === 'delivered' || (type === 'delivery' && to === 'completed')) return false; // the courier / the system do this
      return forward || (from === 'pending' && to === 'cancelled'); // accept or reject a new order
    case 'courier':
      return type === 'delivery' && from === 'out_for_delivery' && to === 'delivered';
    case 'admin':
      return to === 'cancelled'; // exceptional cases only
    default:
      return false;
  }
}

/** Statuses a role can move an order to from its current status (used by the UI). */
function allowedNext(from, role, type) {
  return STATUSES.filter((to) => canTransition(from, to, role, type));
}

module.exports = { STATUSES, TERMINAL, FLOW, canTransition, allowedNext };
