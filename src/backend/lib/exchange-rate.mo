// Domain logic for the USD -> PLN exchange-rate feature.
//
// This module owns the HTTP outcall to the public no-key rates API and the
// canonicalization of its response. It is stateless: the caller (main.mo)
// passes in the current cached rate and receives the next cached value, so the
// stable var stays in the composition root.
import Float "mo:core/Float";
import Json "mo:json";
import OutCall "mo:caffeineai-http-outcalls/outcall";
import Text "mo:core/Text";
import Time "mo:core/Time";
import Types "../types/exchange-rate";

module {
  // The public no-key rates endpoint. Returns a JSON object whose `rates` map
  // carries one entry per currency; we read `rates.PLN`.
  public let ratesUrl : Text = "https://open.er-api.com/v6/latest/USD";

  // Read a numeric field from a Json object as Float (int promoted to Float),
  // or 0.0 if absent/wrong type.
  func _getFloat(json : Json.Json, path : Text) : Float {
    switch (Json.get(json, path)) {
      case (?(#number(#float(n)))) { n };
      case (?(#number(#int(n)))) { n.toFloat() };
      case _ { 0.0 };
    };
  };

  // Read a string field from a Json object, or "" if absent/wrong type.
  func _getText(json : Json.Json, path : Text) : Text {
    switch (Json.get(json, path)) {
      case (?(#string(s))) { s };
      case _ { "" };
    };
  };

  // Fetch the current USD -> PLN rate and return the next cached ExchangeRate.
  //
  // `previous` is the currently cached value. On success the returned record
  // carries the fresh rate, `lastUpdated = Time.now()`, the provider's
  // `time_last_update_unix` (converted to nanoseconds) as `sourceTimestamp`,
  // and `lastError = null`. On any failure (outcall trap, parse failure,
  // provider error, missing/zero PLN rate) the returned record keeps
  // `previous.rate` and `previous.sourceTimestamp` and records the failure in
  // `lastError` with a fresh `lastUpdated`. Never traps.
  public func refresh(previous : Types.ExchangeRate, transform : OutCall.Transform) : async Types.ExchangeRate {
    let now = Time.now();

    // Outcall is trap-guarded: the library traps on an empty body and the IC
    // can surface transient/consensus traps that escape an inner catch. Any
    // such trap must not reject the caller's promise, so it is caught here and
    // recorded, preserving the previously cached rate.
    let response = try {
      await OutCall.httpGetRequest(ratesUrl, [], transform);
    } catch (err) {
      return {
        previous with
        lastUpdated = now;
        lastError = ?("refreshExchangeRate: outcall failed: " # err.message());
      };
    };

    let json = switch (Json.parse(response)) {
      case (#err(e)) {
        return {
          previous with
          lastUpdated = now;
          lastError = ?("refreshExchangeRate: JSON parse failed: " # Json.errToText(e));
        };
      };
      case (#ok(j)) { j };
    };

    // transform() canonicalizes the body to {result, error-type?, time_last_update_unix, rates.PLN}.
    let result = _getText(json, "result");
    if (result != "success") {
      let errorType = _getText(json, "error-type");
      let detail = if (Text.size(errorType) > 0) { errorType } else { result };
      return {
        previous with
        lastUpdated = now;
        lastError = ?("refreshExchangeRate: provider returned an error: " # detail);
      };
    };

    let rate = _getFloat(json, "rates.PLN");
    if (rate <= 0.0) {
      return {
        previous with
        lastUpdated = now;
        lastError = ?"refreshExchangeRate: response carried no positive rates.PLN value";
      };
    };

    let sourceSeconds = _getFloat(json, "time_last_update_unix");
    let sourceTimestamp = if (sourceSeconds > 0.0) {
      (sourceSeconds * 1_000_000_000.0).toInt();
    } else {
      0;
    };

    {
      rate;
      lastUpdated = now;
      sourceTimestamp;
      lastError = null;
    };
  };

  // Canonicalize the rates-API response body so every replica produces a
  // byte-identical output for IC consensus. Keeps only the fields the feature
  // reads: `result`, `error-type` (when present), `time_last_update_unix`, and
  // `rates.PLN`. Every other currency and volatile field is dropped. Falls back
  // to the library default transform when the body is not valid JSON.
  //
  // Synchronous by design: the IC invokes the actor's `transform` callback as a
  // plain query function, which cannot await, so the actor delegates to this
  // helper directly. `transform` below is the async wrapper the outcall library
  // expects as its callback.
  public func canonicalize(input : OutCall.TransformationInput) : OutCall.TransformationOutput {
    let response = input.response;
    let bodyText = switch (response.body.decodeUtf8()) {
      case null { return OutCall.transform(input) };
      case (?t) { t };
    };

    let json = switch (Json.parse(bodyText)) {
      case (#err(_)) { return OutCall.transform(input) };
      case (#ok(j)) { j };
    };

    // Only the rates-API object shape (an object carrying a `rates` key) is
    // canonicalized here; anything else falls back to the library default.
    let entries = switch (json) {
      case (#object_(es)) { es };
      case _ { return OutCall.transform(input) };
    };
    var hasRates = false;
    for ((k, _) in entries.values()) {
      if (k == "rates") { hasRates := true };
    };
    if (not hasRates) { return OutCall.transform(input) };

    let result = _getText(json, "result");
    let errorType = _getText(json, "error-type");
    let sourceSeconds = _getFloat(json, "time_last_update_unix");
    let pln = _getFloat(json, "rates.PLN");

    // Round the rate to 8 decimals so the canonical body is byte-stable.
    let roundedPln = Float.nearest(pln * 1e8) / 1e8;

    var canonicalEntries : [(Text, Json.Json)] = [
      ("result", #string(result)),
      ("time_last_update_unix", #number(#float(sourceSeconds))),
      ("rates", #object_([("PLN", #number(#float(roundedPln)))])),
    ];
    if (Text.size(errorType) > 0) {
      canonicalEntries := canonicalEntries.concat([("error-type", #string(errorType))]);
    };

    let canonicalText = Json.stringify(#object_(canonicalEntries), null);
    {
      response with
      body = canonicalText.encodeUtf8();
    };
  };
};
