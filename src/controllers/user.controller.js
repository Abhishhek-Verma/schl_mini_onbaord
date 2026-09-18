import { getAllUsers, getUserById } from "../services/user.service.js";

export async function getUsersHandler(req, res, next) {
  try {
    const users = await getAllUsers();
    res.json(users);
  } catch (error) {
    next(error);
  }
}

export async function getUserByIdHandler(req, res, next) {
  try {
    const user = await getUserById(req.params.id);
    res.json(user);
  } catch (error) {
    next(error);
  }
}
