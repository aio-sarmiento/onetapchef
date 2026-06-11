// Glovo Business API integration stub
// ─────────────────────────────────────────────────────────────
// Add GLOVO_API_KEY and GLOVO_STORE_ID to your environment
// variables once you have a Glovo Business account.
// Docs: https://api.glovoapp.com/docs/business
// ─────────────────────────────────────────────────────────────

export type GlovoDispatchInput = {
  orderId: string;
  pickupAddress: string;
  pickupContactName: string;
  pickupContactPhone: string;
  deliveryAddress: string;
  deliveryContactName: string;
  deliveryContactPhone: string;
  packageDescription: string;
  estimatedValueEur: number;
};

export type GlovoDispatchResult = {
  glovoOrderId: string;
  trackingUrl: string;
  estimatedPickupMinutes: number;
};

export async function dispatchGlovoDelivery(
  input: GlovoDispatchInput
): Promise<GlovoDispatchResult> {
  const apiKey = process.env.GLOVO_API_KEY;
  const storeId = process.env.GLOVO_STORE_ID;

  if (!apiKey || !storeId) {
    // Stub response — replace with real API call once credentials are available
    console.warn("[Glovo] GLOVO_API_KEY / GLOVO_STORE_ID not set — using stub response");
    return {
      glovoOrderId: `STUB-${input.orderId}`,
      trackingUrl: `https://glovoapp.com/track/STUB-${input.orderId}`,
      estimatedPickupMinutes: 30,
    };
  }

  // Real implementation — uncomment and adapt when credentials are ready
  // const res = await fetch("https://api.glovoapp.com/b2b/orders", {
  //   method: "POST",
  //   headers: {
  //     "Authorization": `Bearer ${apiKey}`,
  //     "Content-Type": "application/json",
  //   },
  //   body: JSON.stringify({
  //     store_id: storeId,
  //     pickup: {
  //       address: input.pickupAddress,
  //       contact_name: input.pickupContactName,
  //       contact_phone: input.pickupContactPhone,
  //     },
  //     delivery: {
  //       address: input.deliveryAddress,
  //       contact_name: input.deliveryContactName,
  //       contact_phone: input.deliveryContactPhone,
  //     },
  //     package_description: input.packageDescription,
  //     estimated_value: input.estimatedValueEur,
  //   }),
  // });
  // if (!res.ok) throw new Error(`Glovo API error: ${res.status}`);
  // const data = await res.json();
  // return {
  //   glovoOrderId: data.id,
  //   trackingUrl: data.tracking_url,
  //   estimatedPickupMinutes: data.estimated_pickup_minutes,
  // };

  throw new Error("Glovo credentials set but real API call not yet wired up");
}
