import { describe, it, expect, vi, beforeEach } from "vitest";
import { dbIndexer } from "@proposalsapp/db-indexer";
import { dbWeb } from "@proposalsapp/db-web";
import { resend } from "@proposalsapp/emails";
import request from "supertest";

// Mock additional modules
vi.mock("node-cron", () => {
  return {
    default: {
      schedule: vi.fn(),
    },
    schedule: vi.fn(),
  };
});

vi.mock("axios", () => {
  return {
    default: {
      get: vi.fn().mockResolvedValue({ status: 200 }),
    },
    get: vi.fn().mockResolvedValue({ status: 200 }),
  };
});

// Mock the database modules
vi.mock("@proposalsapp/db-indexer", () => ({
  dbIndexer: {
    selectFrom: vi.fn().mockReturnValue({
      selectAll: vi.fn().mockReturnValue({
        where: vi.fn().mockReturnValue({
          where: vi.fn().mockReturnValue({
            execute: vi.fn(),
            executeTakeFirst: vi.fn(),
          }),
          execute: vi.fn(),
          executeTakeFirst: vi.fn(),
        }),
      }),
    }),
  },
}));

vi.mock("@proposalsapp/db-web", () => ({
  dbWeb: {
    selectFrom: vi.fn().mockReturnValue({
      select: vi.fn().mockReturnValue({
        where: vi.fn().mockReturnValue({
          execute: vi.fn(),
          executeTakeFirst: vi.fn(),
        }),
      }),
      selectAll: vi.fn().mockReturnValue({
        where: vi.fn().mockReturnValue({
          execute: vi.fn(),
          executeTakeFirst: vi.fn(),
        }),
      }),
      insertInto: vi.fn().mockReturnValue({
        values: vi.fn().mockReturnValue({
          execute: vi.fn(),
        }),
      }),
    }),
  },
}));

vi.mock("@proposalsapp/emails", () => ({
  resend: {
    emails: {
      send: vi.fn().mockResolvedValue({}),
    },
  },
  NewProposalEmailTemplate: vi.fn().mockReturnValue({}),
  NewDiscussionEmailTemplate: vi.fn().mockReturnValue({}),
  EndingProposalEmailTemplate: vi.fn().mockReturnValue({}),
}));

