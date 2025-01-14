"use client";

import React, { useEffect, useState } from "react";

const messages = [
  "Counting votes...",
  "Consulting the DAO oracle...",
  "Deciphering blockchain hieroglyphs...",
  "Summoning consensus spirits...",
  "Brewing governance tea...",
  "Polishing the voting crystals...",
  "Aligning the decentralized stars...",
  "Calibrating the trust machine...",
  "Decrypting the will of the people...",
  "Finalizing the immutable truth...",
];

export function LoadingVotes() {
  const [currentMessageIndex, setCurrentMessageIndex] = useState(0);

  useEffect(() => {
    const interval = setInterval(() => {
      setCurrentMessageIndex((prev) => (prev + 1) % messages.length);
    }, 3000); // Change message every 3 seconds

    return () => clearInterval(interval);
  }, []);

  return (
    <div className="flex h-full w-full items-center justify-center">
      <div className="flex flex-col items-center gap-4">
        <div className="h-12 w-12 animate-spin rounded-full border-4 border-gray-300 border-t-primary" />
        <p className="text-lg font-medium text-gray-600">
          {messages[currentMessageIndex]}
        </p>
      </div>
    </div>
  );
}
