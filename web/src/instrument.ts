/**
 * Sentry initialisation, isolated so it runs before anything that touches the
 * SDK at module scope.
 *
 * `App.tsx` calls `Sentry.wrapReactRouterRouting(Routes)` while its module body
 * evaluates, and ESM evaluates imported modules before the importing module's
 * statements — so calling `initMonitoring()` from main.tsx's body was always
 * too late. The wrapper found no router integration registered yet and returned
 * `Routes` untouched, which fails silently: no navigation transactions, and
 * pageloads named by raw URL (`/faction/mla/unit/tank`) instead of the
 * parameterised route, so every unit page became its own transaction.
 *
 * main.tsx must import this module before './App.tsx'. There is a test in
 * src/__tests__/instrumentOrder.test.ts pinning that order, because nothing
 * else fails when it regresses.
 */
import { initMonitoring } from '@/lib/monitoring'

initMonitoring()
