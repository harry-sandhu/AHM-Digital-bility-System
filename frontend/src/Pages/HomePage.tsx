import React from "react";
import Navbar from "../components/Navbar";
import BiltyList from "../components/BiltyList";

const HomePage: React.FC = () => {
  return (
    <div>
      <Navbar />
      <div className="p-4">
        <BiltyList />
      </div>
    </div>
  );
};

export default HomePage;
