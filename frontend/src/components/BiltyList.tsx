// src/components/BiltyList.tsx
import React, { useEffect, useState } from "react";
import { getMyBilties } from "../api/biltyApi";

const BiltyList: React.FC = () => {
  const [bilties, setBilties] = useState<any[]>([]);

  useEffect(() => {
    getMyBilties()
      .then((res) => setBilties(res.data))
      .catch((err) => console.error(err));
  }, []);

  return (
    <div className="p-4">
      <h2 className="text-xl font-bold mb-4">Your Bilties</h2>
      <ul className="space-y-2">
        {bilties.length === 0 ? (
          <p>No bilties found.</p>
        ) : (
          bilties.map((bilty) => (
            <li key={bilty._id} className="border p-2 bg-white">
              <p>
                Bilty No: <strong>{bilty.biltyNo}</strong>
              </p>
              <p>
                Status: <strong>{bilty.status || "Pending"}</strong>
              </p>
            </li>
          ))
        )}
      </ul>
    </div>
  );
};

export default BiltyList;
