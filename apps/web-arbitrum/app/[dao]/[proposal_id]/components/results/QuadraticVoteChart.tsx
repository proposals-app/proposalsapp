"use client";

import {
  Line,
  LineChart,
  CartesianGrid,
  Legend,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from "recharts";
import { Card, CardContent } from "@/shadcn/ui/card";
import { useMemo } from "react";
import { Proposal, Selectable, Vote } from "@proposalsapp/db";

interface ResultProps {
  proposal: Selectable<Proposal> & {
    votes: Selectable<Vote>[];
  };
}

export function QuadraticVoteChart({ proposal }: ResultProps) {
  return (
    <Card className="bg-white">
      <CardContent className="flex h-64 items-center justify-center text-gray-500">
        Not implemented
      </CardContent>
    </Card>
  );
}
