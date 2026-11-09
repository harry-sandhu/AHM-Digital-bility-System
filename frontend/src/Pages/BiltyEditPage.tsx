import React from "react";
import { Navigate, useParams } from "react-router-dom";
import Navbar from "../components/Navbar";
import BiltyForm from "../components/BiltyForm";

/** Edit uses the exact same form as Create (BiltyForm in edit mode). */
const BiltyEditPage: React.FC = () => {
  const { id } = useParams<{ id: string }>();

  if (!id) {
    return <Navigate to="/" replace />;
  }

  return (
    <div className="page-shell">
      <Navbar />
      <div className="mx-auto max-w-7xl px-4 py-8">
        <BiltyForm key={id} editBiltyId={id} />
      </div>
    </div>
  );
};

export default BiltyEditPage;
