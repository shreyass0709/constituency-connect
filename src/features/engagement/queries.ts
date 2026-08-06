import { db } from "@/lib/db";

export type PollOption = { id: string; label: string };

/** Open polls with the tallies, plus which option this user already picked. */
export async function listPolls(userId: string) {
  const now = new Date();
  const polls = await db.poll.findMany({
    where: { endsAt: { gte: new Date(now.getTime() - 30 * 86_400_000) } },
    orderBy: { endsAt: "desc" },
    include: { votes: { select: { optionId: true, userId: true } } },
    take: 10,
  });

  return polls.map((poll) => {
    const options = poll.options as PollOption[];
    const counts = new Map<string, number>();
    for (const vote of poll.votes) counts.set(vote.optionId, (counts.get(vote.optionId) ?? 0) + 1);

    return {
      id: poll.id,
      question: poll.question,
      startsAt: poll.startsAt,
      endsAt: poll.endsAt,
      open: now >= poll.startsAt && now <= poll.endsAt,
      total: poll.votes.length,
      myVote: poll.votes.find((vote) => vote.userId === userId)?.optionId ?? null,
      options: options.map((option) => ({
        ...option,
        count: counts.get(option.id) ?? 0,
      })),
    };
  });
}

export async function listSuggestions(userId: string) {
  const suggestions = await db.suggestion.findMany({
    where: { status: { in: ["OPEN", "CONSIDERED", "ADOPTED"] } },
    select: {
      id: true,
      title: true,
      body: true,
      status: true,
      createdAt: true,
      author: { select: { name: true } },
      votes: { select: { userId: true } },
    },
    orderBy: { createdAt: "desc" },
    take: 50,
  });

  return suggestions
    .map((suggestion) => ({
      ...suggestion,
      votes: suggestion.votes.length,
      voted: suggestion.votes.some((vote) => vote.userId === userId),
    }))
    .sort((a, b) => b.votes - a.votes);
}

export async function myEngagement(userId: string) {
  const [appointments, callbacks, volunteer] = await Promise.all([
    db.appointment.findMany({
      where: { citizenId: userId },
      select: {
        id: true,
        purpose: true,
        requestedDate: true,
        slot: true,
        status: true,
        staffNote: true,
      },
      orderBy: { requestedDate: "desc" },
      take: 10,
    }),
    db.callbackRequest.findMany({
      where: { citizenId: userId },
      select: { id: true, topic: true, phone: true, preferredTime: true, status: true, createdAt: true },
      orderBy: { createdAt: "desc" },
      take: 10,
    }),
    db.volunteer.findUnique({
      where: { userId },
      select: { id: true, skills: true, availability: true, status: true },
    }),
  ]);

  return { appointments, callbacks, volunteer };
}

/** The office's side: everything waiting on a human, oldest first. */
export async function staffEngagementQueues() {
  const [appointments, callbacks, suggestions, volunteers] = await Promise.all([
    db.appointment.findMany({
      where: { status: { in: ["REQUESTED", "CONFIRMED"] } },
      select: {
        id: true,
        purpose: true,
        requestedDate: true,
        slot: true,
        status: true,
        citizen: { select: { name: true, phone: true } },
      },
      orderBy: { requestedDate: "asc" },
      take: 50,
    }),
    db.callbackRequest.findMany({
      where: { status: "PENDING" },
      select: {
        id: true,
        topic: true,
        phone: true,
        preferredTime: true,
        createdAt: true,
        citizen: { select: { name: true } },
      },
      orderBy: { createdAt: "asc" },
      take: 50,
    }),
    db.suggestion.findMany({
      select: {
        id: true,
        title: true,
        body: true,
        status: true,
        createdAt: true,
        author: { select: { name: true } },
        _count: { select: { votes: true } },
      },
      orderBy: { createdAt: "desc" },
      take: 50,
    }),
    db.volunteer.findMany({
      select: {
        id: true,
        skills: true,
        availability: true,
        status: true,
        user: { select: { name: true, phone: true } },
      },
      orderBy: { createdAt: "desc" },
      take: 50,
    }),
  ]);

  return { appointments, callbacks, suggestions, volunteers };
}
