export const BILTY_TERMS_ACCEPTED_KEY = "biltyTermsAccepted";

export const TERMS_INTRO =
  "These terms and conditions govern the booking, carriage, delivery, billing, and handling of consignments booked through AHM Transport Service.";

export const TERMS_SECTIONS = [
  {
    title: "1. Booking & Information",
    points: [
      "The consignor must provide complete and correct shipment details at the time of booking.",
      "Any difference in quantity, weight, declared value, packing, or address may lead to delay, additional charges, or refusal of delivery.",
      "AHM Transport Service may refuse any consignment that is unsafe, improperly packed, prohibited, or unlawful.",
    ],
  },
  {
    title: "2. Packing, Risk & Responsibility",
    points: [
      "Goods must be packed properly by the consignor to withstand loading, movement, and unloading.",
      "Fragile, perishable, liquid, or high-value goods are booked at the consignor's risk unless specifically covered by insurance.",
      "The transporter is not responsible for damage caused by poor packing, leakage, natural deterioration, or force majeure events.",
    ],
  },
  {
    title: "3. Freight, GST & Other Charges",
    points: [
      "Freight, labour, GST, bilty charges, and other agreed charges are payable as per the bilty details.",
      "Demurrage, detention, unloading, waiting, storage, or route-related additional expenses, if any, shall be payable by the liable party.",
      "GST liability will be borne by the person selected on the bilty unless otherwise mutually agreed in writing.",
    ],
  },
  {
    title: "4. Delivery Rules",
    points: [
      "Delivery will be made at the destination address or against proper identification, bilty reference, or authorized instruction.",
      "If the consignee is unavailable, refuses delivery, or delays collection, the transporter may hold the goods at the owner's risk and cost.",
      "Claims regarding shortage, visible damage, or mismatch should be recorded at the time of delivery itself.",
    ],
  },
  {
    title: "5. Claims, Insurance & Limitation",
    points: [
      "Insurance details, if any, must be correctly mentioned in the bilty. In the absence of valid insurance, liability shall remain limited as per applicable law and circumstances.",
      "No claim shall be entertained for indirect loss, business interruption, market loss, or delay-based consequential damages.",
      "All disputes are subject to mutually applicable law and the jurisdiction of the transporter's operating location unless otherwise agreed.",
    ],
  },
] as const;
