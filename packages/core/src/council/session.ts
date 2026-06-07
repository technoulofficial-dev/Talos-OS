import { randomUUID } from "crypto";
import type { CouncilProposal, CouncilSession, CouncilSessionStatus, AdvisorReport, ChairmanVerdict } from "./types.js";
import { evaluateParallel } from "./advisor.js";
import { synthesizeVerdict } from "./chairman.js";

const sessions = new Map<string, CouncilSession>();

export function createSession(proposal: CouncilProposal): { sessionId: string } {
  const sessionId = randomUUID();
  const session: CouncilSession = {
    sessionId,
    proposal,
    status: "pending",
    reports: [],
    createdAt: new Date(),
  };
  sessions.set(sessionId, session);
  return { sessionId };
}

export function getSession(sessionId: string): CouncilSession | undefined {
  return sessions.get(sessionId);
}

export async function executeSession(
  sessionId: string,
  reportProgress?: (reports: AdvisorReport[]) => void
): Promise<CouncilSession> {
  const session = sessions.get(sessionId);
  if (!session) throw new Error(`Session not found: ${sessionId}`);

  session.status = "in_progress";

  try {
    const reports = await evaluateParallel(session.proposal);
    session.reports = reports;

    if (reportProgress) reportProgress(reports);

    const verdict = await synthesizeVerdict(reports);
    session.verdict = verdict;
    session.status = "completed";
    session.completedAt = new Date();
  } catch (err) {
    session.status = "failed";
    session.error = (err as Error).message;
  }

  sessions.set(sessionId, session);
  return session;
}

export function updateSessionStatus(
  sessionId: string,
  status: CouncilSessionStatus,
  error?: string
): void {
  const session = sessions.get(sessionId);
  if (session) {
    session.status = status;
    if (error) session.error = error;
    if (status === "completed") session.completedAt = new Date();
  }
}

export function getAllSessions(): CouncilSession[] {
  return Array.from(sessions.values());
}

export function clearSessions(): void {
  sessions.clear();
}
