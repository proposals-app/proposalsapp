use anyhow::Result;
use scraper::{Html, Selector};
use thiserror::Error;

#[derive(Debug, Clone, PartialEq)]
pub enum DiffType {
    Deletion,
    Insertion,
    Unchanged,
}

#[derive(Debug, Clone)]
pub struct DiffNode {
    pub content: String,
    pub diff_type: DiffType,
    pub children: Vec<DiffNode>,
}

#[derive(Debug, Error)]
pub enum MarkdownDiffError {
    #[error("Failed to select elements: {0}")]
    SelectorError(String),
}

impl DiffNode {
    pub fn new(content: String, diff_type: DiffType) -> Self {
        Self {
            content,
            diff_type,
            children: Vec::new(),
        }
    }

    pub fn add_child(&mut self, child: DiffNode) {
        self.children.push(child);
    }

    pub fn get_before_content(&self) -> String {
        match self.diff_type {
            DiffType::Deletion | DiffType::Unchanged => {
                let mut content = self.content.clone();
                for child in &self.children {
                    content.push_str(&child.get_before_content());
                }
                content
            }
            DiffType::Insertion => String::new(),
        }
    }

    pub fn get_after_content(&self) -> String {
        match self.diff_type {
            DiffType::Insertion | DiffType::Unchanged => {
                let mut content = self.content.clone();
                for child in &self.children {
                    content.push_str(&child.get_after_content());
                }
                content
            }
            DiffType::Deletion => String::new(),
        }
    }
}

pub fn parse_markdown_diff(content: &str) -> Result<DiffNode> {
    let html = Html::parse_fragment(content);
    let table_selector = Selector::parse("table.markdown").map_err(|e| {
        MarkdownDiffError::SelectorError(format!("Failed to create table selector: {}", e))
    })?;
    let tr_selector = Selector::parse("tr").map_err(|e| {
        MarkdownDiffError::SelectorError(format!("Failed to create tr selector: {}", e))
    })?;
    let td_selector = Selector::parse("td").map_err(|e| {
        MarkdownDiffError::SelectorError(format!("Failed to create td selector: {}", e))
    })?;

    let mut root = DiffNode::new(String::new(), DiffType::Unchanged);

    if let Some(table) = html.select(&table_selector).next() {
        let mut is_first_row = true;

        for tr in table.select(&tr_selector) {
            let tds: Vec<_> = tr.select(&td_selector).collect();

            if tds.len() == 2 {
                let (left_td, right_td) = (&tds[0], &tds[1]);
                let left_content = extract_text_content(left_td);
                let right_content = extract_text_content(right_td);

                // Check if cells have diff classes
                let is_left_diff = left_td.value().classes().any(|c| c == "diff-del");
                let is_right_diff = right_td.value().classes().any(|c| c == "diff-ins");

                // If neither cell has a diff class, add content as unchanged
                if !is_left_diff && !is_right_diff {
                    let mut left_content_with_newline = left_content;
                    if !is_first_row {
                        left_content_with_newline.insert(0, '\n');
                    }
                    root.add_child(DiffNode::new(
                        left_content_with_newline,
                        DiffType::Unchanged,
                    ));
                } else {
                    // Handle diff cells
                    if is_left_diff {
                        let mut left_content_with_newline = left_content;
                        if !is_first_row {
                            left_content_with_newline.insert(0, '\n');
                        }
                        root.add_child(DiffNode::new(
                            left_content_with_newline,
                            DiffType::Deletion,
                        ));
                    }
                    if is_right_diff {
                        let mut right_content_with_newline = right_content;
                        if !is_first_row {
                            right_content_with_newline.insert(0, '\n');
                        }
                        root.add_child(DiffNode::new(
                            right_content_with_newline,
                            DiffType::Insertion,
                        ));
                    }
                }
            }

            // Mark that we have processed at least one row
            is_first_row = false;
        }
    }

    Ok(root)
}

fn extract_text_content(element: &scraper::ElementRef) -> String {
    let text = element
        .text()
        .collect::<Vec<_>>()
        .join("")
        .replace("<del>", "")
        .replace("</del>", "")
        .replace("<ins>", "")
        .replace("</ins>", "");

    // Normalize newlines and ensure proper spacing
    text.lines().collect::<Vec<_>>().join("\n")
}

pub fn extract_before_content_markdown(content: &str) -> Result<String> {
    let ast = parse_markdown_diff(content)?;
    Ok(ast.get_before_content())
}

pub fn extract_after_content_markdown(content: &str) -> Result<String> {
    let ast = parse_markdown_diff(content)?;
    Ok(ast.get_after_content())
}

#[cfg(test)]
mod markdown_changes_tests {
    use super::*;

