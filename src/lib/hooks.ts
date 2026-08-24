"use client";

import { useState, useSyncExternalStore } from "react";
import { monthKey } from "./format";

/* -------------------------------------------------------------------------
   The clock and the media-query list are both *external mutable sources*.
   Reading them with useSyncExternalStore keeps render pure and avoids the
   setState-in-effect cascade that a useEffect version would cause.
   ------------------------------------------------------------------------- */

const noopSubscribe = () => () => {};

/** Placeholder rendered on the server; never visible, pages gate on hydration. */
const SERVER_MONTH = "1970-01";
const getMonthSnapshot = () => monthKey(new Date());
const getServerMonthSnapshot = () => SERVER_MONTH;

/**
 * Month selector state that is safe under static prerendering.
 *
 * Every page here is prerendered at build time, so a `new Date()` read during
 * render would otherwise freeze at the build date for every visitor.
 */
export function useCurrentMonth(): [string, (key: string) => void] {
  const live = useSyncExternalStore(noopSubscribe, getMonthSnapshot, getServerMonthSnapshot);
  const [override, setOverride] = useState<string | null>(null);
  return [override ?? live, setOverride];
}

const getTrue = () => true;
const getFalse = () => false;

/**
 * False on the server *and* during the hydration pass, true afterwards.
 *
 * Needed before `createPortal` — a portal appends to document.body, which the
 * server never rendered, so mounting one during hydration is a mismatch.
 */
export function useMounted(): boolean {
  return useSyncExternalStore(noopSubscribe, getTrue, getFalse);
}

const MOTION_QUERY = "(prefers-reduced-motion: reduce)";

function subscribeMotion(onChange: () => void) {
  const mq = window.matchMedia(MOTION_QUERY);
  mq.addEventListener("change", onChange);
  return () => mq.removeEventListener("change", onChange);
}

const getMotionSnapshot = () => window.matchMedia(MOTION_QUERY).matches;
const getServerMotionSnapshot = () => false;

/**
 * CSS transitions already collapse under `prefers-reduced-motion` (see
 * globals.css). This is for the JS-driven animations — count-ups and the ring
 * sweep — that CSS can't reach.
 */
export function useReducedMotion(): boolean {
  return useSyncExternalStore(subscribeMotion, getMotionSnapshot, getServerMotionSnapshot);
}
