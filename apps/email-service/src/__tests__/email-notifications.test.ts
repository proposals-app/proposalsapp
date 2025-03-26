import { describe, it, expect, vi, beforeEach } from "vitest";
import { dbIndexer } from "@proposalsapp/db-indexer";
import { dbWeb } from "@proposalsapp/db-web";
import { NewProposalEmailTemplate, resend } from "@proposalsapp/emails";
import request from "supertest";

// Mock additional modules
vi.mock("node-cron", () => ({
  default: { schedule: vi.fn() },
  schedule: vi.fn(),
}));

vi.mock("axios", () => ({
  default: { get: vi.fn().mockResolvedValue({ status: 200 }) },
  get: vi.fn().mockResolvedValue({ status: 200 }),
}));

// Mock the database modules using mockImplementation for granular control
vi.mock("@proposalsapp/db-indexer", () => ({
  dbIndexer: {
    selectFrom: vi.fn(),
  },
}));

vi.mock("@proposalsapp/db-web", () => ({
  dbWeb: {
    selectFrom: vi.fn(),
    insertInto: vi.fn().mockReturnValue({
      values: vi.fn().mockReturnValue({
        execute: vi.fn().mockResolvedValue({}), // Default mock for insert
      }),
    }),
  },
}));

vi.mock("@proposalsapp/emails", () => ({
  resend: {
    emails: {
      send: vi.fn().mockResolvedValue({ data: {}, error: null }), // Default success
    },
  },
  NewProposalEmailTemplate: vi
    .fn()
    .mockReturnValue("<div>New Proposal Email</div>"), // Use simple string for template mock
  NewDiscussionEmailTemplate: vi
    .fn()
    .mockReturnValue("<div>New Discussion Email</div>"),
  EndingProposalEmailTemplate: vi
    .fn()
    .mockReturnValue("<div>Ending Proposal Email</div>"),
}));

// --- Helper Function for Mocking DB Calls ---
// This simplifies setting up mocks for specific table queries
const mockDbQuery = (
  db: "indexer" | "web",
  table: string,
  method: "execute" | "executeTakeFirst",
  result: any,
) => {
  const dbMock =
    db === "indexer"
      ? vi.mocked(dbIndexer.selectFrom)
      : vi.mocked(dbWeb.selectFrom);
  const mockChain = {
    select: vi.fn().mockReturnThis(),
    selectAll: vi.fn().mockReturnThis(),
    where: vi.fn().mockReturnThis(), // Allow multiple where clauses
    values: vi.fn().mockReturnThis(), // For inserts (though handled globally above for now)
    [method]: vi.fn().mockResolvedValue(result),
  };
  dbMock.mockImplementation((tableName) => {
    if (tableName === table) {
      // Return the specific mock chain for this table query
      // We need to return a *new* object each time for chain integrity if called multiple times
      return {
        select: vi.fn().mockReturnThis(),
        selectAll: vi.fn().mockReturnThis(),
        where: vi.fn().mockReturnThis(),
        [method]: vi.fn().mockResolvedValue(result),
      } as any; // Use 'as any' to bypass complex type checking for mocks
    }
    // If it's a different table, return the previous implementation or a default mock
    // This requires careful chaining or more complex mock management if multiple tables are queried in one test
    // For simplicity here, we often overwrite, assuming one primary query per table type per test step
    return {
      select: vi.fn().mockReturnThis(),
      selectAll: vi.fn().mockReturnThis(),
      where: vi.fn().mockReturnThis(),
      execute: vi.fn().mockResolvedValue([]), // Default empty array
      executeTakeFirst: vi.fn().mockResolvedValue(null), // Default null
    } as any;
  });
  return mockChain[method]; // Return the final method mock for potential assertions
};

// --- Test Setup ---