    #[test]
    fn test_markdown_extraction_1() {
        // Test case 1: Basic extraction of before and after content with deletions and insertions.
        let content = r#"<table class="markdown"><tr><td class="diff-del">This is <del>a simple </del>paragraph.</td><td class="diff-ins">This is <ins>an inline addition what to this </ins>paragraph.</td></tr></table>"#;

        // Extracting "before" content, which should not include the deleted part.
        let before = extract_before_content_markdown(content).unwrap();
        assert_eq!(before, "This is a simple paragraph.");

        // Extracting "after" content, which should include the inserted part.
        let after = extract_after_content_markdown(content).unwrap();
        assert_eq!(after, "This is an inline addition what to this paragraph.");
    }

    #[test]
    fn test_markdown_extraction_2() {
        // Test case 2: Extraction with deletion in the middle of a sentence.
        let content = r#"<table class="markdown"><tr><td class="diff-del">This is an inline addition <del>what </del>to this paragraph.</td><td class="diff-ins">This is an inline addition to this paragraph.</td></tr></table>"#;

        // Extracting "before" content, which should include the deleted part.
        let before = extract_before_content_markdown(content).unwrap();
        assert_eq!(before, "This is an inline addition what to this paragraph.");

        // Extracting "after" content, which should not include the deleted part.
        let after = extract_after_content_markdown(content).unwrap();
        assert_eq!(after, "This is an inline addition to this paragraph.");
    }

    #[test]
    fn test_markdown_extraction_3() {
        // Test case 3: Extraction with a more complex example including special HTML entities and additional insertion.
        let content = r#"<table class="markdown"><tr><td class="diff-del">I would love to take on the project as a whole. I just don&#39;t have the ability to put up any sort of funds to get it started. Maybe it would be better if the DAO purchased at bulk, then the purchaser could just send whatever amount and details through a simple terminal be placed in a queue generate a slip, pack and pick up from FedEx.</td><td class="diff-ins">I would love to take on the project as a whole. I just don&#39;t have the ability to put up any sort of funds to get it started. Maybe it would be better if the DAO purchased at bulk, then the purchaser could just send whatever amount and details through a simple terminal be placed in a queue generate a slip, pack and pick up from FedEx.<ins> I do have a taxable business account in the State of California.</ins></td></tr></table>"#;

        // Extracting "before" content, which should not include the inserted part.
        let before = extract_before_content_markdown(content).unwrap();
        assert_eq!(
            before,
            r#"I would love to take on the project as a whole. I just don't have the ability to put up any sort of funds to get it started. Maybe it would be better if the DAO purchased at bulk, then the purchaser could just send whatever amount and details through a simple terminal be placed in a queue generate a slip, pack and pick up from FedEx."#
        );

        // Extracting "after" content, which should include the inserted part.
        let after = extract_after_content_markdown(content).unwrap();
        assert_eq!(
            after,
            r#"I would love to take on the project as a whole. I just don't have the ability to put up any sort of funds to get it started. Maybe it would be better if the DAO purchased at bulk, then the purchaser could just send whatever amount and details through a simple terminal be placed in a queue generate a slip, pack and pick up from FedEx. I do have a taxable business account in the State of California."#
        );
    }

    #[test]
    fn test_markdown_extraction_4() {
        // Test case 4: Extraction where both before and after content are identical.
        let content = r#"<table class="markdown"><tr><td># [[Non-constitutional] Proposal to fund Plurality Labs Milestone 1B(ridge)]((https://snapshot.org/#/arbitrumfoundation.eth/proposal/0x24344ab10eb905a4d7fa5885c6f681290e765a08a5f558ff6cfc5fedab42afb6))
---
</td><td># [[Non-constitutional] Proposal to fund Plurality Labs Milestone 1B(ridge)]((https://snapshot.org/#/arbitrumfoundation.eth/proposal/0x24344ab10eb905a4d7fa5885c6f681290e765a08a5f558ff6cfc5fedab42afb6))
---
</td></tr></table>"#;

        // Extracting "before" content, which should be the same as the original content.
        let before = extract_before_content_markdown(content).unwrap();
        assert_eq!(
            before,
            r#"# [[Non-constitutional] Proposal to fund Plurality Labs Milestone 1B(ridge)]((https://snapshot.org/#/arbitrumfoundation.eth/proposal/0x24344ab10eb905a4d7fa5885c6f681290e765a08a5f558ff6cfc5fedab42afb6))
---"#
        );

        // Extracting "after" content, which should be the same as the original content.
        let after = extract_after_content_markdown(content).unwrap();
        assert_eq!(
            after,
            r#"# [[Non-constitutional] Proposal to fund Plurality Labs Milestone 1B(ridge)]((https://snapshot.org/#/arbitrumfoundation.eth/proposal/0x24344ab10eb905a4d7fa5885c6f681290e765a08a5f558ff6cfc5fedab42afb6))
---"#
        );
    }

