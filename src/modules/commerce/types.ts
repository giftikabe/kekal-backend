import { z } from 'zod';

/**
 * All request-body validation for the commerce module lives here. Response
 * shapes stay implicit (plain Drizzle rows / composed objects) — the rest of
 * the backend follows the same convention per src/lib/response.ts.
 */

export const saveSettingsSchema = z.object({
  chapaPublicKey: z.string().min(1, 'chapaPublicKey is required'),
  chapaSecretKey: z.string().min(1, 'chapaSecretKey is required'),
});
export type SaveSettingsInput = z.infer<typeof saveSettingsSchema>;

export const checkoutItemSchema = z.object({
  customRowId: z.string().uuid(),
  quantity: z.number().int().positive(),
});

export const shippingAddressSchema = z.object({
  line1: z.string().min(1),
  line2: z.string().optional(),
  city: z.string().min(1),
  country: z.string().min(1),
  postalCode: z.string().optional(),
});
export type ShippingAddress = z.infer<typeof shippingAddressSchema>;

export const checkoutSchema = z
  .object({
    items: z.array(checkoutItemSchema).min(1, 'cart is empty'),
    customerType: z.enum(['local', 'international']),
    currency: z.enum(['etb', 'usd']),
    contactName: z.string().min(1),
    // Chapa's initialize-payment call requires an email; there is no
    // customer-account system to source one from, so it's optional here and
    // a guest placeholder is generated in chapaClient.ts if omitted.
    contactEmail: z.string().email().optional(),
    contactPhone: z.string().optional(),
    shippingAddress: shippingAddressSchema.optional(),
  })
  .refine((v) => (v.customerType === 'local' ? !!v.contactPhone : true), {
    message: 'contactPhone is required when customerType is "local"',
    path: ['contactPhone'],
  })
  .refine((v) => (v.customerType === 'international' ? !!v.shippingAddress : true), {
    message: 'shippingAddress is required when customerType is "international"',
    path: ['shippingAddress'],
  });
export type CheckoutInput = z.infer<typeof checkoutSchema>;

export const orderStatusValues = [
  'pending',
  'paid',
  'processing',
  'shipped',
  'delivered',
  'failed',
  'cancelled',
] as const;
export type OrderStatusValue = (typeof orderStatusValues)[number];

export const orderStatusSchema = z.object({
  status: z.enum(orderStatusValues),
});

export const shipmentSchema = z.object({
  status: z.string().min(1),
  trackingNote: z.string().optional(),
});
export type ShipmentInput = z.infer<typeof shipmentSchema>;

export const orderListQuerySchema = z.object({
  status: z.enum(orderStatusValues).optional(),
  page: z.coerce.number().int().positive().optional().default(1),
  pageSize: z.coerce.number().int().positive().max(100).optional().default(20),
});
