import { prisma } from "./prisma";

// Creates the memory, or overwrites its value if this user already has the key
export async function saveMemory(userId: string, key: string, value: string) {
  return await prisma.userMemory.upsert({
    where: {
      userId_key: {
        userId,
        key,
      },
    },
    update: {
      value,
    },
    create: {
      userId,
      key,
      value,
    },
  });
}

// Returns the memory row, or null if this user has never saved the key
export async function getMemory(userId: string, key: string) {
  return await prisma.userMemory.findUnique({
    where: {
      userId_key: {
        userId,
        key,
      },
    },
  });
}
