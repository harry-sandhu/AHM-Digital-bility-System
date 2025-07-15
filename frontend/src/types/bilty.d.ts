export interface Bilty {
  biltyNo: string;
  user: string;
  lorryNo: string;
  deliveryAddress: string;
  phone: string;
  consignee: string;
  consignor: string;
  gstPaidBy: string;
  items: {
    packages: string;
    packing: string;
    description: string;
    actualWeight: string;
    chargedWeight: string;
    rate: string;
    amount: string;
  }[];
  totalAmount: number;
}
