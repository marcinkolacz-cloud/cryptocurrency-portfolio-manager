// Domain types for the USD -> PLN exchange-rate feature.
//
// The rate is a display-layer conversion factor only: every stored monetary
// value stays USD-denominated, and the frontend multiplies by this rate to
// render the PLN equivalent beneath each USD value. No P&L or cost-basis
// calculation reads these types.
module {
  // Cached USD -> PLN exchange rate plus its provenance.
  //
  // `rate` is the number of PLN per 1 USD (e.g. 3.65). `lastUpdated` is the
  // Int nanosecond timestamp at which the rate was fetched and cached
  // (`Time.now()`), or 0 when no rate has ever been fetched. `sourceTimestamp`
  // is the provider's own `time_last_update_unix` value converted to
  // nanoseconds, or 0 when absent. `lastError` is null on the most recent
  // successful fetch, or the recorded failure text when the last fetch failed
  // (in which case `rate` still holds the last successfully cached value).
  public type ExchangeRate = {
    rate : Float;
    lastUpdated : Int;
    sourceTimestamp : Int;
    lastError : ?Text;
  };
};
