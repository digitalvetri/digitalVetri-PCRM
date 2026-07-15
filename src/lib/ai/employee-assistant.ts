import { generateText } from "@/lib/ai/provider";
import { getEmployeeSelf, getEmployeePerformance } from "@/lib/hr";
import { getLeaveBalances, upcomingHolidays } from "@/lib/holidays";
import { listTimesheet } from "@/lib/timesheet";

export type ChatTurn = { role: "user" | "assistant"; content: string };

const fmtDate = (d: Date | null | undefined) => (d ? d.toLocaleDateString("en-IN", { day: "2-digit", month: "short" }) : "—");

/**
 * Vetri, scoped to a single employee. Builds a compact context from ONLY the
 * caller's own HR data (privacy-safe — never another employee's records, never
 * project contract values) and answers their question conversationally.
 */
export async function answerEmployeeQuestion(userId: string, name: string, question: string, history: ChatTurn[] = []): Promise<string> {
  const [self, perf, balances, holidays, timesheet] = await Promise.all([
    getEmployeeSelf(userId),
    getEmployeePerformance(userId),
    getLeaveBalances(userId),
    upcomingHolidays(5),
    listTimesheet(userId, 14),
  ]);

  const openTasks = self.tasks.filter((t) => t.status !== "DONE");
  const doneTasks = self.tasks.filter((t) => t.status === "DONE").length;
  const hoursLogged = timesheet.reduce((s, t) => s + t.hours, 0);

  const context = {
    name,
    today: new Date().toLocaleDateString("en-IN", { weekday: "long", day: "2-digit", month: "long", year: "numeric" }),
    checkedInToday: Boolean(self.todayAttendance?.checkIn),
    attendanceRate: perf.attendanceRate,
    performanceScore: perf.score,
    openTasks: openTasks.map((t) => ({ title: t.title, priority: t.priority, due: fmtDate(t.dueDate) })),
    tasksDone: doneTasks,
    projects: self.assignments.map((a) => ({ name: a.project.name, role: a.role, status: a.project.status, due: fmtDate(a.project.dueDate) })),
    leaveBalances: balances.filter((b) => b.allowance > 0).map((b) => ({ type: b.type, remaining: b.remaining, used: b.used })),
    upcomingHolidays: holidays.map((h) => ({ name: h.name, date: fmtDate(h.date) })),
    hoursLoggedLast14Days: Math.round(hoursLogged * 10) / 10,
    reviews: self.reviews.slice(0, 2).map((r) => ({ period: r.period, rating: r.rating })),
  };

  const system = `You are Vetri, the friendly AI assistant inside DigitalVetri's employee portal.
You are talking to ${name}, an employee. Answer ONLY from the DATA provided about them.
Be warm, concise and practical (2-5 sentences, use bullet points for lists). Use Indian date/number formatting.
If the data doesn't contain the answer, say so briefly and suggest where in the portal to look (Tasks, Timesheet, Leave, Projects, Payslips, Reports).
Never invent tasks, leave balances, salary figures or projects. Never discuss other employees. Today is ${context.today}.`;

  const convo = history.slice(-6).map((t) => `${t.role === "user" ? "Employee" : "Vetri"}: ${t.content}`).join("\n");
  const prompt = `DATA (JSON):\n${JSON.stringify(context)}\n\n${convo ? `Conversation so far:\n${convo}\n\n` : ""}Employee asks: "${question}"\n\nVetri's answer:`;

  return generateText(prompt, { system, temperature: 0.5, maxTokens: 500 });
}
