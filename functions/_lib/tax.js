import { PRODUCT } from "./product.js";
import { readJsonSafe, sanitizeEnvValue } from "./shared.js";

const CONTIGUOUS_STATES = new Set([
  "AL","AZ","AR","CA","CO","CT","DE","FL","GA","ID","IL","IN","IA","KS","KY","LA",
  "ME","MD","MA","MI","MN","MS","MO","MT","NE","NV","NH","NJ","NM","NY","NC","ND",
  "OH","OK","OR","PA","RI","SC","SD","TN","TX","UT","VT","VA","WA","WV","WI","WY","DC"
]);

const STATE_NAME_TO_CODE = new Map([
  ["ALABAMA","AL"],["ALASKA","AK"],["ARIZONA","AZ"],["ARKANSAS","AR"],["CALIFORNIA","CA"],
  ["COLORADO","CO"],["CONNECTICUT","CT"],["DELAWARE","DE"],["DISTRICT OF COLUMBIA","DC"],
  ["FLORIDA","FL"],["GEORGIA","GA"],["HAWAII","HI"],["IDAHO","ID"],["ILLINOIS","IL"],
  ["INDIANA","IN"],["IOWA","IA"],["KANSAS","KS"],["KENTUCKY","KY"],["LOUISIANA","LA"],
  ["MAINE","ME"],["MARYLAND","MD"],["MASSACHUSETTS","MA"],["MICHIGAN","MI"],["MINNESOTA","MN"],
  ["MISSISSIPPI","MS"],["MISSOURI","MO"],["MONTANA","MT"],["NEBRASKA","NE"],["NEVADA","NV"],
  ["NEW HAMPSHIRE","NH"],["NEW JERSEY","NJ"],["NEW MEXICO","NM"],["NEW YORK","NY"],["NORTH CAROLINA","NC"],
  ["NORTH DAKOTA","ND"],["OHIO","OH"],["OKLAHOMA","OK"],["OREGON","OR"],["PENNSYLVANIA","PA"],
  ["RHODE ISLAND","RI"],["SOUTH CAROLINA","SC"],["SOUTH DAKOTA","SD"],["TENNESSEE","TN"],["TEXAS","TX"],
  ["UTAH","UT"],["VERMONT","VT"],["VIRGINIA","VA"],["WASHINGTON","WA"],["WEST VIRGINIA","WV"],
  ["WISCONSIN","WI"],["WYOMING","WY"]
]);

export function normalizeStateCode(value) {
  const cleaned = sanitizeEnvValue(value).toUpperCase();
  if (!cleaned) return "";
  if (cleaned.length === 2) return cleaned;
  return STATE_NAME_TO_CODE.get(cleaned) || "";
}

export function normalizePostalCode(value) {
  const cleaned = sanitizeEnvValue(value);
  if (!cleaned) return "";
  return cleaned.replace(/\s+/g, "");
}

export function normalizeCountryCode(value) {
  const cleaned = sanitizeEnvValue(value).toUpperCase();
  if (!cleaned) return "US";
  if (cleaned === "USA") return "US";
  return cleaned;
}

export function validateShippingAddress(input) {
  const address = {
    fullName: sanitizeEnvValue(input?.fullName),
    address1: sanitizeEnvValue(input?.address1),
    address2: sanitizeEnvValue(input?.address2),
    city: sanitizeEnvValue(input?.city),
    state: normalizeStateCode(input?.state),
    postalCode: normalizePostalCode(input?.postalCode),
    countryCode: normalizeCountryCode(input?.countryCode)
  };

  if (!address.fullName) {
    throw new Error("Enter the full name for the shipping address.");
  }
  if (!address.address1) {
    throw new Error("Enter the street address.");
  }
  if (!address.city) {
    throw new Error("Enter the city.");
  }
  if (!address.state) {
    throw new Error("Select a state.");
  }
  if (!address.postalCode) {
    throw new Error("Enter the ZIP code.");
  }
  if (address.countryCode !== "US") {
    throw new Error("Shipping is currently available only within the United States.");
  }
  if (!CONTIGUOUS_STATES.has(address.state)) {
    throw new Error("Shipping is currently limited to the 48 contiguous U.S. states and Washington, DC.");
  }

  return address;
}

