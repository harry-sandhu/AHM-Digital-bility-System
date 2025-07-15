export interface BiltyType {
  biltyNo: string;
  createdBy: string;
  lorryNo?: string;
  invoiceNoDate?: string;
  deliveryAddress?: string;
  phoneNo?: string;
  consignor?: string;
  consignee?: string;
  gstPaidBy?: string;
  goodsDescription?: string;
  charges?: {
    freight?: number;
    labour?: number;
    gstCharges?: number;
    biltyCharges?: number;
    grandTotal?: number;
    advance?: number;
    balance?: number;
  };
  status?: string;
}
