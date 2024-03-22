import type * as Party from "partykit/server";

type Votes = Record<string, Record<string, string>>;

const Questions: Record<
  string,
  {
    id: string;
    title: string;
    options: Record<
      string,
      {
        id: string;
        value: string | number;
      }
    >;
  }
> = {
  "0": {
    id: "0",
    title:
      "Which of these color contrast ratios defines the minimum WCAG 2.1 Level AA requirement for normal text?",
    options: {
      A: {
        id: "A",
        value: "4.5: 1",
      },
      B: {
        id: "B",
        value: "3: 1",
      },
      C: {
        id: "C",
        value: "2.5: 1",
      },
      D: {
        id: "D",
        value: "5: 1",
      },
    },
  },
  "1": {
    id: "1",
    title: "What's the best way to debug JavaScript code?",
    options: {
      A: {
        id: "A",
        value: "Console.log all the things!",
      },
      B: {
        id: "B",
        value: "Ask a rubber duck for help. It knows everything.",
      },
      C: {
        id: "C",
        value: "Push it to production and let users find the bugs.",
      },
      D: {
        id: "D",
        value: "Rewrite the application in a different language.",
      },
    },
  },
  "2": {
    id: "2",
    title: "Will you come to the next in person meetup? 🎉",
    options: {
      A: {
        id: "A",
        value: "Yes!",
      },
      B: {
        id: "B",
        value: "Oh yes!",
      },
      C: {
        id: "C",
        value: "Yes and I'm giving a talk!",
      },
      D: {
        id: "D",
        value: "Yes and I'm bringing a friend!",
      },
    },
  },
};

export default class Server implements Party.Server {
  constructor(readonly room: Party.Room) {}
  votes: Votes = {};
  page: string = "/";

  // Update a user's vote
  vote(questionId: string, userId: string, answerId: string): void {
    if (!this.votes[questionId]) {
      this.votes[questionId] = {};
    }
    this.votes[questionId][userId] = answerId;
  }

  // Get the results for a question
  getResults(questionId: string): Record<string, number> {
    const votes = this.votes[questionId];
    const results: Record<string, number> = {};
    if (!votes) {
      return results;
    }
    for (const userId in votes) {
      const answerId = votes[userId];
      if (!results[answerId]) {
        results[answerId] = 0;
      }
      results[answerId] += 1;
    }
    return results;
  }

  // Get the results for ALL questions
  getAllResults(): Record<string, Record<string, number>> {
    const questionsIds = Object.keys(this.votes);
    const value: Record<string, Record<string, number>> = {};
    for (const questionId of questionsIds) {
      value[questionId] = this.getResults(questionId);
    }
    return value;
  }

  async onStart() {
    this.votes = (await this.room.storage.get("votes")) || {};
    setInterval(() => {
      const results = this.getAllResults();
      const response = JSON.stringify({
        senderId: "server",
        type: "sync",
        results,
        questions: Questions,
        navigation: this.page,
      });
      console.log("🚨");
      console.log("\t results", results);
      console.log("\t questions", Questions);
      console.log("\t navigation", this.page);
      console.log("\n\n");

      this.room.broadcast(response);
    }, 1000);
  }

  async onConnect(conn: Party.Connection, ctx: Party.ConnectionContext) {
    // A websocket just connected!
    console.log(
      `Connected:
      id: ${conn.id}
      room: ${this.room.id}
      url: ${new URL(ctx.request.url).pathname}`,
    );
    const information = {
      senderId: "server",
      value: "hello from server",
      type: "",
    };
    // let's send a message to the connection
    conn.send(JSON.stringify(information));
  }

  async onMessage(message: string, sender: Party.Connection) {
    const msg = JSON.parse(message);
  
    if (msg.type === "vote") {
      console.log("Voting", msg);
      this.vote(msg.questionId, msg.userId, msg.optionId);
      this.room.broadcast(
        JSON.stringify({
          senderId: sender.id,
          type: "answers",
          value: this.getAllResults(),
        }),
      );
      await this.room.storage.put("votes", this.votes);
    }
  
    if (msg.type === "clear") {
      console.log("Clearing Votes");
      this.votes = {};
    }

    if (msg.type === "navigation") {
      console.log("Navigating");
      this.page = msg.value;
      this.room.broadcast(
        JSON.stringify({ type: "navigation", value: `${this.page}` }),
        [sender.id],
      );
    }
  }
}

Server satisfies Party.Worker;
