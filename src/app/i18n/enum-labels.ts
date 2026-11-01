/**
 * API enum values that the UI shows to users. Each one has a translation at `enums.<group>.<VALUE>`
 * in both language files (checked by i18n-keys.spec.ts). Show them with the `enumLabel` pipe, never raw.
 * Values mirror the enums in theindex-api.
 */
export const ENUM_VALUES = {
  role: ['ADMIN', 'TRAINER', 'TRAINEE'],
  accountStatus: ['ACTIVE', 'DISABLED'],
  paymentStatus: ['PAID', 'UNPAID'],
  planType: ['PUNCH', 'TIME'],
  subscriptionStatus: ['ACTIVE', 'EXHAUSTED', 'EXPIRED', 'CANCELLED'],
  settlementStatus: ['DRAFT', 'FINAL'],
  allocationReason: ['PUNCH_CREDIT', 'TIME_PRORATA', 'UNPAID'],
  cashTransactionType: ['SUBSCRIPTION_IN', 'SETTLEMENT_OUT', 'MANUAL_IN', 'MANUAL_OUT'],
  cashSourceType: ['SUBSCRIPTION', 'SETTLEMENT', 'MANUAL']
} as const satisfies Record<string, readonly string[]>;

export type EnumGroup = keyof typeof ENUM_VALUES;

export function enumLabelKey(group: EnumGroup, value: string): string {
  return `enums.${group}.${value.toUpperCase()}`;
}

export function isKnownEnum(group: EnumGroup, value: string): boolean {
  return (ENUM_VALUES[group] as readonly string[]).includes(value.toUpperCase());
}