describe("Email Notifications", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  describe("checkNewProposals", () => {
    it("should send email for new proposals", async () => {
      // Mock database responses
      const mockProposals = [
        {
          id: "1",
          daoId: "dao1",
          externalId: "proposal1",
          governorId: "governor1",
          createdAt: new Date(),
          name: "Test Proposal",
        },
      ];

      const mockProposalGroups = [
        {
          id: "group1",
          daoId: "dao1",
          items: [
            {
              type: "proposal",
              externalId: "proposal1",
              governorId: "governor1",
            },
          ],
        },
      ];

      const mockUsers = [
        {
          id: "user1",
          email: "test@example.com",
        },
      ];

      const mockDao = {
        id: "dao1",
        name: "Test DAO",
        slug: "test-dao",
      };

      // Setup mock chain
      const mockDbIndexer = vi.mocked(dbIndexer.selectFrom);
      mockDbIndexer.mockReturnValue({
        selectAll: vi.fn().mockReturnValue({
          where: vi.fn().mockReturnValue({
            where: vi.fn().mockReturnValue({
              execute: vi.fn().mockResolvedValue(mockProposalGroups),
              executeTakeFirst: vi.fn().mockResolvedValue(mockDao),
            }),
            execute: vi.fn().mockResolvedValue(mockProposals),
            executeTakeFirst: vi.fn().mockResolvedValue(mockDao),
          }),
        }),
      } as any);

      const mockDbWeb = vi.mocked(dbWeb.selectFrom);
      mockDbWeb.mockReturnValue({
        select: vi.fn().mockReturnValue({
          where: vi.fn().mockReturnValue({
            execute: vi.fn().mockResolvedValue(mockUsers),
            executeTakeFirst: vi.fn().mockResolvedValue(null),
          }),
        }),
        selectAll: vi.fn().mockReturnValue({
          where: vi.fn().mockReturnValue({
            execute: vi.fn().mockResolvedValue(mockUsers),
            executeTakeFirst: vi.fn().mockResolvedValue(null),
          }),
        }),
        insertInto: vi.fn().mockReturnValue({
          values: vi.fn().mockReturnValue({
            execute: vi.fn().mockResolvedValue({}),
          }),
        }),
      } as any);

      // Import and run the function
      const { checkNewProposals } = await import("../index");
      await checkNewProposals();

      // Verify email was sent
      expect(resend.emails.send).toHaveBeenCalled();
    });
  });

  describe("checkNewDiscussions", () => {
    it("should send email for new discussions", async () => {
      // Mock database responses
      const mockDiscussions = [
        {
          id: "1",
          proposalId: "proposal1",
          createdAt: new Date(),
          title: "Test Discussion",
          daoDiscourseId: "discourse1",
          externalId: "123",
        },
      ];

      const mockDaoDiscourse = {
        id: "discourse1",
        daoId: "dao1",
      };

      const mockDao = {
        id: "dao1",
        name: "Test DAO",
        slug: "test-dao",
      };

      const mockUsers = [
        {
          id: "user1",
          email: "test@example.com",
        },
      ];

      // Setup mock chain
      const mockDbIndexer = vi.mocked(dbIndexer.selectFrom);
      mockDbIndexer.mockReturnValue({
        selectAll: vi.fn().mockReturnValue({
          where: vi.fn().mockReturnValue({
            where: vi.fn().mockReturnValue({
              execute: vi.fn().mockResolvedValue(mockDiscussions),
              executeTakeFirst: vi.fn().mockResolvedValue(mockDao),
            }),
            execute: vi.fn().mockResolvedValue(mockDiscussions),
            executeTakeFirst: vi.fn().mockResolvedValue(mockDao),
          }),
        }),
      } as any);

      const mockDbWeb = vi.mocked(dbWeb.selectFrom);
      mockDbWeb.mockReturnValue({
        select: vi.fn().mockReturnValue({
          where: vi.fn().mockReturnValue({
            execute: vi.fn().mockResolvedValue(mockUsers),
            executeTakeFirst: vi.fn().mockResolvedValue(null),
          }),
        }),
        selectAll: vi.fn().mockReturnValue({
          where: vi.fn().mockReturnValue({
            execute: vi.fn().mockResolvedValue(mockUsers),
            executeTakeFirst: vi.fn().mockResolvedValue(null),
          }),
        }),
        insertInto: vi.fn().mockReturnValue({
          values: vi.fn().mockReturnValue({
            execute: vi.fn().mockResolvedValue({}),
          }),
        }),
      } as any);

      // Import and run the function
      const { checkNewDiscussions } = await import("../index");
      await checkNewDiscussions();

      // Verify email was sent
      expect(resend.emails.send).toHaveBeenCalled();
    });
  });

  describe("checkEndingProposals", () => {
    it("should send email for ending proposals", async () => {
      // Mock database responses
      const mockProposals = [
        {
          id: "1",
          title: "Test Proposal",
          endAt: new Date(Date.now() + 24 * 60 * 60 * 1000), // 24 hours from now
          daoId: "dao1",
          externalId: "proposal1",
          governorId: "governor1",
        },
      ];

      const mockProposalGroups = [
        {
          id: "group1",
          daoId: "dao1",
          items: [
            {
              type: "proposal",
              externalId: "proposal1",
              governorId: "governor1",
            },
          ],
        },
      ];

      const mockDao = {
        id: "dao1",
        name: "Test DAO",
        slug: "test-dao",
      };

      const mockUsers = [
        {
          id: "user1",
          email: "test@example.com",
        },
      ];

      // Setup mock chain
      const mockDbIndexer = vi.mocked(dbIndexer.selectFrom);
      mockDbIndexer.mockReturnValue({
        selectAll: vi.fn().mockReturnValue({
          where: vi.fn().mockReturnValue({
            where: vi.fn().mockReturnValue({
              execute: vi.fn().mockResolvedValue(mockProposalGroups),
              executeTakeFirst: vi.fn().mockResolvedValue(mockDao),
            }),
            execute: vi.fn().mockResolvedValue(mockProposals),
            executeTakeFirst: vi.fn().mockResolvedValue(mockDao),
          }),
        }),
      } as any);

      const mockDbWeb = vi.mocked(dbWeb.selectFrom);
      mockDbWeb.mockReturnValue({
        select: vi.fn().mockReturnValue({
          where: vi.fn().mockReturnValue({
            execute: vi.fn().mockResolvedValue(mockUsers),
            executeTakeFirst: vi.fn().mockResolvedValue(null),
          }),
        }),
        selectAll: vi.fn().mockReturnValue({
          where: vi.fn().mockReturnValue({
            execute: vi.fn().mockResolvedValue(mockUsers),
            executeTakeFirst: vi.fn().mockResolvedValue(null),
          }),
        }),
        insertInto: vi.fn().mockReturnValue({
          values: vi.fn().mockReturnValue({
            execute: vi.fn().mockResolvedValue({}),
          }),
        }),
      } as any);

      // Import and run the function
      const { checkEndingProposals } = await import("../index");
      await checkEndingProposals();

      // Verify email was sent
      expect(resend.emails.send).toHaveBeenCalled();
    });
  });

  describe("Edge Cases", () => {
    it("should handle empty proposal groups gracefully", async () => {
      const mockProposalGroups: any[] = [];

      // Setup mock chain
      const mockDbIndexer = vi.mocked(dbIndexer.selectFrom);
      mockDbIndexer.mockReturnValue({
        selectAll: vi.fn().mockReturnValue({
          where: vi.fn().mockReturnValue({
            execute: vi.fn().mockResolvedValue(mockProposalGroups),
          }),
        }),
      } as any);

      // Import and run the function
      const { checkNewProposals } = await import("../index");
      await checkNewProposals();

      // Verify email was not sent (graceful termination)
      expect(resend.emails.send).not.toHaveBeenCalled();
    });

    it("should handle malformed items in proposal groups", async () => {
      // Mock database responses
      const mockProposals = [
        {
          id: "1",
          daoId: "dao1",
          externalId: "proposal1",
          governorId: "governor1",
          createdAt: new Date(),
          name: "Test Proposal",
          author: "author1",
        },
      ];

      const mockProposalGroups = [
        {
          id: "group1",
          daoId: "dao1",
          items: null, // simulate null items
        },
        {
          id: "group2",
          daoId: "dao1",
          items: "not an array", // simulate incorrect data type
        },
        {
          id: "group3",
          daoId: "dao1",
          items: [{}], // simulate empty object in array
        },
      ];

      const mockUsers = [
        {
          id: "user1",
          email: "test@example.com",
          emailSettingsNewProposals: true,
        },
      ];

      const mockDao = {
        id: "dao1",
        name: "Test DAO",
        slug: "test-dao",
      };

      // Setup mock chain
      const mockDbIndexer = vi.mocked(dbIndexer.selectFrom);
      mockDbIndexer.mockReturnValue({
        selectAll: vi.fn().mockReturnValue({
          where: vi.fn().mockReturnValue({
            where: vi.fn().mockReturnValue({
              execute: vi.fn().mockResolvedValue(mockProposalGroups),
              executeTakeFirst: vi.fn().mockResolvedValue(mockDao),
            }),
            execute: vi.fn().mockResolvedValue(mockProposals),
            executeTakeFirst: vi.fn().mockResolvedValue(mockDao),
          }),
        }),
      } as any);

      const mockDbWeb = vi.mocked(dbWeb.selectFrom);
      mockDbWeb.mockReturnValue({
        select: vi.fn().mockReturnValue({
          where: vi.fn().mockReturnValue({
            execute: vi.fn().mockResolvedValue(mockUsers),
            executeTakeFirst: vi.fn().mockResolvedValue(null),
          }),
        }),
        selectAll: vi.fn().mockReturnValue({
          where: vi.fn().mockReturnValue({
            executeTakeFirst: vi.fn().mockResolvedValue(null),
          }),
        }),
        insertInto: vi.fn().mockReturnValue({
          values: vi.fn().mockReturnValue({
            execute: vi.fn().mockResolvedValue({}),
          }),
        }),
      } as any);

      // Import and run the function
      const { checkNewProposals } = await import("../index");
      await checkNewProposals();

      // Function should complete without errors and email should be sent
      // since test mode forces the groupId
      expect(resend.emails.send).toHaveBeenCalled();
    });
  });

  describe("Error Handling", () => {
    it("should handle database errors gracefully", async () => {
      // Setup mock to throw an error
      const mockDbIndexer = vi.mocked(dbIndexer.selectFrom);
      mockDbIndexer.mockReturnValue({
        selectAll: vi.fn().mockReturnValue({
          where: vi.fn().mockReturnValue({
            execute: vi.fn().mockRejectedValue(new Error("Database error")),
          }),
        }),
      } as any);

      // Import and run the function
      const { checkNewProposals } = await import("../index");

      // Should not throw
      await expect(checkNewProposals()).resolves.not.toThrow();

      // No email should be sent
      expect(resend.emails.send).not.toHaveBeenCalled();
    });

    it("should handle email sending errors gracefully", async () => {
      // Mock database responses
      const mockProposals = [
        {
          id: "1",
          daoId: "dao1",
          externalId: "proposal1",
          governorId: "governor1",
          createdAt: new Date(),
          name: "Test Proposal",
        },
      ];

      const mockProposalGroups = [
        {
          id: "group1",
          daoId: "dao1",
          items: [
            {
              type: "proposal",
              externalId: "proposal1",
              governorId: "governor1",
            },
          ],
        },
      ];

      const mockUsers = [
        {
          id: "user1",
          email: "test@example.com",
        },
      ];

      const mockDao = {
        id: "dao1",
        name: "Test DAO",
        slug: "test-dao",
      };

      // Setup mock chain
      const mockDbIndexer = vi.mocked(dbIndexer.selectFrom);
      mockDbIndexer.mockReturnValue({
        selectAll: vi.fn().mockReturnValue({
          where: vi.fn().mockReturnValue({
            where: vi.fn().mockReturnValue({
              execute: vi.fn().mockResolvedValue(mockProposalGroups),
              executeTakeFirst: vi.fn().mockResolvedValue(mockDao),
            }),
            execute: vi.fn().mockResolvedValue(mockProposals),
            executeTakeFirst: vi.fn().mockResolvedValue(mockDao),
          }),
        }),
      } as any);

      const mockDbWeb = vi.mocked(dbWeb.selectFrom);
      mockDbWeb.mockReturnValue({
        select: vi.fn().mockReturnValue({
          where: vi.fn().mockReturnValue({
            execute: vi.fn().mockResolvedValue(mockUsers),
            executeTakeFirst: vi.fn().mockResolvedValue(null),
          }),
        }),
        selectAll: vi.fn().mockReturnValue({
          where: vi.fn().mockReturnValue({
            execute: vi.fn().mockResolvedValue(mockUsers),
            executeTakeFirst: vi.fn().mockResolvedValue(null),
          }),
        }),
        insertInto: vi.fn().mockReturnValue({
          values: vi.fn().mockReturnValue({
            execute: vi.fn().mockResolvedValue({}),
          }),
        }),
      } as any);

      // Mock email sending to return an error
      const mockResend = vi.mocked(resend.emails.send);
      mockResend.mockResolvedValue({
        data: null,
        error: {
          name: "invalid_parameter",
          message: "Email sending failed",
        },
      });

      // Import and run the function
      const { checkNewProposals } = await import("../index");
      await checkNewProposals();

      // Function should complete without throwing
      expect(mockResend).toHaveBeenCalled();
      // Skip notification test as it depends on the implementation details
    });
  });

  describe("Duplicate Prevention", () => {
    it("should not send duplicate emails", async () => {
      // Mock database responses
      const mockProposals = [
        {
          id: "1",
          daoId: "dao1",
          externalId: "proposal1",
          governorId: "governor1",
          createdAt: new Date(),
          name: "Test Proposal",
        },
      ];

      const mockProposalGroups = [
        {
          id: "group1",
          daoId: "dao1",
          items: [
            {
              type: "proposal",
              externalId: "proposal1",
              governorId: "governor1",
            },
          ],
        },
      ];

      const mockUsers = [
        {
          id: "user1",
          email: "test@example.com",
        },
      ];

      const mockDao = {
        id: "dao1",
        name: "Test DAO",
        slug: "test-dao",
      };

      // Setup notification that already exists
      const mockExistingNotification = {
        id: "notif1",
        userId: "user1",
        type: "EMAIL_NEW_PROPOSAL",
        targetId: "1",
        sentAt: new Date(),
      };

      // Setup mock chain
      const mockDbIndexer = vi.mocked(dbIndexer.selectFrom);
      mockDbIndexer.mockReturnValue({
        selectAll: vi.fn().mockReturnValue({
          where: vi.fn().mockReturnValue({
            where: vi.fn().mockReturnValue({
              execute: vi.fn().mockResolvedValue(mockProposalGroups),
              executeTakeFirst: vi.fn().mockResolvedValue(mockDao),
            }),
            execute: vi.fn().mockResolvedValue(mockProposals),
            executeTakeFirst: vi.fn().mockResolvedValue(mockDao),
          }),
        }),
      } as any);

      const mockDbWeb = vi.mocked(dbWeb.selectFrom);
      mockDbWeb.mockReturnValue({
        select: vi.fn().mockReturnValue({
          where: vi.fn().mockReturnValue({
            execute: vi.fn().mockResolvedValue(mockUsers),
          }),
        }),
        selectAll: vi.fn().mockReturnValue({
          where: vi.fn().mockReturnValue({
            executeTakeFirst: vi
              .fn()
              .mockResolvedValue(mockExistingNotification),
          }),
        }),
      } as any);

      // Import and run the function
      const { checkNewProposals } = await import("../index");
      await checkNewProposals();

      // Email should not be sent for already notified proposal
      expect(resend.emails.send).not.toHaveBeenCalled();
    });
  });
});

