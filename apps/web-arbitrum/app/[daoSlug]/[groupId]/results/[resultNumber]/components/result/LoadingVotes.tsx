"use client";

import { useEffect, useState } from "react";

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
  const [currentMessage, setCurrentMessage] = useState(messages[0]);

  useEffect(() => {
    let currentIndex = 0;

    const intervalId = setInterval(() => {
      currentIndex = (currentIndex + 1) % messages.length;
      setCurrentMessage(messages[currentIndex]);
    }, 3000); // Change message every 3 seconds

    return () => clearInterval(intervalId); // Cleanup interval on component unmount
  }, []);

  return (
    <div className="flex h-full w-full items-center justify-center">
      <div className="flex flex-col items-center gap-4">
        <div className="h-12 w-12 animate-spin rounded-full border-4 border-gray-300 border-t-primary" />
        <p className="text-lg font-medium text-gray-600">{currentMessage}</p>
      </div>
    </div>
  );
}
