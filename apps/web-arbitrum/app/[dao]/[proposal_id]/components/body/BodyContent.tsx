"use client";

import { ArrowDown, ArrowUp } from "lucide-react";
import React, { useState, useEffect } from "react";
import DOMPurify from "isomorphic-dompurify";
import ReactMarkdown from "react-markdown";
import remarkGfm from "remark-gfm";
import rehypeRaw from "rehype-raw";
import type { Components } from "react-markdown";
import { parseAsStringEnum, useQueryState } from "nuqs";
import { ViewType } from "@/app/searchParams";

interface ContentSectionClientProps {
  content: string;
  contentType?: "html" | "markdown";
}

const detectContentType = (content: string): "html" | "markdown" => {
  if (!content?.trim()) {
    return "markdown";
  }
  const firstLine = content.trim().split("\n")[0];
  const hasHtmlTags = /<[^>]+>/g.test(firstLine);
  return hasHtmlTags ? "html" : "markdown";
};

const sharedMarkdownStyles: Components = {
  h1: ({ children }: { children: React.ReactNode }) => (
    <h1 className="mb-4 mt-6 text-2xl font-bold">{children}</h1>
  ),
  h2: ({ children }: { children: React.ReactNode }) => (
    <h2 className="mb-3 mt-5 text-xl font-bold">{children}</h2>
  ),
  h3: ({ children }: { children: React.ReactNode }) => (
    <h3 className="mb-2 mt-4 text-lg font-bold">{children}</h3>
  ),
  p: ({ children }: { children: React.ReactNode }) => (
    <p className="mb-4 leading-relaxed">{children}</p>
  ),
  ul: ({ children }: { children: React.ReactNode }) => (
    <ul className="mb-4 list-disc space-y-2 pl-6">{children}</ul>
  ),
  ol: ({ children }: { children: React.ReactNode }) => (
    <ol className="mb-4 list-decimal space-y-2 pl-6">{children}</ol>
  ),
  li: ({ children }: { children: React.ReactNode }) => (
    <li className="leading-relaxed">{children}</li>
  ),
  strong: ({ children }: { children: React.ReactNode }) => (
    <strong className="font-bold">{children}</strong>
  ),
  a: ({ href, children }: { href?: string; children: React.ReactNode }) => (
    <a
      href={href}
      className="underline"
      target="_blank"
      rel="noopener noreferrer"
    >
      {children}
    </a>
  ),
  blockquote: ({ children }: { children: React.ReactNode }) => (
    <blockquote className="border-l-4 border-gray-300 pl-4 italic">
      {children}
    </blockquote>
  ),
  table: ({ children }: { children: React.ReactNode }) => (
    <div className="my-4 overflow-x-auto">
      <table className="min-w-full border-collapse border border-gray-300">
        {children}
      </table>
    </div>
  ),
  th: ({ children }: { children: React.ReactNode }) => (
    <th className="border border-gray-300 bg-gray-100 p-2 text-left">
      {children}
    </th>
  ),
  td: ({ children }: { children: React.ReactNode }) => (
    <td className="border border-gray-300 p-2">{children}</td>
  ),
  img: ({ src, alt }: { src?: string; alt?: string }) => (
    <img
      src={src}
      alt={alt}
      className="my-4 h-auto max-w-full rounded-lg"
      loading="lazy"
    />
  ),
};

const BodyContent = ({ content, contentType }: ContentSectionClientProps) => {
  const [viewType, setViewType] = useQueryState(
    "view",
    parseAsStringEnum<ViewType>(Object.values(ViewType))
      .withDefault(ViewType.TIMELINE)
      .withOptions({ shallow: false }),
  );

  const [viewportHeight, setViewportHeight] = useState<number>(0);

  const actualContentType = contentType ?? detectContentType(content);

  useEffect(() => {
    const updateViewportHeight = () => {
      setViewportHeight(window.innerHeight);
    };

    updateViewportHeight();
    window.addEventListener("resize", updateViewportHeight);
    return () => window.removeEventListener("resize", updateViewportHeight);
  }, []);

  const collapsedHeight = viewportHeight * 0.25;

  const sanitizedContent =
    actualContentType === "html"
      ? DOMPurify.sanitize(content, {
          ALLOWED_TAGS: [
            "h1",
            "h2",
            "h3",
            "h4",
            "h5",
            "h6",
            "p",
            "ul",
            "li",
            "ol",
            "strong",
            "em",
            "a",
            "table",
            "thead",
            "tbody",
            "tr",
            "th",
            "td",
            "div",
            "img",
            "br",
            "code",
            "pre",
            "blockquote",
            "hr",
          ],
          ALLOWED_ATTR: [
            "href",
            "src",
            "class",
            "style",
            "alt",
            "title",
            "target",
            "rel",
            "id",
            "name",
          ],
        })
      : content;

  const toggleView = () => {
    if (viewType === ViewType.BODY) {
      setViewType(ViewType.TIMELINE);
    } else {
      setViewType(ViewType.BODY);
    }
  };

  return (
    <div className="relative min-h-screen pb-16">
      <div
        className={`relative transition-all duration-500 ease-in-out ${
          viewType === ViewType.BODY ? "" : "overflow-hidden"
        }`}
        style={{
          maxHeight:
            viewType === ViewType.BODY ? "none" : `${collapsedHeight}px`,
        }}
      >
        <div className="prose prose-lg max-w-none">
          {actualContentType === "markdown" ? (
            <ReactMarkdown
              remarkPlugins={[remarkGfm]}
              rehypePlugins={[rehypeRaw]}
              components={sharedMarkdownStyles}
            >
              {content}
            </ReactMarkdown>
          ) : (
            <div
              dangerouslySetInnerHTML={{ __html: sanitizedContent }}
              className="prose prose-lg max-w-none"
            />
          )}
        </div>

        {viewType === ViewType.TIMELINE && (
          <div
            className="absolute bottom-0 left-0 right-0 h-24 bg-gradient-to-t from-gray-100 to-transparent"
            aria-hidden="true"
          />
        )}
      </div>

      {viewType === ViewType.TIMELINE ? (
        <button
          onClick={toggleView}
          className="mt-4 flex w-full cursor-pointer items-center justify-start gap-2 rounded-full border bg-white p-2 text-sm font-bold transition-colors hover:bg-gray-50"
          aria-label="Expand proposal content"
        >
          <ArrowDown className="rounded-full border p-1" />
          Read Full Proposal
        </button>
      ) : (
        <button
          onClick={toggleView}
          className="fixed bottom-0 left-4 right-4 z-50 mx-auto flex w-full max-w-[600px] animate-slide-up cursor-pointer items-center justify-between gap-2 rounded-t-xl border bg-white p-2 text-sm font-bold shadow-lg transition-colors hover:bg-gray-50"
          aria-label="Collapse proposal content"
        >
          <ArrowUp className="rounded-full border p-1" />
          <div className="flex flex-row items-center gap-2">
            Comments and Votes
            <ArrowDown className="rounded-full border p-1" />
          </div>
        </button>
      )}
    </div>
  );
};

export default BodyContent;