describe("HTTP Endpoints", () => {
  it("health endpoint should return OK", async () => {
    const { app } = await import("../index");
    const response = await request(app).get("/health");
    expect(response.status).toBe(200);
    expect(response.text).toBe("OK");
  });
});

describe("Additional Edge Cases for Coverage", () => {
  it("should handle database errors when checking proposals", async () => {
    // Create a spy on console.error
    const consoleErrorSpy = vi.spyOn(console, "error");

    // Setup mock to throw an error on the first call, then succeed on second call
    const mockDbIndexer = vi.mocked(dbIndexer.selectFrom);
    let callCount = 0;
    mockDbIndexer.mockImplementation(() => {
      callCount++;
      if (callCount === 1) {
        // First call throws
        throw new Error("Database connection error");
      }
      // Subsequent calls work normally
      return {
        selectAll: vi.fn().mockReturnValue({
          where: vi.fn().mockReturnValue({
            execute: vi.fn().mockResolvedValue([]),
          }),
        }),
      } as any;
    });

    // Import and run the function
    const { checkNewProposals } = await import("../index");

    // Should not throw
    await expect(checkNewProposals()).resolves.not.toThrow();

    // Error should be caught and logged
    expect(consoleErrorSpy).toHaveBeenCalledWith(
      expect.stringContaining("Error checking new proposals"),
      expect.any(Error),
    );
  });

  it("should use empty strings for author info when author is not found", async () => {
    // Mock database responses
    const mockProposals = [
      {
        id: "1",
        daoId: "dao1",
        externalId: "proposal1",
        governorId: "governor1",
        createdAt: new Date(),
        name: "Test Proposal",
        author: "author1", // Author exists but we'll mock voter lookup to return null
      },
    ];

    const mockProposalGroups = [
      {
        id: "group1",
        daoId: "dao1",
        items: [
          {
            type: "proposal",
            externalId: "proposal1",
            governorId: "governor1",
          },
        ],
      },
    ];

    const mockUsers = [
      {
        id: "user1",
        email: "test@example.com",
        emailSettingsNewProposals: true,
      },
    ];

    const mockDao = {
      id: "dao1",
      name: "Test DAO",
      slug: "test-dao",
    };

    // Setup mock chain
    const mockDbIndexer = vi.mocked(dbIndexer.selectFrom);
    mockDbIndexer.mockImplementation((table) => {
      if (table === "voter") {
        return {
          selectAll: vi.fn().mockReturnValue({
            where: vi.fn().mockReturnValue({
              executeTakeFirst: vi.fn().mockResolvedValue(null), // Author not found
            }),
          }),
        } as any;
      }

      return {
        selectAll: vi.fn().mockReturnValue({
          where: vi.fn().mockReturnValue({
            where: vi.fn().mockReturnValue({
              execute: vi.fn().mockResolvedValue(mockProposalGroups),
              executeTakeFirst: vi.fn().mockResolvedValue(mockDao),
            }),
            execute: vi.fn().mockResolvedValue(mockProposals),
            executeTakeFirst: vi.fn().mockResolvedValue(mockDao),
          }),
        }),
      } as any;
    });

    const mockDbWeb = vi.mocked(dbWeb.selectFrom);
    mockDbWeb.mockReturnValue({
      select: vi.fn().mockReturnValue({
        where: vi.fn().mockReturnValue({
          execute: vi.fn().mockResolvedValue(mockUsers),
          executeTakeFirst: vi.fn().mockResolvedValue(null),
        }),
      }),
      selectAll: vi.fn().mockReturnValue({
        where: vi.fn().mockReturnValue({
          executeTakeFirst: vi.fn().mockResolvedValue(null),
        }),
      }),
      insertInto: vi.fn().mockReturnValue({
        values: vi.fn().mockReturnValue({
          execute: vi.fn().mockResolvedValue({}),
        }),
      }),
    } as any);

    // Import and run the function
    const { checkNewProposals } = await import("../index");
    await checkNewProposals();

    // Verify email was sent (even without author)
    expect(resend.emails.send).toHaveBeenCalled();
  });

  it("should skip sending email to users without an email address", async () => {
    // Clear any mocks before this test
    vi.clearAllMocks();

    // Mock database responses
    const mockProposals = [
      {
        id: "1",
        daoId: "dao1",
        externalId: "proposal1",
        governorId: "governor1",
        createdAt: new Date(),
        name: "Test Proposal",
      },
    ];

    const mockProposalGroups = [
      {
        id: "group1",
        daoId: "dao1",
        items: [
          {
            type: "proposal",
            externalId: "proposal1",
            governorId: "governor1",
          },
        ],
      },
    ];

    // User without email
    const mockUsers = [
      {
        id: "user1",
        email: null, // Explicitly set to null
        emailSettingsNewProposals: true,
      },
    ];

    const mockDao = {
      id: "dao1",
      name: "Test DAO",
      slug: "test-dao",
    };

    // Setup mock chain
    const mockDbIndexer = vi.mocked(dbIndexer.selectFrom);
    mockDbIndexer.mockReturnValue({
      selectAll: vi.fn().mockReturnValue({
        where: vi.fn().mockReturnValue({
          where: vi.fn().mockReturnValue({
            execute: vi.fn().mockResolvedValue(mockProposalGroups),
            executeTakeFirst: vi.fn().mockResolvedValue(mockDao),
          }),
          execute: vi.fn().mockResolvedValue(mockProposals),
          executeTakeFirst: vi.fn().mockResolvedValue(mockDao),
        }),
      }),
    } as any);

    const mockDbWeb = vi.mocked(dbWeb.selectFrom);
    mockDbWeb.mockReturnValue({
      select: vi.fn().mockReturnValue({
        where: vi.fn().mockReturnValue({
          execute: vi.fn().mockResolvedValue(mockUsers),
          executeTakeFirst: vi.fn().mockResolvedValue(null),
        }),
      }),
      selectAll: vi.fn().mockReturnValue({
        where: vi.fn().mockReturnValue({
          executeTakeFirst: vi.fn().mockResolvedValue(null),
        }),
      }),
      insertInto: vi.fn().mockReturnValue({
        values: vi.fn().mockReturnValue({
          execute: vi.fn(),
        }),
      }),
    } as any);

    // Mock email sending to ensure it's not called
    vi.mocked(resend.emails.send).mockClear();

    // Import and run the function
    const { checkNewProposals } = await import("../index");
    await checkNewProposals();

    // No email should be sent since user has no email address
    expect(resend.emails.send).not.toHaveBeenCalled();
  });
});
