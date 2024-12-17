"use client";

import { ArrowDown, ArrowUp } from "lucide-react";
import React, { useState, useRef, useEffect } from "react";
import DOMPurify from "isomorphic-dompurify";
import ReactMarkdown from "react-markdown";
import remarkGfm from "remark-gfm";
import rehypeRaw from "rehype-raw";
import type { Components } from "react-markdown";

interface ContentSectionClientProps {
  content: string;
  contentType?: "html" | "markdown";
}

const ContentSectionClient = ({
  content,
  contentType,
}: ContentSectionClientProps) => {
  const [isExpanded, setIsExpanded] = useState(false);
  const contentRef = useRef<HTMLDivElement>(null);
  const [viewportHeight, setViewportHeight] = useState<number>(0);

  const detectContentType = (content: string): "html" | "markdown" => {
    if (!content?.trim()) {
      return "markdown";
    }
    const firstLine = content.trim().split("\n")[0];
    const hasHtmlTags = /<[^>]+>/g.test(firstLine);
    return hasHtmlTags ? "html" : "markdown";
  };

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

  return (
    <div className="relative min-h-screen pb-16">
      <div
        ref={contentRef}
        className={`relative transition-all duration-500 ease-in-out ${
          !isExpanded ? "overflow-hidden" : ""
        }`}
        style={{
          maxHeight: isExpanded ? "none" : `${collapsedHeight}px`,
        }}
      >
        <div className="prose prose-lg max-w-none">
          {actualContentType === "markdown" ? (
            <ReactMarkdown
              remarkPlugins={[remarkGfm]}
              rehypePlugins={[rehypeRaw]}
              components={{
                h1: ({ children }) => (
                  <h1 className="mb-4 mt-6 text-2xl font-bold">{children}</h1>
                ),
                h2: ({ children }) => (
                  <h2 className="mb-3 mt-5 text-xl font-bold">{children}</h2>
                ),
                h3: ({ children }) => (
                  <h3 className="mb-2 mt-4 text-lg font-bold">{children}</h3>
                ),
                p: ({ children }) => (
                  <p className="mb-4 leading-relaxed">{children}</p>
                ),
                ul: ({ children }) => (
                  <ul className="mb-4 list-disc space-y-2 pl-6">{children}</ul>
                ),
                ol: ({ children }) => (
                  <ol className="mb-4 list-decimal space-y-2 pl-6">
                    {children}
                  </ol>
                ),
                li: ({ children }) => (
                  <li className="leading-relaxed">{children}</li>
                ),
                strong: ({ children }) => (
                  <strong className="font-bold">{children}</strong>
                ),
                a: ({ href, children }) => (
                  <a
                    href={href}
                    className="text-blue-600 underline hover:text-blue-800"
                    target="_blank"
                    rel="noopener noreferrer"
                  >
                    {children}
                  </a>
                ),
                blockquote: ({ children }) => (
                  <blockquote className="border-l-4 border-gray-300 pl-4 italic">
                    {children}
                  </blockquote>
                ),
                table: ({ children }) => (
                  <div className="my-4 overflow-x-auto">
                    <table className="min-w-full border-collapse border border-gray-300">
                      {children}
                    </table>
                  </div>
                ),
                th: ({ children }) => (
                  <th className="border border-gray-300 bg-gray-100 p-2 text-left">
                    {children}
                  </th>
                ),
                td: ({ children }) => (
                  <td className="border border-gray-300 p-2">{children}</td>
                ),
                img: ({ src, alt }) => (
                  <img
                    src={src}
                    alt={alt}
                    className="my-4 h-auto max-w-full rounded-lg"
                    loading="lazy"
                  />
                ),
              }}
            >
              {content}
            </ReactMarkdown>
          ) : (
            <div dangerouslySetInnerHTML={{ __html: sanitizedContent }} />
          )}
        </div>

        {!isExpanded && (
          <div
            className="absolute bottom-0 left-0 right-0 h-24 bg-gradient-to-t from-gray-100 to-transparent"
            aria-hidden="true"
          />
        )}
      </div>

      {!isExpanded ? (
        <button
          onClick={() => setIsExpanded(true)}
          className="mt-4 flex w-full cursor-pointer items-center justify-start gap-2 rounded-full border bg-white p-2 text-sm font-bold transition-colors hover:bg-gray-50"
          aria-label="Expand proposal content"
        >
          <ArrowDown className="rounded-full border p-1" />
          Read Full Proposal
        </button>
      ) : (
        <button
          onClick={() => setIsExpanded(false)}
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

export default ContentSectionClient;