    #[test]
    fn test_markdown_extraction_5() {
        // Test case 5: Extraction with a mix of identical content and deletions/insertions.
        let content = r#"<table class="markdown"><tr><td># [[Non-constitutional] Proposal to fund Plurality Labs Milestone 1B(ridge)]((https://snapshot.org/#/arbitrumfoundation.eth/proposal/0x24344ab10eb905a4d7fa5885c6f681290e765a08a5f558ff6cfc5fedab42afb6))
---
</td><td># [[Non-constitutional] Proposal to fund Plurality Labs Milestone 1B(ridge)]((https://snapshot.org/#/arbitrumfoundation.eth/proposal/0x24344ab10eb905a4d7fa5885c6f681290e765a08a5f558ff6cfc5fedab42afb6))
---
</td></tr><tr><td class="diff-del">Out team **<del>Cp0x</del>** voted FOR this proposal.
</td><td class="diff-ins">Out team **<ins>cp0x</ins>** voted FOR this proposal.
</td></tr><tr><td>We support the efficient distribution of grants, which are represented by Plurality Labs.
We support the improvement of their team of experts.</td><td>We support the efficient distribution of grants, which are represented by Plurality Labs.
We support the improvement of their team of experts.</td></tr></table>"#;

        // Extracting "before" content, which should include the deleted part.
        let before = extract_before_content_markdown(content).unwrap();
        assert_eq!(
            before,
            r#"# [[Non-constitutional] Proposal to fund Plurality Labs Milestone 1B(ridge)]((https://snapshot.org/#/arbitrumfoundation.eth/proposal/0x24344ab10eb905a4d7fa5885c6f681290e765a08a5f558ff6cfc5fedab42afb6))
---
Out team **Cp0x** voted FOR this proposal.
We support the efficient distribution of grants, which are represented by Plurality Labs.
We support the improvement of their team of experts."#
        );

        // Extracting "after" content, which should include the inserted part.
        let after = extract_after_content_markdown(content).unwrap();
        assert_eq!(
            after,
            r#"# [[Non-constitutional] Proposal to fund Plurality Labs Milestone 1B(ridge)]((https://snapshot.org/#/arbitrumfoundation.eth/proposal/0x24344ab10eb905a4d7fa5885c6f681290e765a08a5f558ff6cfc5fedab42afb6))
---
Out team **cp0x** voted FOR this proposal.
We support the efficient distribution of grants, which are represented by Plurality Labs.
We support the improvement of their team of experts."#
        );
    }

    #[test]
    fn test_markdown_extraction_6() {
        // Test case 6: Extraction with deletion and insertion in a more complex scenario.
        let content = r#"<table class="markdown"><tr><td>thanks for the detailed response. This clarity will def helps us navigate future rounds better.
I think most grants acting in good faith have a legit story behind what appears as a sybil attack but at the same time i get that its really not feasible for Gitcoin to look into each to understand the context.
The current doc on whats considered a sybil attack by Gitcoin is quite broad which is where potential confusion can arise, esp for newer grants. Maybe a forum post where this can be hashed out betn the team and grants once the dust settles on this round would be nice to prevent this next time.
</td><td>thanks for the detailed response. This clarity will def helps us navigate future rounds better.
I think most grants acting in good faith have a legit story behind what appears as a sybil attack but at the same time i get that its really not feasible for Gitcoin to look into each to understand the context.
The current doc on whats considered a sybil attack by Gitcoin is quite broad which is where potential confusion can arise, esp for newer grants. Maybe a forum post where this can be hashed out betn the team and grants once the dust settles on this round would be nice to prevent this next time.
</td></tr><tr><td class="diff-del">Have DMed on twitter/<del>TG</del></td><td class="diff-ins">Have DMed <ins>you </ins>on twitter/<ins>TG @connor with some potential false positives that we would like to get clarity on before the next round.
Congrats to everyone that made this happen. Looking forward to the next roller coaster</ins></td></tr></table>"#;

        // Extracting "before" content, which should include the deleted part.
        let before = extract_before_content_markdown(content).unwrap();
        assert_eq!(
            before,
            r#"thanks for the detailed response. This clarity will def helps us navigate future rounds better.
I think most grants acting in good faith have a legit story behind what appears as a sybil attack but at the same time i get that its really not feasible for Gitcoin to look into each to understand the context.
The current doc on whats considered a sybil attack by Gitcoin is quite broad which is where potential confusion can arise, esp for newer grants. Maybe a forum post where this can be hashed out betn the team and grants once the dust settles on this round would be nice to prevent this next time.
Have DMed on twitter/TG"#
        );

        // Extracting "after" content, which should include the inserted part.
        let after = extract_after_content_markdown(content).unwrap();
        assert_eq!(
            after,
            r#"thanks for the detailed response. This clarity will def helps us navigate future rounds better.
I think most grants acting in good faith have a legit story behind what appears as a sybil attack but at the same time i get that its really not feasible for Gitcoin to look into each to understand the context.
The current doc on whats considered a sybil attack by Gitcoin is quite broad which is where potential confusion can arise, esp for newer grants. Maybe a forum post where this can be hashed out betn the team and grants once the dust settles on this round would be nice to prevent this next time.
Have DMed you on twitter/TG @connor with some potential false positives that we would like to get clarity on before the next round.
Congrats to everyone that made this happen. Looking forward to the next roller coaster"#
        );
    }
}
