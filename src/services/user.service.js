import { prisma } from "../../lib/prisma.js";

export async function getAllUsers() {
  return prisma.user.findMany({
    select: {
      id: true,
      username: true,
      email: true,
      displayName: true,
      avatar: true,
      role: true,
      isEmailVerified: true,
      createdAt: true,
    },
  });
}

export async function getUserById(id) {
  const user = await prisma.user.findUnique({
    where: { id },
    select: {
      id: true,
      username: true,
      email: true,
      displayName: true,
      avatar: true,
      role: true,
      isEmailVerified: true,
      createdAt: true,
    },
  });

  if (!user) {
    const error = new Error("User not found");
    error.statusCode = 404;
    throw error;
  }

  return user;
}
