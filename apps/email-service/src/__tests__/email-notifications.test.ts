import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";
import { dbIndexer } from "@proposalsapp/db-indexer";
import { dbWeb } from "@proposalsapp/db-web";
// Import the *types* for props
import type { NewProposalEmailProps } from "@proposalsapp/emails/emails/new-proposal";
import type { NewDiscussionEmailProps } from "@proposalsapp/emails/emails/new-discussion";
import type { EndingProposalEmailProps } from "@proposalsapp/emails/emails/ending-proposal";
// Import the mocked implementations
import {
  resend,
  NewProposalEmailTemplate,
  NewDiscussionEmailTemplate,
  EndingProposalEmailTemplate,
} from "@proposalsapp/emails";
import request from "supertest";

// --- Mock Dependencies ---

vi.mock("node-cron", () => ({
  default: { schedule: vi.fn() },
  schedule: vi.fn(),
}));

vi.mock("axios", () => ({
  default: { get: vi.fn().mockResolvedValue({ status: 200 }) },
  get: vi.fn().mockResolvedValue({ status: 200 }),
}));

vi.mock("@proposalsapp/db-indexer", () => ({
  dbIndexer: {
    selectFrom: vi.fn(),
  },
}));

vi.mock("@proposalsapp/db-web", () => ({
  dbWeb: {
    selectFrom: vi.fn(),
    insertInto: vi.fn(),
  },
}));

// --- Corrected Mock for @proposalsapp/emails ---
// Define the mock structure directly, avoiding importOriginal()
// Add ': any' return type to template mocks to satisfy Element type check
vi.mock("@proposalsapp/emails", () => ({
  resend: {
    emails: {
      send: vi.fn(),
    },
  },
  NewProposalEmailTemplate: vi.fn(
    (
      props: NewProposalEmailProps,
    ): any => // Fix: Return type any
      `<div>Mock New Proposal Email: ${props.proposalName}</div>`,
  ),
  NewDiscussionEmailTemplate: vi.fn(
    (
      props: NewDiscussionEmailProps,
    ): any => // Fix: Return type any
      `<div>Mock New Discussion Email: ${props.discussionTitle}</div>`,
  ),
  EndingProposalEmailTemplate: vi.fn(
    (
      props: EndingProposalEmailProps,
    ): any => // Fix: Return type any
      `<div>Mock Ending Proposal Email: ${props.proposalName}</div>`,
  ),
}));

// --- Prevent Initial Run in index.ts ---
vi.mock("../index", async (importOriginal) => {
  const actual = (await importOriginal()) as any;
  return {
    ...actual,
    runScheduledJobs: vi.fn(),
    sendUptimePing: vi.fn(),
  };
});

// --- Test Suite ---

