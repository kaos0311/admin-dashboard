export const FRONT_DELIVERY_IMPORTERS = ["Kelci", "Mary", "Frank", "Paul"] as const;

export const DELIVERY_RECEIVERS = ["Frank", "Larry", "Paul"] as const;

export const DELIVERY_TECHS = ["Frank", "Larry", "Paul"] as const;

export const SIGNER_ROLES = [
  "Patient",
  "PAO",
  "Next of Kin",
] as const;

export type FrontDeliveryImporter = (typeof FRONT_DELIVERY_IMPORTERS)[number];
export type DeliveryReceiver = (typeof DELIVERY_RECEIVERS)[number];
export type DeliveryTech = (typeof DELIVERY_TECHS)[number];
export type SignerRole = (typeof SIGNER_ROLES)[number];
