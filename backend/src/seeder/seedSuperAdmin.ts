import User from "../models/User";
import bcrypt from "bcryptjs";
import { normalizePhone } from "../utils/phoneUtils";

export const seedSuperAdmin = async () => {
  const superAdminPhone = normalizePhone(
    process.env.SUPERADMIN_PHONE || "0000000000"
  );
  const superAdminPassword = process.env.SUPERADMIN_PASSWORD || "admin123";

  const existing = await User.findOne({ role: "superadmin" });

  if (!existing) {
    const hashedPassword = await bcrypt.hash(superAdminPassword, 10);
    await User.create({
      name: "Super Admin",
      phone: superAdminPhone,
      password: hashedPassword,
      role: "superadmin",
      isActive: true,
    });
    console.log(
      `SuperAdmin seeded: ${superAdminPhone} / ${superAdminPassword}`
    );
  }
};
