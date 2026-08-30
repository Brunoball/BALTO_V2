import {
  API_URL,
  buildHeadersGET,
  parseJsonOrThrow,
} from "../../../Stock/modales/stockFormUtils";

function barcodeEndpointUrl(code) {
  const endpoint = new URL("../modules/stock/codigos_barra/endpoint.php", API_URL);
  endpoint.searchParams.set("op", "buscar");
  endpoint.searchParams.set("codigo_barra", code);
  endpoint.searchParams.set("_", String(Date.now()));
  return endpoint.toString();
}

export async function lookupBarcode(code, signal) {
  const response = await fetch(barcodeEndpointUrl(code), {
    method: "GET",
    headers: buildHeadersGET(),
    cache: "no-store",
    signal,
  });
  return parseJsonOrThrow(response);
}
