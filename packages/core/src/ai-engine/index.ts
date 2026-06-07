/**
 * AI Engine — Unified Free AI Provider Router
 *
 * Re-exports the public surface of the unlimited engine so that downstream
 * packages can import from a stable, explicit list instead of relying on
 * wildcard re-exports (which can cause circular references and ambiguity
 * when the package's own router also depends on the engine).
 */

export {
  type ProviderId,
  type ModelRequest,
  type ModelResponse,
  type ProviderHealth,
  routeUnlimited,
  checkProviderHealth,
} from "./router.js";
