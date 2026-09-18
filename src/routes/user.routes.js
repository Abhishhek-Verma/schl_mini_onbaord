import { Router } from "express";
import { getUsersHandler, getUserByIdHandler } from "../controllers/user.controller.js";
import { authenticateToken } from "../middlewares/auth.middleware.js";
import { authorizeRoles } from "../middlewares/role.middleware.js";

const router = Router();

router.get("/", authenticateToken, getUsersHandler);
router.get("/:id", authenticateToken, getUserByIdHandler);

// Admin-only Route Example
router.get("/admin/dashboard", authenticateToken, authorizeRoles("ADMIN"), (req, res) => {
  res.json({ message: "Welcome to the Admin Dashboard!", adminUser: req.user });
});

export default router;