describe("Email Notifications", () => {
  const mockDao = { id: "dao1", name: "Test DAO", slug: "test-dao" };
  const mockProposal = {
    id: "prop1",
    daoId: "dao1",
    externalId: "externalProp1",
    governorId: "gov1",
    createdAt: new Date(Date.now() - 30 * 60 * 1000), // 30 mins ago
    name: "Test Proposal",
    title: "Test Proposal Title", // Added for ending proposals
    endAt: new Date(Date.now() + 24 * 60 * 60 * 1000), // 24 hours from now
    author: "0xAuthorAddress",
  };
  const mockProposalGroup = {
    id: "group1",
    daoId: "dao1",
    items: [
      { type: "proposal", externalId: "externalProp1", governorId: "gov1" },
    ],
  };
  const mockAuthorVoter = { address: "0xAuthorAddress", ens: "author.eth" };
  const mockUser = { id: "user1", email: "test@example.com" };
  const mockDiscussion = {
    id: "disc1",
    proposalId: "prop1",
    createdAt: new Date(Date.now() - 30 * 60 * 1000), // 30 mins ago
    title: "Test Discussion",
    daoDiscourseId: "discourse1",
    externalId: "123", // Discourse topic ID
  };
  const mockDaoDiscourse = { id: "discourse1", daoId: "dao1" };
  const mockFirstPost = {
    topicId: 123,
    daoDiscourseId: "discourse1",
    postNumber: 1,
    userId: 999 /* Discourse User ID */,
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
    items: [{ type: "topic", externalId: "123", daoDiscourseId: "discourse1" }],
  };

  beforeEach(() => {
    vi.clearAllMocks();
    // Reset mocks to default behavior before each test
    vi.mocked(dbIndexer.selectFrom).mockImplementation(
      () =>
        ({
          select: vi.fn().mockReturnThis(),
          selectAll: vi.fn().mockReturnThis(),
          where: vi.fn().mockReturnThis(),
          execute: vi.fn().mockResolvedValue([]),
          executeTakeFirst: vi.fn().mockResolvedValue(null),
        }) as any,
    );
    vi.mocked(dbWeb.selectFrom).mockImplementation(
      () =>
        ({
          select: vi.fn().mockReturnThis(),
          selectAll: vi.fn().mockReturnThis(),
          where: vi.fn().mockReturnThis(),
          execute: vi.fn().mockResolvedValue([]),
          executeTakeFirst: vi.fn().mockResolvedValue(null),
        }) as any,
    );
    vi.mocked(dbWeb.insertInto).mockReturnValue({
      values: vi.fn().mockReturnValue({
        execute: vi.fn().mockResolvedValue({}),
      }),
    } as any);
    vi.mocked(resend.emails.send).mockResolvedValue({
      data: {
        id: "",
      },
      error: null,
    }); // Reset email mock
  });

  describe("checkNewProposals", () => {
    it("should send email for new proposals", async () => {
      // Setup specific mocks for this test using mockImplementation
      vi.mocked(dbIndexer.selectFrom)
        .mockImplementationOnce((table) => {
          // 1. Fetch new proposals
          expect(table).toBe("proposal");
          return {
            selectAll: vi.fn().mockReturnThis(),
            where: vi.fn().mockReturnThis(),
            execute: vi.fn().mockResolvedValue([mockProposal]),
          } as any;
        })
        .mockImplementationOnce((table) => {
          // 2. Fetch proposal groups (inside loop)
          expect(table).toBe("proposalGroup");
          return {
            selectAll: vi.fn().mockReturnThis(),
            where: vi.fn().mockReturnThis(),
            execute: vi.fn().mockResolvedValue([mockProposalGroup]),
          } as any;
        })
        .mockImplementationOnce((table) => {
          // 3. Fetch author (inside loop)
          expect(table).toBe("voter");
          return {
            selectAll: vi.fn().mockReturnThis(),
            where: vi.fn().mockReturnThis(),
            executeTakeFirst: vi.fn().mockResolvedValue(mockAuthorVoter),
          } as any;
        })
        .mockImplementationOnce((table) => {
          // 4. Fetch users (inside loop) - actually dbWeb
          expect(table).toBe("dao"); // 4. Fetch DAO (inside loop)
          return {
            selectAll: vi.fn().mockReturnThis(),
            where: vi.fn().mockReturnThis(),
            executeTakeFirst: vi.fn().mockResolvedValue(mockDao),
          } as any;
        });

      vi.mocked(dbWeb.selectFrom)
        .mockImplementationOnce((table) => {
          // 5. Fetch users (inside loop)
          expect(table).toBe("user");
          return {
            select: vi.fn().mockReturnThis(),
            where: vi.fn().mockReturnThis(),
            execute: vi.fn().mockResolvedValue([mockUser]),
          } as any;
        })
        .mockImplementationOnce((table) => {
          // 6. Check existing notification (inside user loop)
          expect(table).toBe("userNotification");
          return {
            selectAll: vi.fn().mockReturnThis(),
            where: vi.fn().mockReturnThis(),
            executeTakeFirst: vi.fn().mockResolvedValue(null),
          } as any;
        });

      // Import and run the function
      const { checkNewProposals } = await import("../index");
      await checkNewProposals();

      // Verify email was sent
      expect(resend.emails.send).toHaveBeenCalledTimes(1);
      expect(resend.emails.send).toHaveBeenCalledWith(
        expect.objectContaining({
          to: [mockUser.email],
          subject: `New proposal in ${mockDao.name}`,
          react: expect.anything(), // React component mock
        }),
      );
      // Verify notification was inserted
      expect(dbWeb.insertInto).toHaveBeenCalledWith("userNotification");
      expect(
        vi.mocked(dbWeb.insertInto("userNotification").values).mock.calls[0][0],
      ).toEqual(
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
      vi.mocked(dbIndexer.selectFrom)
        .mockImplementationOnce((table) => {
          // 1. Fetch new discussions
          expect(table).toBe("discourseTopic");
          return {
            selectAll: vi.fn().mockReturnThis(),
            where: vi.fn().mockReturnThis(),
            execute: vi.fn().mockResolvedValue([mockDiscussion]),
          } as any;
        })
        .mockImplementationOnce((table) => {
          // 2. Fetch daoDiscourse (inside loop)
          expect(table).toBe("daoDiscourse");
          return {
            selectAll: vi.fn().mockReturnThis(),
            where: vi.fn().mockReturnThis(),
            executeTakeFirst: vi.fn().mockResolvedValue(mockDaoDiscourse),
          } as any;
        })
        .mockImplementationOnce((table) => {
          // 3. Fetch first post (inside loop)
          expect(table).toBe("discoursePost");
          return {
            selectAll: vi.fn().mockReturnThis(),
            where: vi.fn().mockReturnThis(),
            executeTakeFirst: vi.fn().mockResolvedValue(mockFirstPost),
          } as any;
        })
        .mockImplementationOnce((table) => {
          // 4. Fetch discourse user (inside loop)
          expect(table).toBe("discourseUser");
          return {
            selectAll: vi.fn().mockReturnThis(),
            where: vi.fn().mockReturnThis(),
            executeTakeFirst: vi.fn().mockResolvedValue(mockDiscourseUser),
          } as any;
        })
        .mockImplementationOnce((table) => {
          // 5. Fetch proposal groups (inside loop)
          expect(table).toBe("proposalGroup");
          return {
            selectAll: vi.fn().mockReturnThis(),
            where: vi.fn().mockReturnThis(),
            execute: vi.fn().mockResolvedValue([mockDiscussionGroup]),
          } as any;
        })
        .mockImplementationOnce((table) => {
          // 6. Fetch DAO (inside loop)
          expect(table).toBe("dao");
          return {
            selectAll: vi.fn().mockReturnThis(),
            where: vi.fn().mockReturnThis(),
            executeTakeFirst: vi.fn().mockResolvedValue(mockDao),
          } as any;
        });

      vi.mocked(dbWeb.selectFrom)
        .mockImplementationOnce((table) => {
          // 7. Fetch users (inside loop)
          expect(table).toBe("user");
          return {
            select: vi.fn().mockReturnThis(),
            where: vi.fn().mockReturnThis(),
            execute: vi.fn().mockResolvedValue([mockUser]),
          } as any;
        })
        .mockImplementationOnce((table) => {
          // 8. Check existing notification (inside user loop)
          expect(table).toBe("userNotification");
          return {
            selectAll: vi.fn().mockReturnThis(),
            where: vi.fn().mockReturnThis(),
            executeTakeFirst: vi.fn().mockResolvedValue(null),
          } as any;
        });

      // Import and run the function
      const { checkNewDiscussions } = await import("../index");
      await checkNewDiscussions();

      // Verify email was sent
      expect(resend.emails.send).toHaveBeenCalledTimes(1);
      expect(resend.emails.send).toHaveBeenCalledWith(
        expect.objectContaining({
          to: [mockUser.email],
          subject: `New Discussion in ${mockDao.name}`,
        }),
      );
      // Verify notification was inserted
      expect(dbWeb.insertInto).toHaveBeenCalledWith("userNotification");
      expect(
        vi.mocked(dbWeb.insertInto("userNotification").values).mock.calls[0][0],
      ).toEqual(
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
      vi.mocked(dbIndexer.selectFrom)
        .mockImplementationOnce((table) => {
          // 1. Fetch ending proposals
          expect(table).toBe("proposal");
          return {
            selectAll: vi.fn().mockReturnThis(),
            where: vi.fn().mockReturnThis(),
            execute: vi.fn().mockResolvedValue([mockProposal]),
          } as any;
        })
        .mockImplementationOnce((table) => {
          // 2. Fetch proposal groups (inside loop)
          expect(table).toBe("proposalGroup");
          return {
            selectAll: vi.fn().mockReturnThis(),
            where: vi.fn().mockReturnThis(),
            execute: vi.fn().mockResolvedValue([mockProposalGroup]),
          } as any;
        })
        .mockImplementationOnce((table) => {
          // 3. Fetch DAO (inside loop)
          expect(table).toBe("dao");
          return {
            selectAll: vi.fn().mockReturnThis(),
            where: vi.fn().mockReturnThis(),
            executeTakeFirst: vi.fn().mockResolvedValue(mockDao),
          } as any;
        });

      vi.mocked(dbWeb.selectFrom)
        .mockImplementationOnce((table) => {
          // 4. Fetch users (inside loop)
          expect(table).toBe("user");
          return {
            select: vi.fn().mockReturnThis(),
            where: vi.fn().mockReturnThis(),
            execute: vi.fn().mockResolvedValue([mockUser]),
          } as any;
        })
        .mockImplementationOnce((table) => {
          // 5. Check existing notification (inside user loop)
          expect(table).toBe("userNotification");
          return {
            selectAll: vi.fn().mockReturnThis(),
            where: vi.fn().mockReturnThis(),
            executeTakeFirst: vi.fn().mockResolvedValue(null),
          } as any;
        });

      // Import and run the function
      const { checkEndingProposals } = await import("../index");
      await checkEndingProposals();

      // Verify email was sent
      expect(resend.emails.send).toHaveBeenCalledTimes(1);
      expect(resend.emails.send).toHaveBeenCalledWith(
        expect.objectContaining({
          to: [mockUser.email],
          subject: `Proposal ending soon in ${mockDao.name}`,
        }),
      );
      // Verify notification was inserted
      expect(dbWeb.insertInto).toHaveBeenCalledWith("userNotification");
      expect(
        vi.mocked(dbWeb.insertInto("userNotification").values).mock.calls[0][0],
      ).toEqual(
        expect.objectContaining({
          userId: mockUser.id,
          type: "EMAIL_ENDING_PROPOSAL",
          targetId: mockProposal.id,
        }),
      );
    });
  });

  describe("Edge Cases", () => {
    it("should handle empty proposal list gracefully", async () => {
      vi.mocked(dbIndexer.selectFrom).mockImplementationOnce((table) => {
        // 1. Fetch new proposals -> returns empty
        expect(table).toBe("proposal");
        return {
          selectAll: vi.fn().mockReturnThis(),
          where: vi.fn().mockReturnThis(),
          execute: vi.fn().mockResolvedValue([]),
        } as any;
      });

      // Import and run the function
      const { checkNewProposals } = await import("../index");
      await checkNewProposals();

      // Verify email was not sent
      expect(resend.emails.send).not.toHaveBeenCalled();
      expect(dbIndexer.selectFrom).toHaveBeenCalledTimes(1); // Only the first call happened
      expect(dbWeb.selectFrom).not.toHaveBeenCalled();
    });

    it("should skip proposal if not found in any group", async () => {
      // Mocks: proposal exists, but group lookup returns empty or non-matching groups
      vi.mocked(dbIndexer.selectFrom)
        .mockImplementationOnce((table) => {
          // 1. Fetch new proposals
          expect(table).toBe("proposal");
          return {
            selectAll: vi.fn().mockReturnThis(),
            where: vi.fn().mockReturnThis(),
            execute: vi.fn().mockResolvedValue([mockProposal]),
          } as any;
        })
        .mockImplementationOnce((table) => {
          // 2. Fetch proposal groups -> returns empty
          expect(table).toBe("proposalGroup");
          return {
            selectAll: vi.fn().mockReturnThis(),
            where: vi.fn().mockReturnThis(),
            execute: vi.fn().mockResolvedValue([]),
          } as any;
        });
      // No further dbIndexer calls should happen for this proposal

      const consoleLogSpy = vi.spyOn(console, "log");

      // Import and run the function
      const { checkNewProposals } = await import("../index");
      await checkNewProposals();

      // Verify email was not sent and correct log message appeared
      expect(resend.emails.send).not.toHaveBeenCalled();
      expect(consoleLogSpy).toHaveBeenCalledWith(
        expect.stringContaining(
          `Proposal ${mockProposal.id} is not part of a group yet`,
        ),
      );
      expect(dbIndexer.selectFrom).toHaveBeenCalledTimes(2); // proposal + proposalGroup
      expect(dbWeb.selectFrom).not.toHaveBeenCalled();
      consoleLogSpy.mockRestore();
    });

    it("should handle malformed items in proposal groups but still find valid ones", async () => {
      // Setup: One valid group, one malformed group. The code should find the valid one.
      const malformedGroup = {
        id: "groupMalformed",
        daoId: "dao1",
        items: null,
      }; // simulate null items
      const validGroup = {
        id: "groupValid",
        daoId: "dao1",
        items: mockProposalGroup.items,
      };

      vi.mocked(dbIndexer.selectFrom)
        .mockImplementationOnce((table) => {
          // 1. Fetch new proposals
          expect(table).toBe("proposal");
          return {
            selectAll: vi.fn().mockReturnThis(),
            where: vi.fn().mockReturnThis(),
            execute: vi.fn().mockResolvedValue([mockProposal]),
          } as any;
        })
        .mockImplementationOnce((table) => {
          // 2. Fetch proposal groups (returns both)
          expect(table).toBe("proposalGroup");
          return {
            selectAll: vi.fn().mockReturnThis(),
            where: vi.fn().mockReturnThis(),
            execute: vi.fn().mockResolvedValue([malformedGroup, validGroup]),
          } as any;
        })
        .mockImplementationOnce((table) => {
          // 3. Fetch author
          expect(table).toBe("voter");
          return {
            selectAll: vi.fn().mockReturnThis(),
            where: vi.fn().mockReturnThis(),
            executeTakeFirst: vi.fn().mockResolvedValue(mockAuthorVoter),
          } as any;
        })
        .mockImplementationOnce((table) => {
          // 4. Fetch DAO
          expect(table).toBe("dao");
          return {
            selectAll: vi.fn().mockReturnThis(),
            where: vi.fn().mockReturnThis(),
            executeTakeFirst: vi.fn().mockResolvedValue(mockDao),
          } as any;
        });

      vi.mocked(dbWeb.selectFrom)
        .mockImplementationOnce((table) => {
          // 5. Fetch users
          expect(table).toBe("user");
          return {
            select: vi.fn().mockReturnThis(),
            where: vi.fn().mockReturnThis(),
            execute: vi.fn().mockResolvedValue([mockUser]),
          } as any;
        })
        .mockImplementationOnce((table) => {
          // 6. Check existing notification
          expect(table).toBe("userNotification");
          return {
            selectAll: vi.fn().mockReturnThis(),
            where: vi.fn().mockReturnThis(),
            executeTakeFirst: vi.fn().mockResolvedValue(null),
          } as any;
        });

      // Import and run the function
      const { checkNewProposals } = await import("../index");
      await checkNewProposals();

      // Email should be sent because the valid group was found
      expect(resend.emails.send).toHaveBeenCalledTimes(1);
      // Notification should be recorded for the *valid* group found
      expect(dbWeb.insertInto).toHaveBeenCalledWith("userNotification");
    });
  });

  describe("Error Handling", () => {
    it("should handle database errors gracefully when fetching proposals", async () => {
      const dbError = new Error("Database error");
      vi.mocked(dbIndexer.selectFrom).mockImplementationOnce((table) => {
        // 1. Fetch new proposals -> throws error
        expect(table).toBe("proposal");
        return {
          selectAll: vi.fn().mockReturnThis(),
          where: vi.fn().mockReturnThis(),
          execute: vi.fn().mockRejectedValue(dbError),
        } as any;
      });

      const consoleErrorSpy = vi.spyOn(console, "error");

      // Import and run the function
      const { checkNewProposals } = await import("../index");

      // Should not throw
      await expect(checkNewProposals()).resolves.not.toThrow();

      // No email should be sent
      expect(resend.emails.send).not.toHaveBeenCalled();
      // Error should be logged
      expect(consoleErrorSpy).toHaveBeenCalledWith(
        "Error checking new proposals:",
        dbError,
      );
      consoleErrorSpy.mockRestore();
    });

    it("should handle database errors gracefully when fetching groups", async () => {
      const dbError = new Error("Group Database error");
      vi.mocked(dbIndexer.selectFrom)
        .mockImplementationOnce((table) => {
          // 1. Fetch new proposals (succeeds)
          expect(table).toBe("proposal");
          return {
            selectAll: vi.fn().mockReturnThis(),
            where: vi.fn().mockReturnThis(),
            execute: vi.fn().mockResolvedValue([mockProposal]),
          } as any;
        })
        .mockImplementationOnce((table) => {
          // 2. Fetch proposal groups -> throws error
          expect(table).toBe("proposalGroup");
          // NOTE: The error happens *inside* the loop, so the outer function's catch block handles it.
          return {
            selectAll: vi.fn().mockReturnThis(),
            where: vi.fn().mockReturnThis(),
            execute: vi.fn().mockRejectedValue(dbError),
          } as any;
        });

      const consoleErrorSpy = vi.spyOn(console, "error");

      // Import and run the function
      const { checkNewProposals } = await import("../index");

      // Should not throw out of the main function
      await expect(checkNewProposals()).resolves.not.toThrow();

      // No email should be sent
      expect(resend.emails.send).not.toHaveBeenCalled();
      // Error should be logged by the outer catch block
      expect(consoleErrorSpy).toHaveBeenCalledWith(
        "Error checking new proposals:", // The outer catch block logs this
        dbError,
      );
      consoleErrorSpy.mockRestore();
    });

    it("should handle email sending errors gracefully", async () => {
      // Setup mocks to allow reaching the email send part
      vi.mocked(dbIndexer.selectFrom)
        .mockImplementationOnce((table) => {
          /* proposals */ return {
            selectAll: vi.fn().mockReturnThis(),
            where: vi.fn().mockReturnThis(),
            execute: vi.fn().mockResolvedValue([mockProposal]),
          } as any;
        })
        .mockImplementationOnce((table) => {
          /* groups */ return {
            selectAll: vi.fn().mockReturnThis(),
            where: vi.fn().mockReturnThis(),
            execute: vi.fn().mockResolvedValue([mockProposalGroup]),
          } as any;
        })
        .mockImplementationOnce((table) => {
          /* author */ return {
            selectAll: vi.fn().mockReturnThis(),
            where: vi.fn().mockReturnThis(),
            executeTakeFirst: vi.fn().mockResolvedValue(mockAuthorVoter),
          } as any;
        })
        .mockImplementationOnce((table) => {
          /* dao */ return {
            selectAll: vi.fn().mockReturnThis(),
            where: vi.fn().mockReturnThis(),
            executeTakeFirst: vi.fn().mockResolvedValue(mockDao),
          } as any;
        });
      vi.mocked(dbWeb.selectFrom)
        .mockImplementationOnce((table) => {
          /* users */ return {
            select: vi.fn().mockReturnThis(),
            where: vi.fn().mockReturnThis(),
            execute: vi.fn().mockResolvedValue([mockUser]),
          } as any;
        })
        .mockImplementationOnce((table) => {
          /* notification check */ return {
            selectAll: vi.fn().mockReturnThis(),
            where: vi.fn().mockReturnThis(),
            executeTakeFirst: vi.fn().mockResolvedValue(null),
          } as any;
        });

      // Mock email sending to return an error
      const emailError = {
        name: "application_error" as const,
        message: "Email provider unavailable",
      };
      vi.mocked(resend.emails.send).mockResolvedValue({
        data: null,
        error: emailError,
      });

      const consoleErrorSpy = vi.spyOn(console, "error");

      // Import and run the function
      const { checkNewProposals } = await import("../index");
      await checkNewProposals();

      // Function should complete without throwing
      expect(resend.emails.send).toHaveBeenCalledTimes(1);
      // Error should be logged
      expect(consoleErrorSpy).toHaveBeenCalledWith(
        `Failed to send new proposal email to ${mockUser.email}:`,
        emailError,
      );
      // Notification should *not* be inserted because email failed
      expect(dbWeb.insertInto).not.toHaveBeenCalled();
      consoleErrorSpy.mockRestore();
    });
  });

  describe("Duplicate Prevention", () => {
    it("should not send duplicate emails", async () => {
      // Setup mocks to allow reaching the notification check
      vi.mocked(dbIndexer.selectFrom)
        .mockImplementationOnce((table) => {
          /* proposals */ return {
            selectAll: vi.fn().mockReturnThis(),
            where: vi.fn().mockReturnThis(),
            execute: vi.fn().mockResolvedValue([mockProposal]),
          } as any;
        })
        .mockImplementationOnce((table) => {
          /* groups */ return {
            selectAll: vi.fn().mockReturnThis(),
            where: vi.fn().mockReturnThis(),
            execute: vi.fn().mockResolvedValue([mockProposalGroup]),
          } as any;
        })
        .mockImplementationOnce((table) => {
          /* author */ return {
            selectAll: vi.fn().mockReturnThis(),
            where: vi.fn().mockReturnThis(),
            executeTakeFirst: vi.fn().mockResolvedValue(mockAuthorVoter),
          } as any;
        })
        .mockImplementationOnce((table) => {
          /* dao */ return {
            selectAll: vi.fn().mockReturnThis(),
            where: vi.fn().mockReturnThis(),
            executeTakeFirst: vi.fn().mockResolvedValue(mockDao),
          } as any;
        });
      vi.mocked(dbWeb.selectFrom)
        .mockImplementationOnce((table) => {
          /* users */ return {
            select: vi.fn().mockReturnThis(),
            where: vi.fn().mockReturnThis(),
            execute: vi.fn().mockResolvedValue([mockUser]),
          } as any;
        })
        .mockImplementationOnce((table) => {
          // 6. Check existing notification -> FOUND
          expect(table).toBe("userNotification");
          const mockExistingNotification = {
            id: "notif1",
            userId: mockUser.id,
            type: "EMAIL_NEW_PROPOSAL",
            targetId: mockProposal.id,
            sentAt: new Date(),
          };
          return {
            selectAll: vi.fn().mockReturnThis(),
            where: vi.fn().mockReturnThis(),
            executeTakeFirst: vi
              .fn()
              .mockResolvedValue(mockExistingNotification),
          } as any;
        });

      // Import and run the function
      const { checkNewProposals } = await import("../index");
      await checkNewProposals();

      // Email should not be sent
      expect(resend.emails.send).not.toHaveBeenCalled();
      // Notification should not be inserted again
      expect(dbWeb.insertInto).not.toHaveBeenCalled();
    });
  });

  describe("HTTP Endpoints", () => {
    it("health endpoint should return OK", async () => {
      // Need to ensure the app instance is available. Import might trigger server start.
      // If tests run in parallel or sequence matters, this needs careful handling.
      // Assuming import is safe here for simplicity.
      const { app } = await import("../index");
      const response = await request(app).get("/health");
      expect(response.status).toBe(200);
      expect(response.text).toBe("OK");
      // We might need to close the server instance if it was started during import, depending on test runner behavior.
    });
  });

  describe("Additional Edge Cases for Coverage", () => {
    // Test for database error handling covered in Error Handling section

    it("should use empty strings for author info when author is not found", async () => {
      // Setup specific mocks, author lookup returns null
      vi.mocked(dbIndexer.selectFrom)
        .mockImplementationOnce((table) => {
          /* proposals */ return {
            selectAll: vi.fn().mockReturnThis(),
            where: vi.fn().mockReturnThis(),
            execute: vi.fn().mockResolvedValue([mockProposal]),
          } as any;
        })
        .mockImplementationOnce((table) => {
          /* groups */ return {
            selectAll: vi.fn().mockReturnThis(),
            where: vi.fn().mockReturnThis(),
            execute: vi.fn().mockResolvedValue([mockProposalGroup]),
          } as any;
        })
        .mockImplementationOnce((table) => {
          // 3. Fetch author -> returns null
          expect(table).toBe("voter");
          return {
            selectAll: vi.fn().mockReturnThis(),
            where: vi.fn().mockReturnThis(),
            executeTakeFirst: vi.fn().mockResolvedValue(null),
          } as any;
        })
        .mockImplementationOnce((table) => {
          /* dao */ return {
            selectAll: vi.fn().mockReturnThis(),
            where: vi.fn().mockReturnThis(),
            executeTakeFirst: vi.fn().mockResolvedValue(mockDao),
          } as any;
        });
      vi.mocked(dbWeb.selectFrom)
        .mockImplementationOnce((table) => {
          /* users */ return {
            select: vi.fn().mockReturnThis(),
            where: vi.fn().mockReturnThis(),
            execute: vi.fn().mockResolvedValue([mockUser]),
          } as any;
        })
        .mockImplementationOnce((table) => {
          /* notification check */ return {
            selectAll: vi.fn().mockReturnThis(),
            where: vi.fn().mockReturnThis(),
            executeTakeFirst: vi.fn().mockResolvedValue(null),
          } as any;
        });

      // Mock the template to check props
      const mockTemplate = vi.mocked(NewProposalEmailTemplate);

      // Import and run the function
      const { checkNewProposals } = await import("../index");
      await checkNewProposals();

      // Verify email was sent
      expect(resend.emails.send).toHaveBeenCalledTimes(1);
      // Verify template received empty strings for author
      expect(mockTemplate).toHaveBeenCalledWith(
        expect.objectContaining({
          authorAddress: "",
          authorEns: "",
        }),
      );
      // Verify notification was inserted
      expect(dbWeb.insertInto).toHaveBeenCalledTimes(1);
    });

    it("should skip sending email to users without an email address", async () => {
      const userWithoutEmail = { id: "user2", email: null }; // User with null email
      // Setup mocks
      vi.mocked(dbIndexer.selectFrom)
        .mockImplementationOnce((table) => {
          /* proposals */ return {
            selectAll: vi.fn().mockReturnThis(),
            where: vi.fn().mockReturnThis(),
            execute: vi.fn().mockResolvedValue([mockProposal]),
          } as any;
        })
        .mockImplementationOnce((table) => {
          /* groups */ return {
            selectAll: vi.fn().mockReturnThis(),
            where: vi.fn().mockReturnThis(),
            execute: vi.fn().mockResolvedValue([mockProposalGroup]),
          } as any;
        })
        .mockImplementationOnce((table) => {
          /* author */ return {
            selectAll: vi.fn().mockReturnThis(),
            where: vi.fn().mockReturnThis(),
            executeTakeFirst: vi.fn().mockResolvedValue(mockAuthorVoter),
          } as any;
        })
        .mockImplementationOnce((table) => {
          /* dao */ return {
            selectAll: vi.fn().mockReturnThis(),
            where: vi.fn().mockReturnThis(),
            executeTakeFirst: vi.fn().mockResolvedValue(mockDao),
          } as any;
        });
      vi.mocked(dbWeb.selectFrom).mockImplementationOnce((table) => {
        // 5. Fetch users -> returns user without email
        expect(table).toBe("user");
        return {
          select: vi.fn().mockReturnThis(),
          where: vi.fn().mockReturnThis(),
          execute: vi.fn().mockResolvedValue([userWithoutEmail]),
        } as any;
      });
      // No notification check should happen for this user

      // Import and run the function
      const { checkNewProposals } = await import("../index");
      await checkNewProposals();

      // No email should be sent
      expect(resend.emails.send).not.toHaveBeenCalled();
      // No notification should be recorded
      expect(dbWeb.insertInto).not.toHaveBeenCalled();
      // Ensure the user query happened
      expect(vi.mocked(dbWeb.selectFrom)).toHaveBeenCalledTimes(1);
    });
  });
});
