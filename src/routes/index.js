import { Router } from "express";
import authRoutes from "./auth.routes.js";
import userRoutes from "./user.routes.js";
import sessionRoutes from "./session.routes.js";
import teacherRoutes from "./teacher.routes.js";
import principalRoutes from "./principal.routes.js";

const router = Router();

router.use("/auth", authRoutes);
router.use("/users", userRoutes);
router.use("/sessions", sessionRoutes);
router.use("/teacher", teacherRoutes);
router.use("/principal", principalRoutes);

export default router;
