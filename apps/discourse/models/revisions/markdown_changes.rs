use fancy_regex::Regex;

/// Extracts the "before" content from a markdown diff table by capturing:
/// 1. Regular td content (without diff classes)
/// 2. Content within diff-del cells (deleted content)
///
/// The function strips HTML tags and normalizes the text content.
///
/// # Arguments
/// * `content` - The HTML string containing the markdown diff table
///
/// # Returns
/// * `Result<String, fancy_regex::Error>` - The extracted and normalized content or a regex error
pub fn extract_before_content_markdown(content: &str) -> Result<String, fancy_regex::Error> {
    let mut result = Vec::new();

    // Get all regular td content first
    let plain_re = Regex::new(r#"(?s)<tr><td(?:(?! class="diff))[^>]*>(.*?)</td>"#)?;
    for caps in plain_re.captures_iter(content) {
        if let Ok(cap) = caps {
            if let Some(matched) = cap.get(1) {
                result.push(strip_html_tags(matched.as_str()));
            }
        }
    }

    // Then get all diff-del content
    let diff_re = Regex::new(r#"(?s)<td class="diff-del">(.*?)</td>"#)?;
    for caps in diff_re.captures_iter(content) {
        if let Ok(cap) = caps {
            if let Some(matched) = cap.get(1) {
                result.push(strip_html_tags(matched.as_str()));
            }
        }
    }

    Ok(result.join(" "))
}

/// Extracts the "after" content from a markdown diff table by capturing:
/// 1. Regular td content from the second column
/// 2. Content within diff-ins cells (inserted content)
///
/// The function strips HTML tags and normalizes the text content.
///
/// # Arguments
/// * `content` - The HTML string containing the markdown diff table
///
/// # Returns
/// * `Result<String, fancy_regex::Error>` - The extracted and normalized content or a regex error
pub fn extract_after_content_markdown(content: &str) -> Result<String, fancy_regex::Error> {
    let mut result = Vec::new();

    // Get all regular td content first (from second column)
    let plain_re =
        Regex::new(r#"(?s)<tr><td[^>]*>.*?</td><td(?:(?! class="diff))[^>]*>(.*?)</td>"#)?;
    for caps in plain_re.captures_iter(content) {
        if let Ok(cap) = caps {
            if let Some(matched) = cap.get(1) {
                result.push(strip_html_tags(matched.as_str()));
            }
        }
    }

    // Then get all diff-ins content
    let diff_re = Regex::new(r#"(?s)<td class="diff-ins">(.*?)</td>"#)?;
    for caps in diff_re.captures_iter(content) {
        if let Ok(cap) = caps {
            if let Some(matched) = cap.get(1) {
                result.push(strip_html_tags(matched.as_str()));
            }
        }
    }

    Ok(result.join(" "))
}

fn strip_html_tags(content: &str) -> String {
    let re = Regex::new(r#"<[^>]+>"#).unwrap();
    let without_tags = re.replace_all(content, "").to_string();

    // Process lines while preserving whitespace structure
    let lines: Vec<&str> = without_tags.lines().collect();
    let mut processed: Vec<String> = Vec::new();
    let mut previous_empty = false;

    if lines.is_empty() {
        return String::new();
    }

    // Detect the base indentation level from non-empty lines
    let base_indent = lines
        .iter()
        .filter(|line| !line.trim().is_empty())
        .map(|line| line.chars().take_while(|c| c.is_whitespace()).count())
        .min()
        .unwrap_or(0);

    for line in lines {
        let trimmed = line.trim();
        if trimmed.is_empty() {
            // Only add one empty line between sections
            if !previous_empty && !processed.is_empty() {
                processed.push(String::new());
                previous_empty = true;
            }
        } else {
            // Calculate relative indentation
            let current_indent = line.chars().take_while(|c| c.is_whitespace()).count();
            let relative_indent = if current_indent > base_indent {
                current_indent - base_indent
            } else {
                0
            };

            // Preserve the relative indentation structure
            let indented = if processed.is_empty() {
                trimmed.to_string() // First line without indentation
            } else {
                format!("{:width$}{}", "", trimmed, width = relative_indent)
            };
            processed.push(indented);
            previous_empty = false;
        }
    }

    // Join all lines with newlines, ensuring no trailing newline at the end
    processed.join("\n").trim_end().to_string()
}

#[cfg(test)]
mod markdown_changes {
    use super::*;

    /// Tests extraction of simple inline changes with deletion and addition
    ///
    /// Verifies:
    /// - Correct extraction of deleted content in the "before" version
    /// - Correct extraction of added content in the "after" version
    #[test]
    fn test_markdown_extraction_1() {
        let content = "<table class=\"markdown\"><tr><td class=\"diff-del\">This is <del>a simple </del>paragraph.</td><td class=\"diff-ins\">This is <ins>an inline addition what to this </ins>paragraph.</td></tr></table>";

        let before = extract_before_content_markdown(&content).unwrap();
        let after = extract_after_content_markdown(&content).unwrap();

        // Verify the before content includes the deleted text
        assert_eq!(before, "This is a simple paragraph.");
        // Verify the after content includes the added text
        assert_eq!(after, "This is an inline addition what to this paragraph.");
    }

    /// Tests extraction of content with inline word removal
    ///
    /// Verifies:
    /// - Correct handling of single word deletion
    /// - Proper text normalization in both versions
    #[test]
    fn test_markdown_extraction_2() {
        let content = "<table class=\"markdown\"><tr><td class=\"diff-del\">This is an inline addition <del>what </del>to this paragraph.</td><td class=\"diff-ins\">This is an inline addition to this paragraph.</td></tr></table>";

        let before = extract_before_content_markdown(&content).unwrap();
        let after = extract_after_content_markdown(&content).unwrap();

        // Verify the before content includes the word to be removed
        assert_eq!(before, "This is an inline addition what to this paragraph.");
        // Verify the after content has the word removed
        assert_eq!(after, "This is an inline addition to this paragraph.");
    }

    /// Tests extraction of multi-line content with no differences
    ///
    /// Verifies:
    /// - Proper handling of HTML entities
    /// - Correct preservation of URLs
    /// - Proper line break handling
    /// - Identical content extraction when no differences exist
    #[test]
    fn test_markdown_extraction_3() {
        let content = r#"<table class="markdown"><tr><td>Let me add some more information regarding the similarity between both the platforms.

            Let&#39;s understand the chronology.
            1) This was exposed from one of the tweet yesterday

            https://twitter.com/0xCryptoSapiens/status/1580974560421105664

            2) Then after ZZFinance team said they are not the same.
            3) Then after MMF Admin put a post to dish ZZF (to look like its very natural that both are different entity)
            4) ZZF team puts MMF as fudders.
            </td><td>Let me add some more information regarding the similarity between both the platforms.

            Let&#39;s understand the chronology.
            1) This was exposed from one of the tweet yesterday

            https://twitter.com/0xCryptoSapiens/status/1580974560421105664

            2) Then after ZZFinance team said they are not the same.
            3) Then after MMF Admin put a post to dish ZZF (to look like its very natural that both are different entity)
            4) ZZF team puts MMF as fudders.
            </td></tr></table>"#;

        let before = extract_before_content_markdown(&content).unwrap();
        let after = extract_after_content_markdown(&content).unwrap();

        // Verify both versions are identical and properly formatted
        assert_eq!(
            before,
            r#"Let me add some more information regarding the similarity between both the platforms.

            Let&#39;s understand the chronology.
            1) This was exposed from one of the tweet yesterday

            https://twitter.com/0xCryptoSapiens/status/1580974560421105664

            2) Then after ZZFinance team said they are not the same.
            3) Then after MMF Admin put a post to dish ZZF (to look like its very natural that both are different entity)
            4) ZZF team puts MMF as fudders."#
        );
        assert_eq!(before, after);
    }
    #[test]
    fn test_markdown_extraction_3_2() {
        let content = r#"<table class="markdown"><tr><td>MadCell Labs is designing a Programmable Treasury Protocol for Nouns NFT holders. An ambitious novel system to promote a sustainable fair value distribution mechanism through its native token. The following is their Roadmap in developing a sustainable economic system:

        1. Programmable Treasury and Pseudonymous Identity
        2. Decentralized Exchange with Fair Value Distribution Mechanism
        3. User Story Content Application with Future Mining Mechanism

        This topic will be updated as the project progresses.</td><td>MadCell Labs is designing a Programmable Treasury Protocol for Nouns NFT holders. An ambitious novel system to promote a sustainable fair value distribution mechanism through its native token. The following is their Roadmap in developing a sustainable economic system:

        1. Programmable Treasury and Pseudonymous Identity
        2. Decentralized Exchange with Fair Value Distribution Mechanism
        3. User Story Content Application with Future Mining Mechanism

        This topic will be updated as the project progresses.</td></tr></table>"#;

        let before = extract_before_content_markdown(&content).unwrap();
        let after = extract_after_content_markdown(&content).unwrap();

        // Verify both versions are identical and properly formatted
        assert_eq!(
            before,
            "MadCell Labs is designing a Programmable Treasury Protocol for Nouns NFT holders. An ambitious novel system to promote a sustainable fair value distribution mechanism through its native token. The following is their Roadmap in developing a sustainable economic system:

        1. Programmable Treasury and Pseudonymous Identity
        2. Decentralized Exchange with Fair Value Distribution Mechanism
        3. User Story Content Application with Future Mining Mechanism

        This topic will be updated as the project progresses."
        );
        assert_eq!(before, after);
    }

    /// Tests extraction of content with both unchanged and changed sections
    ///
    /// Verifies:
    /// - Proper handling of mixed content (unchanged + changes)
    /// - Correct extraction of additions at the end of the content
    /// - Proper preservation of emoticons/special characters
    #[test]
    fn test_markdown_extraction_4() {
        let content = r#"<table class="markdown"><tr><td>Let me add some more information regarding the similarity between both the platforms.

        Let&#39;s understand the chronology.
        1) This was exposed from one of the tweet yesterday

        https://twitter.com/0xCryptoSapiens/status/1580974560421105664

        2) Then after ZZFinance team said they are not the same.
        3) Then after MMF Admin put a post to dish ZZF (to look like its very natural that both are different entity)
        4) ZZF team puts MMF as fudders.
        </td><td>Let me add some more information regarding the similarity between both the platforms.

        Let&#39;s understand the chronology.
        1) This was exposed from one of the tweet yesterday

        https://twitter.com/0xCryptoSapiens/status/1580974560421105664

        2) Then after ZZFinance team said they are not the same.
        3) Then after MMF Admin put a post to dish ZZF (to look like its very natural that both are different entity)
        4) ZZF team puts MMF as fudders.
        </td></tr><tr><td class="diff-del">5) Surprise everyone ZZF tokens will be airdropped to MMF holders :smiley:</td><td class="diff-ins">5) Surprise everyone ZZF tokens will be airdropped to MMF holders :smiley:<ins>

        6) Compare frontend designs. Frontend is having options which are not in the roadmap (StableSwap, Limit Order) Just like it was not in MMF Roadmap.</ins></td></tr></table>"#;

        let before = extract_before_content_markdown(&content).unwrap();
        let after = extract_after_content_markdown(&content).unwrap();

        // Verify the before content includes only up to point 5
        assert_eq!(
            before,
            r#"Let me add some more information regarding the similarity between both the platforms.

            Let&#39;s understand the chronology.
            1) This was exposed from one of the tweet yesterday

            https://twitter.com/0xCryptoSapiens/status/1580974560421105664

            2) Then after ZZFinance team said they are not the same.
            3) Then after MMF Admin put a post to dish ZZF (to look like its very natural that both are different entity)
            4) ZZF team puts MMF as fudders. 5) Surprise everyone ZZF tokens will be airdropped to MMF holders :smiley:"#
        );

        // Verify the after content includes the additional point 6
        assert_eq!(
            after,
            r#"Let me add some more information regarding the similarity between both the platforms.

            Let&#39;s understand the chronology.
            1) This was exposed from one of the tweet yesterday
            https://twitter.com/0xCryptoSapiens/status/1580974560421105664
            2) Then after ZZFinance team said they are not the same.
            3) Then after MMF Admin put a post to dish ZZF (to look like its very natural that both are different entity)
            4) ZZF team puts MMF as fudders.
            5) Surprise everyone ZZF tokens will be airdropped to MMF holders :smiley:
            6) Compare frontend designs. Frontend is having options which are not in the roadmap (StableSwap, Limit Order) Just like it was not in MMF Roadmap."#
        );
    }
}