describe("Email Notifications", () => {
  // Define consistent mock data
  const mockDao = { id: "dao1", name: "Test DAO", slug: "test-dao" };
  const mockProposal = {
    id: "prop1",
    daoId: "dao1",
    externalId: "externalProp1",
    governorId: "gov1",
    createdAt: new Date(Date.now() - 30 * 60 * 1000),
    name: "Test Proposal",
    title: "Test Proposal Title",
    endAt: new Date(Date.now() + 24 * 60 * 60 * 1000),
    author: "0xAuthorAddress",
  };
  const mockProposalGroup = {
    id: "group1",
    daoId: "dao1",
    name: "Valid Group",
    items: [
      { type: "proposal", externalId: "externalProp1", governorId: "gov1" },
    ],
  };
  const mockAuthorVoter = { address: "0xAuthorAddress", ens: "author.eth" };
  const mockUser = {
    id: "user1",
    email: "test@example.com",
    emailSettingsNewProposals: true,
    emailSettingsNewDiscussions: true,
    emailSettingsEndingProposals: true,
  };
  const mockDiscussion = {
    id: "disc1",
    proposalId: "prop1",
    createdAt: new Date(Date.now() - 30 * 60 * 1000),
    title: "Test Discussion",
    daoDiscourseId: "discourse1",
    externalId: 123,
  };
  const mockDaoDiscourse = { id: "discourse1", daoId: "dao1" };
  const mockFirstPost = {
    topicId: 123,
    daoDiscourseId: "discourse1",
    postNumber: 1,
    userId: 999,
  };
  const mockDiscourseUser = {
    externalId: 999,
    daoDiscourseId: "discourse1",
    username: "discourseUser",
    avatarTemplate: "avatar.png",
  };
  const mockDiscussionGroup = {
    id: "group2",
    daoId: "dao1",
    name: "Discussion Group",
    items: [{ type: "topic", externalId: "123", daoDiscourseId: "discourse1" }],
  };

  // Mock Kysely chain helper
  const createMockKyselyChain = (
    result: any,
    method: "execute" | "executeTakeFirst" = "execute",
  ) =>
    ({
      select: vi.fn().mockReturnThis(),
      selectAll: vi.fn().mockReturnThis(),
      where: vi.fn().mockReturnThis(),
      limit: vi.fn().mockReturnThis(),
      offset: vi.fn().mockReturnThis(),
      orderBy: vi.fn().mockReturnThis(),
      innerJoin: vi.fn().mockReturnThis(),
      [method]: vi.fn().mockResolvedValue(result),
    }) as any;

  // Variables for imported functions/app
  let checkNewProposals: typeof import("../index").checkNewProposals;
  let checkNewDiscussions: typeof import("../index").checkNewDiscussions;
  let checkEndingProposals: typeof import("../index").checkEndingProposals;
  let app: typeof import("../index").app;

  beforeEach(async () => {
    vi.clearAllMocks(); // Clear calls and reset mocks defined with vi.fn()

    // Re-import the mocked index module
    const indexModule = await import("../index");
    checkNewProposals = indexModule.checkNewProposals;
    checkNewDiscussions = indexModule.checkNewDiscussions;
    checkEndingProposals = indexModule.checkEndingProposals;
    app = indexModule.app;

    // Reset mocks to default states
    vi.mocked(resend.emails.send).mockResolvedValue({
      data: { id: "email-id-123" },
      error: null,
    });

    vi.mocked(dbWeb.insertInto).mockReturnValue({
      values: vi.fn().mockReturnThis(),
      execute: vi.fn().mockResolvedValue({}),
    } as any);

    vi.mocked(dbIndexer.selectFrom).mockImplementation((from: any) => {
      return createMockKyselyChain([], "execute");
    });
    vi.mocked(dbWeb.selectFrom).mockImplementation((from: any) => {
      return createMockKyselyChain([], "execute");
    });

    // Template mocks are now fully defined in the top-level vi.mock,
    // no need to reset implementations here, clearAllMocks handles call clearing.
  });

  afterEach(() => {
    vi.restoreAllMocks();
  });

  // --- Test Cases ---
  // (Assertions remain the same, checking the string output of the mocks)

  describe("checkNewProposals", () => {
    it("should send email for new proposals", async () => {
      // Setup specific mocks for this test
      vi.mocked(dbIndexer.selectFrom).mockImplementation((from: any) => {
        const tableName = String(from); // Convert to string for comparison
        switch (tableName) {
          case "proposal":
            return createMockKyselyChain([mockProposal]);
          case "proposalGroup":
            return createMockKyselyChain([mockProposalGroup]);
          case "voter":
            return createMockKyselyChain(mockAuthorVoter, "executeTakeFirst");
          case "dao":
            return createMockKyselyChain(mockDao, "executeTakeFirst");
          default:
            console.warn(`UNEXPECTED dbIndexer call in test: ${tableName}`);
            return createMockKyselyChain([]);
        }
      });

      vi.mocked(dbWeb.selectFrom).mockImplementation((from: any) => {
        const tableName = String(from); // Convert to string for comparison
        switch (tableName) {
          case "user":
            return createMockKyselyChain([mockUser]);
          case "user_notification":
            return createMockKyselyChain(null, "executeTakeFirst"); // No existing notification
          default:
            console.warn(`UNEXPECTED dbWeb call in test: ${tableName}`);
            return createMockKyselyChain([]);
        }
      });

      // Run the actual function from the imported module
      await checkNewProposals();

      // Verify email was sent ONCE
      expect(resend.emails.send).toHaveBeenCalledTimes(1);
      expect(resend.emails.send).toHaveBeenCalledWith(
        expect.objectContaining({
          to: [mockUser.email],
          subject: `New proposal in ${mockDao.name}`,
          // Check against the new mock template output
          react: `<div>Mock New Proposal Email: ${mockProposal.name}</div>`,
        }),
      );

      // Verify notification was inserted
      expect(dbWeb.insertInto).toHaveBeenCalledWith("user_notification");
      const insertArgs = vi.mocked(dbWeb.insertInto("user_notification").values)
        .mock.calls[0][0];
      expect(insertArgs).toEqual(
        expect.objectContaining({
          userId: mockUser.id,
          type: "EMAIL_NEW_PROPOSAL",
          targetId: mockProposal.id,
        }),
      );
    });
  });

  describe("checkNewDiscussions", () => {
    it("should send email for new discussions", async () => {
      vi.mocked(dbIndexer.selectFrom).mockImplementation((from: any) => {
        const tableName = String(from);
        switch (tableName) {
          case "discourseTopic":
            return createMockKyselyChain([mockDiscussion]);
          case "daoDiscourse":
            return createMockKyselyChain(mockDaoDiscourse, "executeTakeFirst");
          case "discoursePost":
            return createMockKyselyChain(mockFirstPost, "executeTakeFirst");
          case "discourseUser":
            return createMockKyselyChain(mockDiscourseUser, "executeTakeFirst");
          case "proposalGroup":
            return createMockKyselyChain([mockDiscussionGroup]);
          case "dao":
            return createMockKyselyChain(mockDao, "executeTakeFirst");
          default:
            console.warn(`UNEXPECTED dbIndexer call in test: ${tableName}`);
            return createMockKyselyChain([]);
        }
      });

      vi.mocked(dbWeb.selectFrom).mockImplementation((from: any) => {
        const tableName = String(from);
        switch (tableName) {
          case "user":
            return createMockKyselyChain([mockUser]);
          case "user_notification":
            return createMockKyselyChain(null, "executeTakeFirst"); // No existing notification
          default:
            console.warn(`UNEXPECTED dbWeb call in test: ${tableName}`);
            return createMockKyselyChain([]);
        }
      });

      await checkNewDiscussions();

      expect(resend.emails.send).toHaveBeenCalledTimes(1);
      expect(resend.emails.send).toHaveBeenCalledWith(
        expect.objectContaining({
          to: [mockUser.email],
          subject: `New Discussion in ${mockDao.name}`,
          react: `<div>Mock New Discussion Email: ${mockDiscussion.title}</div>`,
        }),
      );
      expect(dbWeb.insertInto).toHaveBeenCalledWith("user_notification");
      const insertArgs = vi.mocked(dbWeb.insertInto("user_notification").values)
        .mock.calls[0][0];
      expect(insertArgs).toEqual(
        expect.objectContaining({
          userId: mockUser.id,
          type: "EMAIL_NEW_DISCUSSION",
          targetId: mockDiscussion.id,
        }),
      );
    });
  });

  describe("checkEndingProposals", () => {
    it("should send email for ending proposals", async () => {
      const endingSoonProposal = {
        ...mockProposal,
        endAt: new Date(Date.now() + 23 * 60 * 60 * 1000), // ~23 hours from now
      };

      vi.mocked(dbIndexer.selectFrom).mockImplementation((from: any) => {
        const tableName = String(from);
        switch (tableName) {
          case "proposal":
            return createMockKyselyChain([endingSoonProposal]);
          case "proposalGroup":
            return createMockKyselyChain([mockProposalGroup]);
          case "dao":
            return createMockKyselyChain(mockDao, "executeTakeFirst");
          default:
            console.warn(`UNEXPECTED dbIndexer call in test: ${tableName}`);
            return createMockKyselyChain([]);
        }
      });

      vi.mocked(dbWeb.selectFrom).mockImplementation((from: any) => {
        const tableName = String(from);
        switch (tableName) {
          case "user":
            return createMockKyselyChain([mockUser]);
          case "user_notification":
            return createMockKyselyChain(null, "executeTakeFirst"); // No existing notification
          default:
            console.warn(`UNEXPECTED dbWeb call in test: ${tableName}`);
            return createMockKyselyChain([]);
        }
      });

      await checkEndingProposals();

      expect(resend.emails.send).toHaveBeenCalledTimes(1);
      expect(resend.emails.send).toHaveBeenCalledWith(
        expect.objectContaining({
          to: [mockUser.email],
          subject: `Proposal ending soon in ${mockDao.name}`,
          react: `<div>Mock Ending Proposal Email: ${endingSoonProposal.name}</div>`,
        }),
      );
      expect(dbWeb.insertInto).toHaveBeenCalledWith("user_notification");
      const insertArgs = vi.mocked(dbWeb.insertInto("user_notification").values)
        .mock.calls[0][0];
      expect(insertArgs).toEqual(
        expect.objectContaining({
          userId: mockUser.id,
          type: "EMAIL_ENDING_PROPOSAL",
          targetId: endingSoonProposal.id,
        }),
      );
    });
  });

  describe("Edge Cases", () => {
    it("should handle empty proposal list gracefully", async () => {
      vi.mocked(dbIndexer.selectFrom).mockImplementation((from: any) => {
        const tableName = String(from);
        if (tableName === "proposal") {
          return createMockKyselyChain([]); // Return empty list
        }
        console.warn(`UNEXPECTED dbIndexer call in test: ${tableName}`);
        return createMockKyselyChain([]);
      });

      await checkNewProposals();

      expect(resend.emails.send).not.toHaveBeenCalled();
      expect(dbIndexer.selectFrom).toHaveBeenCalledWith("proposal");
      expect(dbWeb.selectFrom).not.toHaveBeenCalled();
    });

    it("should skip proposal if not found in any group", async () => {
      vi.mocked(dbIndexer.selectFrom).mockImplementation((from: any) => {
        const tableName = String(from);
        switch (tableName) {
          case "proposal":
            return createMockKyselyChain([mockProposal]);
          case "proposalGroup":
            return createMockKyselyChain([]); // No groups found
          default:
            console.warn(`UNEXPECTED dbIndexer call in test: ${tableName}`);
            return createMockKyselyChain([]);
        }
      });

      const consoleLogSpy = vi.spyOn(console, "log");
      await checkNewProposals();

      expect(resend.emails.send).not.toHaveBeenCalled();
      expect(consoleLogSpy).toHaveBeenCalledWith(
        expect.stringContaining(
          `Proposal ${mockProposal.id} is not part of a group yet`,
        ),
      );
      expect(dbIndexer.selectFrom).toHaveBeenCalledWith("proposal");
      expect(dbIndexer.selectFrom).toHaveBeenCalledWith("proposalGroup");
      expect(dbWeb.selectFrom).not.toHaveBeenCalled();
      consoleLogSpy.mockRestore();
    });

    it("should handle malformed items in proposal groups but still find valid ones", async () => {
      const malformedGroup = {
        id: "groupMalformed",
        daoId: "dao1",
        name: "Malformed Group",
        items: null,
      };
      const validGroup = { ...mockProposalGroup, id: "groupValid" };

      vi.mocked(dbIndexer.selectFrom).mockImplementation((from: any) => {
        const tableName = String(from);
        switch (tableName) {
          case "proposal":
            return createMockKyselyChain([mockProposal]);
          case "proposalGroup":
            return createMockKyselyChain([malformedGroup, validGroup]);
          case "voter":
            return createMockKyselyChain(mockAuthorVoter, "executeTakeFirst");
          case "dao":
            return createMockKyselyChain(mockDao, "executeTakeFirst");
          default:
            console.warn(`UNEXPECTED dbIndexer call in test: ${tableName}`);
            return createMockKyselyChain([]);
        }
      });

      vi.mocked(dbWeb.selectFrom).mockImplementation((from: any) => {
        const tableName = String(from);
        switch (tableName) {
          case "user":
            return createMockKyselyChain([mockUser]);
          case "user_notification":
            return createMockKyselyChain(null, "executeTakeFirst");
          default:
            console.warn(`UNEXPECTED dbWeb call in test: ${tableName}`);
            return createMockKyselyChain([]);
        }
      });

      await checkNewProposals();

      expect(resend.emails.send).toHaveBeenCalledTimes(1);
      expect(dbWeb.insertInto).toHaveBeenCalledWith("user_notification");
      const insertArgs = vi.mocked(dbWeb.insertInto("user_notification").values)
        .mock.calls[0][0];
      expect(insertArgs).toEqual(
        expect.objectContaining({ targetId: mockProposal.id }),
      );
    });
  });

  describe("Error Handling", () => {
    it("should handle database errors gracefully when fetching proposals", async () => {
      const dbError = new Error("Database connection lost");
      vi.mocked(dbIndexer.selectFrom).mockImplementation((from: any) => {
        const tableName = String(from);
        if (tableName === "proposal") {
          return {
            ...createMockKyselyChain([]),
            execute: vi.fn().mockRejectedValue(dbError),
          } as any;
        }
        console.warn(`UNEXPECTED dbIndexer call in test: ${tableName}`);
        return createMockKyselyChain([]);
      });

      const consoleErrorSpy = vi.spyOn(console, "error");
      await checkNewProposals();

      expect(resend.emails.send).not.toHaveBeenCalled();
      expect(consoleErrorSpy).toHaveBeenCalledWith(
        "Error checking new proposals:",
        dbError,
      );
      consoleErrorSpy.mockRestore();
      await expect(checkNewProposals()).resolves.not.toThrow();
    });

    it("should handle database errors gracefully when fetching groups inside the loop", async () => {
      const dbError = new Error("Group Database error");
      vi.mocked(dbIndexer.selectFrom).mockImplementation((from: any) => {
        const tableName = String(from);
        switch (tableName) {
          case "proposal":
            return createMockKyselyChain([mockProposal]);
          case "proposalGroup":
            return {
              ...createMockKyselyChain([]),
              execute: vi.fn().mockRejectedValue(dbError),
            } as any;
          default:
            console.warn(`UNEXPECTED dbIndexer call in test: ${tableName}`);
            return createMockKyselyChain([]);
        }
      });

      const consoleErrorSpy = vi.spyOn(console, "error");
      await checkNewProposals();

      expect(resend.emails.send).not.toHaveBeenCalled();
      expect(consoleErrorSpy).toHaveBeenCalledWith(
        "Error checking new proposals:",
        dbError,
      );
      consoleErrorSpy.mockRestore();
      await expect(checkNewProposals()).resolves.not.toThrow();
    });

    it("should handle email sending errors gracefully", async () => {
      vi.mocked(dbIndexer.selectFrom).mockImplementation((from: any) => {
        const tableName = String(from);
        switch (tableName) {
          case "proposal":
            return createMockKyselyChain([mockProposal]);
          case "proposalGroup":
            return createMockKyselyChain([mockProposalGroup]);
          case "voter":
            return createMockKyselyChain(mockAuthorVoter, "executeTakeFirst");
          case "dao":
            return createMockKyselyChain(mockDao, "executeTakeFirst");
          default:
            console.warn(`UNEXPECTED dbIndexer call in test: ${tableName}`);
            return createMockKyselyChain([]);
        }
      });
      vi.mocked(dbWeb.selectFrom).mockImplementation((from: any) => {
        const tableName = String(from);
        switch (tableName) {
          case "user":
            return createMockKyselyChain([mockUser]);
          case "user_notification":
            return createMockKyselyChain(null, "executeTakeFirst");
          default:
            console.warn(`UNEXPECTED dbWeb call in test: ${tableName}`);
            return createMockKyselyChain([]);
        }
      });

      const emailError = {
        name: "application_error" as const,
        message: "Email provider unavailable",
      };
      vi.mocked(resend.emails.send).mockResolvedValue({
        data: null,
        error: emailError,
      });

      const consoleErrorSpy = vi.spyOn(console, "error");
      await checkNewProposals();

      expect(resend.emails.send).toHaveBeenCalledTimes(1);
      expect(consoleErrorSpy).toHaveBeenCalledWith(
        `Failed to send new proposal email to ${mockUser.email}:`,
        emailError,
      );
      expect(dbWeb.insertInto).not.toHaveBeenCalled();
      consoleErrorSpy.mockRestore();
    });
  });

  describe("Duplicate Prevention", () => {
    it("should not send duplicate emails for new proposals", async () => {
      vi.mocked(dbIndexer.selectFrom).mockImplementation((from: any) => {
        const tableName = String(from);
        switch (tableName) {
          case "proposal":
            return createMockKyselyChain([mockProposal]);
          case "proposalGroup":
            return createMockKyselyChain([mockProposalGroup]);
          case "voter":
            return createMockKyselyChain(mockAuthorVoter, "executeTakeFirst");
          case "dao":
            return createMockKyselyChain(mockDao, "executeTakeFirst");
          default:
            console.warn(`UNEXPECTED dbIndexer call in test: ${tableName}`);
            return createMockKyselyChain([]);
        }
      });

      const mockExistingNotification = {
        id: "notif1",
        userId: mockUser.id,
        type: "EMAIL_NEW_PROPOSAL",
        targetId: mockProposal.id,
        sentAt: new Date(),
      };
      vi.mocked(dbWeb.selectFrom).mockImplementation((from: any) => {
        const tableName = String(from);
        switch (tableName) {
          case "user":
            return createMockKyselyChain([mockUser]);
          case "user_notification":
            return createMockKyselyChain(
              mockExistingNotification,
              "executeTakeFirst",
            );
          default:
            console.warn(`UNEXPECTED dbWeb call in test: ${tableName}`);
            return createMockKyselyChain([]);
        }
      });

      await checkNewProposals();

      expect(resend.emails.send).not.toHaveBeenCalled();
      expect(dbWeb.insertInto).not.toHaveBeenCalled();
    });
  });

  describe("HTTP Endpoints", () => {
    it("health endpoint should return OK", async () => {
      const response = await request(app).get("/health");
      expect(response.status).toBe(200);
      expect(response.text).toBe("OK");
    });
  });

  describe("Additional Edge Cases for Coverage", () => {
    it("should use empty strings for author info when author (voter) is not found", async () => {
      vi.mocked(dbIndexer.selectFrom).mockImplementation((from: any) => {
        const tableName = String(from);
        switch (tableName) {
          case "proposal":
            return createMockKyselyChain([mockProposal]);
          case "proposalGroup":
            return createMockKyselyChain([mockProposalGroup]);
          case "voter":
            return createMockKyselyChain(null, "executeTakeFirst"); // Author not found
          case "dao":
            return createMockKyselyChain(mockDao, "executeTakeFirst");
          default:
            console.warn(`UNEXPECTED dbIndexer call in test: ${tableName}`);
            return createMockKyselyChain([]);
        }
      });
      vi.mocked(dbWeb.selectFrom).mockImplementation((from: any) => {
        const tableName = String(from);
        switch (tableName) {
          case "user":
            return createMockKyselyChain([mockUser]);
          case "user_notification":
            return createMockKyselyChain(null, "executeTakeFirst");
          default:
            console.warn(`UNEXPECTED dbWeb call in test: ${tableName}`);
            return createMockKyselyChain([]);
        }
      });

      const templateSpy = vi.mocked(NewProposalEmailTemplate);
      await checkNewProposals();

      expect(resend.emails.send).toHaveBeenCalledTimes(1);
      expect(templateSpy).toHaveBeenCalledWith(
        expect.objectContaining({
          authorAddress: "",
          authorEns: "",
          proposalName: mockProposal.name,
        }),
      );
      expect(dbWeb.insertInto).toHaveBeenCalledTimes(1);
    });

    it("should skip sending email to users without an email address", async () => {
      const userWithoutEmail = { ...mockUser, id: "user2", email: null };
      vi.mocked(dbIndexer.selectFrom).mockImplementation((from: any) => {
        const tableName = String(from);
        switch (tableName) {
          case "proposal":
            return createMockKyselyChain([mockProposal]);
          case "proposalGroup":
            return createMockKyselyChain([mockProposalGroup]);
          case "voter":
            return createMockKyselyChain(mockAuthorVoter, "executeTakeFirst");
          case "dao":
            return createMockKyselyChain(mockDao, "executeTakeFirst");
          default:
            console.warn(`UNEXPECTED dbIndexer call in test: ${tableName}`);
            return createMockKyselyChain([]);
        }
      });
      vi.mocked(dbWeb.selectFrom).mockImplementation((from: any) => {
        const tableName = String(from);
        switch (tableName) {
          case "user":
            return createMockKyselyChain([userWithoutEmail]);
          default:
            console.warn(`UNEXPECTED dbWeb call in test: ${tableName}`);
            return createMockKyselyChain([]);
        }
      });

      await checkNewProposals();

      expect(resend.emails.send).not.toHaveBeenCalled();
      expect(dbWeb.insertInto).not.toHaveBeenCalled();
      expect(dbWeb.selectFrom).toHaveBeenCalledWith("user");
      expect(dbWeb.selectFrom).not.toHaveBeenCalledWith("user_notification");
    });
  });
}); // End describe("Email Notifications")
