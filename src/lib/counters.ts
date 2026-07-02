import { prisma } from "@/lib/prisma";

/**
 * Atomic sequential IDs: nextId("prospect", "DV-P") -> "DV-P-0001"
 */
export async function nextId(counterName: string, prefix: string, pad = 4): Promise<string> {
  const counter = await prisma.counter.upsert({
    where: { name: counterName },
    create: { name: counterName, value: 1 },
    update: { value: { increment: 1 } },
  });
  return `${prefix}-${String(counter.value).padStart(pad, "0")}`;
}
