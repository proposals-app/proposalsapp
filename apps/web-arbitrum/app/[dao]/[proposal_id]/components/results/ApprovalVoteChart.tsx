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
import { Card, CardContent, CardTitle } from "@/shadcn/ui/card";
import { useMemo } from "react";
import { Proposal, Selectable, Vote } from "@proposalsapp/db";
import { isArray } from "util";

interface ResultProps {
  proposal: Selectable<Proposal> & {
    votes: Selectable<Vote>[];
  };
}

export function ApprovalVoteChart({ proposal }: ResultProps) {
  return (
    <Card className="bg-white">
      <CardContent className="flex h-64 items-center justify-center text-gray-500">
        Not implemented
      </CardContent>
    </Card>
  );
}
