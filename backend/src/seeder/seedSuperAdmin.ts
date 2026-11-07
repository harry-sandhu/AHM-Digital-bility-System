import User from "../models/User";
import bcrypt from "bcryptjs";
import { normalizePhone } from "../utils/phoneUtils";

export const seedSuperAdmin = async () => {
  const existing = await User.findOne({ role: "superadmin" });

  if (existing) {
    return;
  }

  if (!process.env.SUPERADMIN_PHONE || !process.env.SUPERADMIN_PASSWORD) {
    throw new Error(
      "No superadmin exists yet, and SUPERADMIN_PHONE/SUPERADMIN_PASSWORD are not set. " +
        "Set both environment variables before starting the server."
    );
  }

  const superAdminPhone = normalizePhone(process.env.SUPERADMIN_PHONE);
  const superAdminPassword = process.env.SUPERADMIN_PASSWORD;

  const hashedPassword = await bcrypt.hash(superAdminPassword, 10);
  await User.create({
    name: "Super Admin",
    phone: superAdminPhone,
    password: hashedPassword,
    role: "superadmin",
    isActive: true,
  });
  console.log(`SuperAdmin seeded: ${superAdminPhone}`);
};
