import React from "react";

const BiltyForm: React.FC = () => {
  const formWidth = 75;
  const formHeightMultiplier = 1.5;
  const formHeight = formWidth * formHeightMultiplier;

  const vw = (v: number) => `${formWidth * v}vw`;
  const vh = (v: number) => `${formHeight * v}vw`;

  const handleTextareaResize = (e: React.FormEvent<HTMLTextAreaElement>) => {
    const el = e.currentTarget;
    el.style.height = "auto";
    el.style.height = el.scrollHeight + "px";
  };

  return (
    <div
      className="relative mx-auto mt-4 bg-white text-[1vw] border-2 border-black"
      style={{ width: `${formWidth}vw`, height: `${formHeight}vw` }}
    >
      {/* Title */}
      <div
        className="absolute text-center w-full font-extrabold text-red-800"
        style={{ top: vh(0.02), fontSize: "1.8vw" }}
      >
        AHM TRANSPORT SERVICE
      </div>
      <div
        className="absolute text-center w-full text-black"
        style={{ top: vh(0.06), fontSize: "1vw" }}
      >
        Rampur-Bilaspur Road, Vill. & Post Bhot - 244901 (Uttar Pradesh)
      </div>
      <div
        className="absolute text-center w-full text-black"
        style={{ top: vh(0.08), fontSize: "0.95vw" }}
      >
        GSTIN: 09CPGPS1323P1ZD | Email: ahmtptservice@gmail.com | A/c No:
        971000294002004 | Branch: Axis Bank, Rampur
      </div>
      <div
        className="absolute w-[90%] border-b border-black left-[5%]"
        style={{ top: vh(0.1) }}
      ></div>

      {/* Lorry No */}
      <div
        className="absolute border p-1"
        style={{
          top: vh(0.11),
          left: vw(0.05),
          width: vw(0.4),
          height: vh(0.04),
        }}
      >
        <label>Lorry No.</label>
        <input className="w-full border" placeholder="Lorry Number" />
      </div>

      {/* Invoice No & Date */}
      <div
        className="absolute border p-1"
        style={{
          top: vh(0.11),
          left: vw(0.55),
          width: vw(0.4),
          height: vh(0.04),
        }}
      >
        <label>Invoice No & Date</label>
        <textarea
          className="border w-full p-1 resize-none overflow-auto min-h-[2.5vw]"
          placeholder="Invoice and Date"
          rows={1}
          onInput={handleTextareaResize}
        />
      </div>

      {/* Delivery Address */}
      <div
        className="absolute border p-1"
        style={{
          top: vh(0.16),
          left: vw(0.05),
          width: vw(0.9),
          height: vh(0.04),
        }}
      >
        <label>Delivery Address</label>
        <textarea
          className="border w-full p-1 resize-none overflow-auto min-h-[2.5vw]"
          placeholder="Delivery Address"
          rows={1}
          onInput={handleTextareaResize}
        />
      </div>

      {/* Phone No */}
      <div
        className="absolute border p-1"
        style={{
          top: vh(0.21),
          left: vw(0.05),
          width: vw(0.4),
          height: vh(0.04),
        }}
      >
        <label>Phone No</label>
        <input className="w-full border" />
      </div>

      {/* Insurance */}
      <div
        className="absolute border p-1"
        style={{
          top: vh(0.26),
          left: vw(0.05),
          width: vw(0.9),
          height: vh(0.06),
        }}
      >
        <label className="font-semibold block mb-1">Insurance</label>
        <div className="grid grid-cols-5 gap-1">
          <input className="border" placeholder="Company" />
          <input className="border" placeholder="Policy No." />
          <input className="border" placeholder="Date" />
          <input className="border" placeholder="DEC/CERT No." />
          <input className="border" placeholder="Amount" />
        </div>
      </div>

      {/* Bilty No */}
      <div
        className="absolute border p-1"
        style={{
          top: vh(0.33),
          left: vw(0.05),
          width: vw(0.4),
          height: vh(0.04),
        }}
      >
        <label>Bilty No.</label>
        <input className="w-full border" />
      </div>

      {/* GST Paid By */}
      <div
        className="absolute border p-1 space-x-2"
        style={{
          top: vh(0.33),
          left: vw(0.55),
          width: vw(0.4),
          height: vh(0.04),
        }}
      >
        <label className="block">GST Paid By:</label>
        <label>
          <input type="radio" name="gst" /> Consignor
        </label>
        <label>
          <input type="radio" name="gst" /> Consignee
        </label>
        <label>
          <input type="radio" name="gst" /> Transporter
        </label>
      </div>

      {/* Consignor */}
      <div
        className="absolute border p-1"
        style={{
          top: vh(0.38),
          left: vw(0.05),
          width: vw(0.4),
          height: vh(0.05),
        }}
      >
        <label>Consignor's Name & Address</label>
        <textarea
          className="w-full border h-[60%]"
          onInput={handleTextareaResize}
        />
        <input className="w-full border mt-1" placeholder="GSTIN" />
      </div>

      {/* Consignee */}
      <div
        className="absolute border p-1"
        style={{
          top: vh(0.38),
          left: vw(0.55),
          width: vw(0.4),
          height: vh(0.05),
        }}
      >
        <label>Consignee's Name & Address</label>
        <textarea
          className="w-full border h-[60%]"
          onInput={handleTextareaResize}
        />
        <input className="w-full border mt-1" placeholder="GSTIN" />
      </div>

      {/* Consignment Details */}
      <div
        className="absolute border p-1"
        style={{
          top: vh(0.45),
          left: vw(0.05),
          width: vw(0.2),
          height: vh(0.03),
        }}
      >
        <label>Consignment No</label>
        <input className="w-full border" />
      </div>
      <div
        className="absolute border p-1"
        style={{
          top: vh(0.45),
          left: vw(0.3),
          width: vw(0.2),
          height: vh(0.03),
        }}
      >
        <label>Date</label>
        <input className="w-full border" />
      </div>
      <div
        className="absolute border p-1"
        style={{
          top: vh(0.45),
          left: vw(0.55),
          width: vw(0.2),
          height: vh(0.03),
        }}
      >
        <label>From</label>
        <input className="w-full border" />
      </div>
      <div
        className="absolute border p-1"
        style={{
          top: vh(0.45),
          left: vw(0.8),
          width: vw(0.15),
          height: vh(0.03),
        }}
      >
        <label>To</label>
        <input className="w-full border" />
      </div>

      {/* Goods Description Table */}
      <div
        className="absolute border p-1"
        style={{ top: vh(0.49), left: vw(0.05), width: vw(0.9) }}
      >
        <div
          className="grid font-semibold text-center border-b border-gray-400 pb-1"
          style={{ gridTemplateColumns: "1fr 1.5fr 3fr 1.2fr 1.2fr 1fr 1fr" }}
        >
          <span>Number of packages</span>
          <span>Method of Packing</span>
          <span>Description</span>
          <span>Actual Wt.</span>
          <span>Charged Wt.</span>
          <span>Rate</span>
          <span>Amount</span>
        </div>
        <div
          className="grid gap-1 mt-1"
          style={{ gridTemplateColumns: "1fr 1.5fr 3fr 1.2fr 1.2fr 1fr 1fr" }}
        >
          <textarea
            className="border w-full p-1 resize-none overflow-auto min-h-[2.5vw]"
            placeholder="Number"
            rows={1}
            onInput={handleTextareaResize}
          />
          <textarea
            className="border w-full p-1 resize-none overflow-auto min-h-[2.5vw]"
            placeholder="Method"
            rows={1}
            onInput={handleTextareaResize}
          />
          <textarea
            className="border w-full p-1 resize-none overflow-auto min-h-[2.5vw]"
            placeholder="Description"
            rows={1}
            onInput={handleTextareaResize}
          />
          <textarea
            className="border w-full p-1 resize-none overflow-auto min-h-[2.5vw]"
            placeholder="Actual Wt."
            rows={1}
            onInput={handleTextareaResize}
          />
          <textarea
            className="border w-full p-1 resize-none overflow-auto min-h-[2.5vw]"
            placeholder="Charged Wt."
            rows={1}
            onInput={handleTextareaResize}
          />
          <textarea
            className="border w-full p-1 resize-none overflow-auto min-h-[2.5vw]"
            placeholder="Rate"
            rows={1}
            onInput={handleTextareaResize}
          />
          <textarea
            className="border w-full p-1 resize-none overflow-auto min-h-[2.5vw]"
            placeholder="Amount"
            rows={1}
            onInput={handleTextareaResize}
          />
        </div>
      </div>

      {/* Charges & Totals */}
      <div
        className="absolute border p-1"
        style={{
          top: vh(0.66),
          left: vw(0.05),
          width: vw(0.2),
          height: vh(0.03),
        }}
      >
        <input placeholder="Freight" className="w-full border" />
      </div>
      <div
        className="absolute border p-1"
        style={{
          top: vh(0.66),
          left: vw(0.3),
          width: vw(0.2),
          height: vh(0.03),
        }}
      >
        <input placeholder="Labour" className="w-full border" />
      </div>
      <div
        className="absolute border p-1"
        style={{
          top: vh(0.66),
          left: vw(0.55),
          width: vw(0.2),
          height: vh(0.03),
        }}
      >
        <input placeholder="GST Charges" className="w-full border" />
      </div>
      <div
        className="absolute border p-1"
        style={{
          top: vh(0.66),
          left: vw(0.8),
          width: vw(0.15),
          height: vh(0.03),
        }}
      >
        <input placeholder="Bilty Charges" className="w-full border" />
      </div>

      <div
        className="absolute border p-1"
        style={{
          top: vh(0.7),
          left: vw(0.05),
          width: vw(0.2),
          height: vh(0.03),
        }}
      >
        <input placeholder="Grand Total" className="w-full border" />
      </div>
      <div
        className="absolute border p-1"
        style={{
          top: vh(0.7),
          left: vw(0.3),
          width: vw(0.2),
          height: vh(0.03),
        }}
      >
        <input placeholder="Advance" className="w-full border" />
      </div>
      <div
        className="absolute border p-1"
        style={{
          top: vh(0.7),
          left: vw(0.55),
          width: vw(0.2),
          height: vh(0.03),
        }}
      >
        <input placeholder="Balance Amt" className="w-full border" />
      </div>

      {/* Final Info */}
      <div
        className="absolute border p-1"
        style={{
          top: vh(0.7),
          left: vw(0.05),
          width: vw(0.4),
          height: vh(0.03),
        }}
      >
        <input placeholder="Declared Value" className="w-full border" />
      </div>
      <div
        className="absolute border p-1"
        style={{
          top: vh(0.7),
          left: vw(0.55),
          width: vw(0.4),
          height: vh(0.03),
        }}
      >
        <input placeholder="Driver" className="w-full border" />
      </div>

      {/* Signature */}
      <div
        className="absolute border p-1"
        style={{
          top: vh(0.78),
          left: vw(0.05),
          width: vw(0.9),
          height: vh(0.03),
        }}
      >
        Signature or Remarks
      </div>

      {/* Booking Clerk */}
      <div
        className="absolute border p-1"
        style={{
          top: vh(0.78),
          left: vw(0.65),
          width: vw(0.25),
          height: vh(0.03),
        }}
      >
        <input placeholder="Booking Clerk" className="w-full border" />
      </div>

      {/* Footer Notes */}
      <div
        className="absolute border p-1"
        style={{
          top: vh(0.87),
          left: vw(0.05),
          width: vw(0.4),
          height: vh(0.05),
        }}
      >
        Footer Left
      </div>
      <div
        className="absolute border p-1"
        style={{
          top: vh(0.87),
          left: vw(0.55),
          width: vw(0.4),
          height: vh(0.05),
        }}
      >
        Footer Right
      </div>
    </div>
  );
};

export default BiltyForm;
