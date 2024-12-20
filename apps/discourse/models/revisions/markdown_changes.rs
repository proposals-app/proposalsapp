use fancy_regex::Regex;

pub fn extract_before_content_markdown(content: &str) -> Result<String, fancy_regex::Error> {
    let mut result = Vec::new();
    let mut td_pairs = Vec::new();

    // First, collect all tr elements with their content
    let tr_re = Regex::new(r#"(?s)<tr>(.*?)</tr>"#)?;
    for tr_caps in tr_re.captures_iter(content) {
        if let Ok(tr_cap) = tr_caps {
            if let Some(tr_matched) = tr_cap.get(1) {
                let tr_content = tr_matched.as_str();

                // Check for diff-del/diff-ins cells
                if tr_content.contains("class=\"diff-del\"") {
                    let diff_re = Regex::new(r#"(?s)<td class="diff-del">(.*?)</td>"#)?;
                    if let Ok(Some(cap)) = diff_re.captures(tr_content) {
                        if let Some(matched) = cap.get(1) {
                            let content =
                                matched.as_str().replace("<del>", "").replace("</del>", "");
                            td_pairs.push(content);
                        }
                    }
                } else {
                    // Handle regular td content (first column)
                    let plain_re = Regex::new(r#"(?s)<td(?:(?! class="diff))[^>]*>(.*?)</td>"#)?;
                    if let Ok(Some(cap)) = plain_re.captures(tr_content) {
                        if let Some(matched) = cap.get(1) {
                            td_pairs.push(matched.as_str().to_string());
                        }
                    }
                }
            }
        }
    }

    result.extend(td_pairs);
    let combined = result.join("");
    Ok(strip_html_tags(&combined))
}

pub fn extract_after_content_markdown(content: &str) -> Result<String, fancy_regex::Error> {
    let mut result = Vec::new();
    let mut td_pairs = Vec::new();

    // First, collect all tr elements with their content
    let tr_re = Regex::new(r#"(?s)<tr>(.*?)</tr>"#)?;
    for tr_caps in tr_re.captures_iter(content) {
        if let Ok(tr_cap) = tr_caps {
            if let Some(tr_matched) = tr_cap.get(1) {
                let tr_content = tr_matched.as_str();

                // Check for diff-ins cells
                if tr_content.contains("class=\"diff-ins\"") {
                    let diff_re = Regex::new(r#"(?s)<td class="diff-ins">(.*?)</td>"#)?;
                    if let Ok(Some(cap)) = diff_re.captures(tr_content) {
                        if let Some(matched) = cap.get(1) {
                            let content =
                                matched.as_str().replace("<ins>", "").replace("</ins>", "");
                            td_pairs.push(content);
                        }
                    }
                } else {
                    // Handle regular td content (second column)
                    let plain_re = Regex::new(
                        r#"(?s)<td[^>]*>.*?</td><td(?:(?! class="diff))[^>]*>(.*?)</td>"#,
                    )?;
                    if let Ok(Some(cap)) = plain_re.captures(tr_content) {
                        if let Some(matched) = cap.get(1) {
                            td_pairs.push(matched.as_str().to_string());
                        }
                    }
                }
            }
        }
    }

    result.extend(td_pairs);
    let combined = result.join("");
    Ok(strip_html_tags(&combined))
}

fn strip_html_tags(content: &str) -> String {
    let re = Regex::new(r#"<[^>]+>"#).unwrap();
    let stripped = re.replace_all(content, "").to_string();
    // Normalize newlines and spaces
    stripped
        .replace("\\n", "\n")
        .split('\n')
        .map(|line| line.trim())
        .filter(|line| !line.is_empty())
        .collect::<Vec<_>>()
        .join("\n")
}

#[cfg(test)]
mod markdown_changes {
    use super::*;

    #[test]
    fn test_markdown_extraction_1() {
        // Test case 1: Basic extraction of before and after content with deletions and insertions.
        let content = r#"<table class="markdown"><tr><td class="diff-del">This is <del>a simple </del>paragraph.</td><td class="diff-ins">This is <ins>an inline addition what to this </ins>paragraph.</td></tr></table>"#;

        // Extracting "before" content, which should not include the deleted part.
        let before = extract_before_content_markdown(&content).unwrap();
        assert_eq!(before, "This is a simple paragraph.");

        // Extracting "after" content, which should include the inserted part.
        let after = extract_after_content_markdown(&content).unwrap();
        assert_eq!(after, "This is an inline addition what to this paragraph.");
    }

    #[test]
    fn test_markdown_extraction_2() {
        // Test case 2: Extraction with deletion in the middle of a sentence.
        let content = r#"<table class="markdown"><tr><td class="diff-del">This is an inline addition <del>what </del>to this paragraph.</td><td class="diff-ins">This is an inline addition to this paragraph.</td></tr></table>"#;

        // Extracting "before" content, which should include the deleted part.
        let before = extract_before_content_markdown(&content).unwrap();
        assert_eq!(before, "This is an inline addition what to this paragraph.");

        // Extracting "after" content, which should not include the deleted part.
        let after = extract_after_content_markdown(&content).unwrap();
        assert_eq!(after, "This is an inline addition to this paragraph.");
    }

    #[test]
    fn test_markdown_extraction_3() {
        // Test case 3: Extraction with a more complex example including special HTML entities and additional insertion.
        let content = r#"<table class="markdown"><tr><td class="diff-del">I would love to take on the project as a whole. I just don&#39;t have the ability to put up any sort of funds to get it started. Maybe it would be better if the DAO purchased at bulk, then the purchaser could just send whatever amount and details through a simple terminal be placed in a queue generate a slip, pack and pick up from FedEx.</td><td class="diff-ins">I would love to take on the project as a whole. I just don&#39;t have the ability to put up any sort of funds to get it started. Maybe it would be better if the DAO purchased at bulk, then the purchaser could just send whatever amount and details through a simple terminal be placed in a queue generate a slip, pack and pick up from FedEx.<ins> I do have a taxable business account in the State of California.</ins></td></tr></table>"#;

        // Extracting "before" content, which should not include the inserted part.
        let before = extract_before_content_markdown(&content).unwrap();
        assert_eq!(
            before,
            r#"I would love to take on the project as a whole. I just don&#39;t have the ability to put up any sort of funds to get it started. Maybe it would be better if the DAO purchased at bulk, then the purchaser could just send whatever amount and details through a simple terminal be placed in a queue generate a slip, pack and pick up from FedEx."#
        );

        // Extracting "after" content, which should include the inserted part.
        let after = extract_after_content_markdown(&content).unwrap();
        assert_eq!(
            after,
            r#"I would love to take on the project as a whole. I just don&#39;t have the ability to put up any sort of funds to get it started. Maybe it would be better if the DAO purchased at bulk, then the purchaser could just send whatever amount and details through a simple terminal be placed in a queue generate a slip, pack and pick up from FedEx. I do have a taxable business account in the State of California."#
        );
    }

    #[test]
    fn test_markdown_extraction_4() {
        // Test case 4: Extraction where both before and after content are identical.
        let content = r#"<table class="markdown"><tr><td># [[Non-constitutional] Proposal to fund Plurality Labs Milestone 1B(ridge)]((https://snapshot.org/#/arbitrumfoundation.eth/proposal/0x24344ab10eb905a4d7fa5885c6f681290e765a08a5f558ff6cfc5fedab42afb6))\n---\n</td><td># [[Non-constitutional] Proposal to fund Plurality Labs Milestone 1B(ridge)]((https://snapshot.org/#/arbitrumfoundation.eth/proposal/0x24344ab10eb905a4d7fa5885c6f681290e765a08a5f558ff6cfc5fedab42afb6))\n---\n</td></tr></table>"#;

        // Extracting "before" content, which should be the same as the original content.
        let before = extract_before_content_markdown(&content).unwrap();
        assert_eq!(
            before,
            r#"# [[Non-constitutional] Proposal to fund Plurality Labs Milestone 1B(ridge)]((https://snapshot.org/#/arbitrumfoundation.eth/proposal/0x24344ab10eb905a4d7fa5885c6f681290e765a08a5f558ff6cfc5fedab42afb6))
---"#
        );

        // Extracting "after" content, which should be the same as the original content.
        let after = extract_after_content_markdown(&content).unwrap();
        assert_eq!(
            after,
            r#"# [[Non-constitutional] Proposal to fund Plurality Labs Milestone 1B(ridge)]((https://snapshot.org/#/arbitrumfoundation.eth/proposal/0x24344ab10eb905a4d7fa5885c6f681290e765a08a5f558ff6cfc5fedab42afb6))
---"#
        );
    }

    #[test]
    fn test_markdown_extraction_5() {
        // Test case 5: Extraction with a mix of identical content and deletions/insertions.
        let content = r#"<table class="markdown"><tr><td># [[Non-constitutional] Proposal to fund Plurality Labs Milestone 1B(ridge)]((https://snapshot.org/#/arbitrumfoundation.eth/proposal/0x24344ab10eb905a4d7fa5885c6f681290e765a08a5f558ff6cfc5fedab42afb6))\n---\n</td><td># [[Non-constitutional] Proposal to fund Plurality Labs Milestone 1B(ridge)]((https://snapshot.org/#/arbitrumfoundation.eth/proposal/0x24344ab10eb905a4d7fa5885c6f681290e765a08a5f558ff6cfc5fedab42afb6))\n---\n</td></tr><tr><td class="diff-del">Out team **<del>Cp0x</del>** voted FOR this proposal.\n</td><td class="diff-ins">Out team **<ins>cp0x</ins>** voted FOR this proposal.\n</td></tr><tr><td>We support the efficient distribution of grants, which are represented by Plurality Labs.\nWe support the improvement of their team of experts.</td><td>We support the efficient distribution of grants, which are represented by Plurality Labs.\nWe support the improvement of their team of experts.</td></tr></table>"#;

        // Extracting "before" content, which should include the deleted part.
        let before = extract_before_content_markdown(&content).unwrap();
        assert_eq!(
            before,
            r#"# [[Non-constitutional] Proposal to fund Plurality Labs Milestone 1B(ridge)]((https://snapshot.org/#/arbitrumfoundation.eth/proposal/0x24344ab10eb905a4d7fa5885c6f681290e765a08a5f558ff6cfc5fedab42afb6))
---
Out team **Cp0x** voted FOR this proposal.
We support the efficient distribution of grants, which are represented by Plurality Labs.
We support the improvement of their team of experts."#
        );

        // Extracting "after" content, which should include the inserted part.
        let after = extract_after_content_markdown(&content).unwrap();
        assert_eq!(
            after,
            r#"# [[Non-constitutional] Proposal to fund Plurality Labs Milestone 1B(ridge)]((https://snapshot.org/#/arbitrumfoundation.eth/proposal/0x24344ab10eb905a4d7fa5885c6f681290e765a08a5f558ff6cfc5fedab42afb6))
---
Out team **cp0x** voted FOR this proposal.
We support the efficient distribution of grants, which are represented by Plurality Labs.
We support the improvement of their team of experts."#
        );
    }
}