function buildColoradoAddressString(address) {
  return [
    address.address1,
    address.address2,
    `${address.city}, ${address.state} ${address.postalCode}`
  ].filter(Boolean).join(" ");
}

async function fetchColoradoRate(env, address) {
  const apiKey = sanitizeEnvValue(env.CO_GIS_API_KEY);
  if (!apiKey) {
    throw new Error("Missing CO_GIS_API_KEY environment variable.");
  }

  const productServiceId = sanitizeEnvValue(env.CO_GIS_PRODUCT_SERVICE_ID);
  const payload = {
    address: buildColoradoAddressString(address)
  };

  if (productServiceId) {
    const parsedId = Number(productServiceId);
    if (Number.isFinite(parsedId)) {
      payload.productServiceId = parsedId;
    }
  }

  const response = await fetch("https://api.ttr.services/v1/automation.rates.list", {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      Accept: "application/json",
      Authorization: `Bearer ${apiKey}`
    },
    body: JSON.stringify(payload)
  });

  const data = await readJsonSafe(response);

  if (!response.ok) {
    const detail = data.message || data.error || data.raw || "Colorado tax lookup failed.";
    throw new Error(`Colorado tax lookup failed (${response.status}): ${detail}`);
  }

  const totalSalesTax = Number(data.totalSalesTax);
  if (!Number.isFinite(totalSalesTax) || totalSalesTax < 0) {
    throw new Error("Colorado tax lookup returned an invalid tax rate.");
  }

  return {
    taxRate: totalSalesTax,
    jurisdictionCode: data.jurisdictionCode || "",
    productService: data.productService || "",
    apiAddress: data.address || buildColoradoAddressString(address),
    salesTax: Array.isArray(data.salesTax) ? data.salesTax : []
  };
}

export async function buildTaxQuote(env, inputAddress, options = {}) {
  const address = validateShippingAddress(inputAddress);
  const taxableAmount = Number(options.taxableAmount ?? PRODUCT.itemAmount);
  const shippingAmount = Number(options.shippingAmount ?? PRODUCT.shippingAmount);

  if (!Number.isFinite(taxableAmount) || taxableAmount < 0) {
    throw new Error("Invalid taxable amount.");
  }
  if (!Number.isFinite(shippingAmount) || shippingAmount < 0) {
    throw new Error("Invalid shipping amount.");
  }

  const isColorado = address.state === "CO";
  let taxRate = 0;
  let jurisdictionCode = "";
  let productService = "";
  let source = "out-of-state";
  let apiAddress = "";
  let salesTax = [];

  if (isColorado) {
    const coloradoRate = await fetchColoradoRate(env, address);
    taxRate = coloradoRate.taxRate;
    jurisdictionCode = coloradoRate.jurisdictionCode;
    productService = coloradoRate.productService;
    source = "colorado-gis";
    apiAddress = coloradoRate.apiAddress;
    salesTax = coloradoRate.salesTax;
  }

  const taxAmount = Number((taxableAmount * taxRate).toFixed(2));
  const subtotal = Number((taxableAmount + shippingAmount).toFixed(2));
  const totalAmount = Number((subtotal + taxAmount).toFixed(2));

  return {
    supported: true,
    isColorado,
    source,
    address,
    apiAddress,
    jurisdictionCode,
    productService,
    taxRate,
    taxableAmount: taxableAmount.toFixed(2),
    shippingAmount: shippingAmount.toFixed(2),
    subtotal: subtotal.toFixed(2),
    taxAmount: taxAmount.toFixed(2),
    totalAmount: totalAmount.toFixed(2),
    salesTax
  };
}
