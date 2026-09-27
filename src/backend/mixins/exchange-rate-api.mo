// Public API surface for the USD -> PLN exchange-rate feature.
//
// The mixin receives the cached rate as a shared mutable record so its reads
// and the refresh path's writes observe the same value. It declares no stable
// state of its own.
import AccessControl "mo:caffeineai-authorization/access-control";
import ExchangeRateLib "../lib/exchange-rate";
import OutCall "mo:caffeineai-http-outcalls/outcall";
import Runtime "mo:core/Runtime";
import Types "../types/exchange-rate";

mixin (
  exchangeRate : { var value : Types.ExchangeRate },
  accessControlState : AccessControl.AccessControlState,
  transform : OutCall.Transform,
) {
  // Any authenticated user: the cached USD -> PLN rate plus provenance.
  // Returns null for an unauthenticated caller or when no rate has ever been
  // cached. `lastError` is null on the most recent successful fetch, or the
  // recorded failure text when the last fetch failed (the returned `rate` is
  // then the last successfully cached value).
  public query ({ caller }) func getExchangeRate() : async ?Types.ExchangeRate {
    if (not (AccessControl.hasPermission(accessControlState, caller, #user))) {
      return null;
    };
    let value = exchangeRate.value;
    if (value.lastUpdated == 0 and value.rate == 0.0) {
      return null;
    };
    ?value;
  };

  // Any authenticated user: fetch the current USD -> PLN rate and cache it.
  // Never traps on network or parse failure — the failure is recorded in the
  // cached record's `lastError` and the previously cached rate is preserved.
  public shared ({ caller }) func refreshExchangeRate() : async Types.ExchangeRate {
    if (not (AccessControl.hasPermission(accessControlState, caller, #user))) {
      Runtime.trap("Unauthorized: Only authenticated users can refresh the exchange rate.");
    };
    let next = await ExchangeRateLib.refresh(exchangeRate.value, transform);
    exchangeRate.value := next;
    next;
  };
};
