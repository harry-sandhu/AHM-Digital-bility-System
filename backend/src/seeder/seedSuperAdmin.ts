import User from "../models/User";
import bcrypt from "bcryptjs";

export const seedSuperAdmin = async () => {
  const existing = await User.findOne({ email: "admin@ahm.com" });
  if (!existing) {
    const hashedPassword = await bcrypt.hash("admin123", 10);
    await User.create({
      name: "Super Admin",
      phone: "0000000000",
      email: "admin@ahm.com",
      password: hashedPassword,
      role: "superadmin",
    });
    console.log("SuperAdmin seeded: admin@ahm.com / admin123");
  }
};
