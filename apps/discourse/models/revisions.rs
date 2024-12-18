use chrono::{DateTime, Utc};
use serde::{Deserialize, Serialize};

#[derive(Debug, Deserialize, Serialize)]
pub struct Revision {
    pub created_at: DateTime<Utc>,
    pub post_id: i32,
    pub previous_hidden: bool,
    pub current_hidden: bool,
    pub first_revision: i32,
    pub previous_revision: Option<i32>,
    pub current_revision: i32,
    pub next_revision: Option<i32>,
    pub last_revision: i32,
    pub current_version: i32,
    pub version_count: i32,
    pub username: String,
    pub display_username: String,
    pub avatar_template: String,
    pub edit_reason: Option<String>,
    pub body_changes: BodyChanges,
    pub title_changes: Option<TitleChanges>,
    pub can_edit: bool,
}

#[derive(Debug, Deserialize, Serialize)]
pub struct BodyChanges {
    pub inline: String,
    pub side_by_side: String,
    pub side_by_side_markdown: String,
}

#[derive(Debug, Deserialize, Serialize)]
pub struct TitleChanges {
    pub inline: String,
}

impl TitleChanges {
    pub fn get_cooked_before(&self) -> String {
        Revision::extract_before_content(&self.inline)
    }

    pub fn get_cooked_after(&self) -> String {
        Revision::extract_after_content(&self.inline)
    }
}

impl Revision {
    pub fn get_cooked_before(&self) -> String {
        let content = self.body_changes.inline.clone();
        Self::extract_before_content(&content)
    }

    pub fn get_cooked_after(&self) -> String {
        let content = self.body_changes.inline.clone();
        Self::extract_after_content(&content)
    }

    fn extract_before_content(content: &str) -> String {
        let mut result = content.to_string();

        // Remove wrapper div if present
        if result.starts_with(r#"<div class="inline-diff">"#) {
            if let Some(last_div_pos) = result.rfind("</div>") {
                result = result[25..last_div_pos].to_string();
            }
        }

        // First remove all ins tags and their content
        while let Some(start) = result.find("<ins>") {
            if let Some(end) = result[start..].find("</ins>") {
                let end = start + end + 6;
                result.replace_range(start..end, "");
            } else {
                break;
            }
        }

        // Handle diff-ins class elements
        while let Some(start) = find_tag_with_class(&result, "diff-ins") {
            if let Some(end_tag) = find_closing_tag(&result[start..]) {
                let end = start + end_tag;
                result.replace_range(start..end, "");
            }
        }

        // Clean up deletion markers but keep content
        let mut final_result = String::with_capacity(result.len());
        let mut current_pos = 0;

        while let Some(start) = result[current_pos..].find("<del>") {
            let absolute_start = current_pos + start;
            if let Some(end) = result[absolute_start..].find("</del>") {
                let absolute_end = absolute_start + end;
                // Add content before the del tag
                final_result.push_str(&result[current_pos..absolute_start]);
                // Add content inside the del tag
                final_result.push_str(&result[absolute_start + 5..absolute_end]);
                current_pos = absolute_end + 6;
            } else {
                break;
            }
        }
        final_result.push_str(&result[current_pos..]);
        result = final_result;

        // Remove diff-del class but keep content
        let mut current_pos = 0;
        let mut final_result = String::new();

        while let Some(start) = find_tag_with_class(&result[current_pos..], "diff-del") {
            let absolute_start = current_pos + start;
            if let Some(end_tag) = find_closing_tag(&result[absolute_start..]) {
                let absolute_end = absolute_start + end_tag;

                // Extract tag name and content
                if let Some(tag_name) = extract_tag_name(&result[absolute_start..absolute_end]) {
                    let content_start = result[absolute_start..absolute_end]
                        .find('>')
                        .map(|pos| absolute_start + pos + 1);
                    let content_end = absolute_end - tag_name.len() - 3; // "</tag>"

                    if let Some(content_start) = content_start {
                        // Add content before the tag
                        final_result.push_str(&result[current_pos..absolute_start]);
                        // Add the tag without the class
                        final_result.push_str(&format!("<{}>", tag_name));
                        // Add the content
                        final_result.push_str(&result[content_start..content_end]);
                        // Add the closing tag
                        final_result.push_str(&format!("</{}>", tag_name));

                        current_pos = absolute_end;
                        continue;
                    }
                }
            }
            // If we couldn't process the tag properly, just add everything up to this point
            final_result.push_str(&result[current_pos..absolute_start + 1]);
            current_pos = absolute_start + 1;
        }
        final_result.push_str(&result[current_pos..]);

        // Clean up whitespace and normalize newlines
        final_result.replace("\r\n", "\n").trim().to_string()
    }

    fn extract_after_content(content: &str) -> String {
        let mut result = content.to_string();

        // Remove wrapper div if present
        if result.starts_with(r#"<div class="inline-diff">"#) {
            if let Some(last_div_pos) = result.rfind("</div>") {
                result = result[25..last_div_pos].to_string();
            }
        }

        // First remove all del tags and their content
        while let Some(start) = result.find("<del>") {
            if let Some(end) = result[start..].find("</del>") {
                let end = start + end + 6;
                result.replace_range(start..end, "");
            } else {
                break;
            }
        }

        // Handle diff-del class elements
        while let Some(start) = find_tag_with_class(&result, "diff-del") {
            if let Some(end_tag) = find_closing_tag(&result[start..]) {
                let end = start + end_tag;
                result.replace_range(start..end, "");
            }
        }

        // Clean up insertion markers but keep content
        let mut final_result = String::with_capacity(result.len());
        let mut current_pos = 0;

        while let Some(start) = result[current_pos..].find("<ins>") {
            let absolute_start = current_pos + start;
            if let Some(end) = result[absolute_start..].find("</ins>") {
                let absolute_end = absolute_start + end;
                // Add content before the ins tag
                final_result.push_str(&result[current_pos..absolute_start]);
                // Add content inside the ins tag
                final_result.push_str(&result[absolute_start + 5..absolute_end]);
                current_pos = absolute_end + 6;
            } else {
                break;
            }
        }
        final_result.push_str(&result[current_pos..]);
        result = final_result;

        // Remove diff-ins class but keep content
        let mut current_pos = 0;
        let mut final_result = String::new();

        while let Some(start) = find_tag_with_class(&result[current_pos..], "diff-ins") {
            let absolute_start = current_pos + start;
            if let Some(end_tag) = find_closing_tag(&result[absolute_start..]) {
                let absolute_end = absolute_start + end_tag;

                // Extract tag name and content
                if let Some(tag_name) = extract_tag_name(&result[absolute_start..absolute_end]) {
                    let content_start = result[absolute_start..absolute_end]
                        .find('>')
                        .map(|pos| absolute_start + pos + 1);
                    let content_end = absolute_end - tag_name.len() - 3; // "</tag>"

                    if let Some(content_start) = content_start {
                        // Add content before the tag
                        final_result.push_str(&result[current_pos..absolute_start]);
                        // Add the tag without the class
                        final_result.push_str(&format!("<{}>", tag_name));
                        // Add the content
                        final_result.push_str(&result[content_start..content_end]);
                        // Add the closing tag
                        final_result.push_str(&format!("</{}>", tag_name));

                        current_pos = absolute_end;
                        continue;
                    }
                }
            }
            // If we couldn't process the tag properly, just add everything up to this point
            final_result.push_str(&result[current_pos..absolute_start + 1]);
            current_pos = absolute_start + 1;
        }
        final_result.push_str(&result[current_pos..]);

        // Clean up whitespace and normalize newlines
        final_result.replace("\r\n", "\n").trim().to_string()
    }
}

fn find_closing_tag(content: &str) -> Option<usize> {
    let mut depth = 0;
    let mut pos = 0;
    let bytes = content.as_bytes();

    while pos < bytes.len() {
        match bytes[pos] {
            b'<' => {
                if pos + 1 < bytes.len() {
                    match bytes[pos + 1] {
                        b'/' => {
                            depth -= 1;
                            if depth == 0 {
                                // Find the end of this closing tag
                                while pos < bytes.len() && bytes[pos] != b'>' {
                                    pos += 1;
                                }
                                return Some(pos + 1);
                            }
                        }
                        _ => depth += 1,
                    }
                }
            }
            b'>' => {
                if pos > 0 && bytes[pos - 1] == b'/' {
                    depth -= 1;
                    if depth == 0 {
                        return Some(pos + 1);
                    }
                }
            }
            _ => {}
        }
        pos += 1;
    }
    None
}

fn extract_tag_name(tag: &str) -> Option<String> {
    let start = tag.find('<')? + 1;
    let remaining = &tag[start..];
    let end = remaining.find(|c: char| c.is_whitespace() || c == '>')?;
    Some(remaining[..end].to_string())
}

fn find_tag_with_class(content: &str, class_name: &str) -> Option<usize> {
    let class_attr = format!("class=\"{}\"", class_name);
    content.find(&class_attr).and_then(|class_pos| {
        // Search backwards for the opening '<'
        for i in (0..class_pos).rev() {
            if content.as_bytes()[i] == b'<' {
                return Some(i);
            }
        }
        None
    })
}

#[cfg(test)]
mod tests {
    use super::*;

    fn create_basic_revision(inline_content: &str) -> Revision {
        Revision {
            created_at: chrono::Utc::now(),
            post_id: 1,
            previous_hidden: false,
            current_hidden: false,
            first_revision: 1,
            previous_revision: Some(0),
            current_revision: 1,
            next_revision: None,
            last_revision: 1,
            current_version: 1,
            version_count: 2,
            username: "user".to_string(),
            display_username: "User Display".to_string(),
            avatar_template: "/avatar.png".to_string(),
            edit_reason: None,
            body_changes: BodyChanges {
                inline: inline_content.to_string(),
                side_by_side: String::new(),
                side_by_side_markdown: String::new(),
            },
            title_changes: None,
            can_edit: true,
        }
    }

    #[test]
    fn test_simple_ins_del() {
        let revision = create_basic_revision(
            r#"<div class="inline-diff"><del>old text</del><ins>new text</ins></div>"#,
        );
        assert_eq!(revision.get_cooked_before(), "old text");
        assert_eq!(revision.get_cooked_after(), "new text");
    }

    #[test]
    fn test_nested_tags() {
        let revision = create_basic_revision(
            r#"<div class="inline-diff"><p><del>old <strong>formatted</strong> text</del></p><p><ins>new <em>styled</em> text</ins></p></div>"#,
        );
        assert_eq!(
            revision.get_cooked_before(),
            "<p>old <strong>formatted</strong> text</p><p></p>"
        );
        assert_eq!(
            revision.get_cooked_after(),
            "<p></p><p>new <em>styled</em> text</p>"
        );
    }

    #[test]
    fn test_diff_classes() {
        let revision = create_basic_revision(
            r#"<div class="inline-diff"><p class="diff-del">removed paragraph</p><p class="diff-ins">added paragraph</p></div>"#,
        );

        let before = revision.get_cooked_before();
        let after = revision.get_cooked_after();

        assert_eq!(before.trim(), "<p>removed paragraph</p>");
        assert_eq!(after.trim(), "<p>added paragraph</p>");
    }

    #[test]
    fn test_mixed_changes() {
        let revision = create_basic_revision(
            r#"<div class="inline-diff"><p>unchanged <del>removed</del><ins>added</ins> text</p><p class="diff-del">old para</p><p class="diff-ins">new para</p></div>"#,
        );
        assert_eq!(
            revision.get_cooked_before(),
            "<p>unchanged removed text</p><p>old para</p>"
        );
        assert_eq!(
            revision.get_cooked_after(),
            "<p>unchanged added text</p><p>new para</p>"
        );
    }

    #[test]
    fn test_with_wrapper_div() {
        let revision = create_basic_revision(
            r#"<div class="inline-diff"><div class="something"><p><del>old</del><ins>new</ins></p></div></div>"#,
        );
        assert_eq!(
            revision.get_cooked_before(),
            r#"<div class="something"><p>old</p></div>"#
        );
        assert_eq!(
            revision.get_cooked_after(),
            r#"<div class="something"><p>new</p></div>"#
        );
    }

    #[test]
    fn test_title_changes() {
        let mut revision = create_basic_revision("");
        revision.title_changes = Some(TitleChanges {
            inline: r#"<div class="inline-diff"><del>Old Title</del><ins>New Title</ins></div>"#
                .to_string(),
        });

        let title_changes = revision.title_changes.as_ref().unwrap();
        assert_eq!(title_changes.get_cooked_before(), "Old Title");
        assert_eq!(title_changes.get_cooked_after(), "New Title");
    }

    #[test]
    fn test_complex_html() {
        let revision = create_basic_revision(
            r#"<div class="inline-diff"><div class="inline-diff">
                <h1><del>Old Title</del><ins>New Title</ins></h1>
                <p class="diff-del">Removed paragraph</p>
                <ul>
                    <li><del>Old item 1</del></li>
                    <li class="diff-ins">New item 2</li>
                </ul>
            </div></div>"#,
        );
        let before = revision.get_cooked_before();
        let after = revision.get_cooked_after();

        assert!(before.contains("Old Title"));
        assert!(before.contains("Removed paragraph"));
        assert!(before.contains("Old item 1"));
        assert!(!before.contains("New item 2"));

        assert!(after.contains("New Title"));
        assert!(!after.contains("Removed paragraph"));
        assert!(!after.contains("Old item 1"));
        assert!(after.contains("New item 2"));
    }

    #[test]
    fn test_multiple_paragraphs() {
        let revision = create_basic_revision(
            r#"<div class="inline-diff"><div class="inline-diff">
                <p>First unchanged paragraph</p>
                <p><del>Second removed paragraph</del></p>
                <p><ins>Second added paragraph</ins></p>
                <p>Third unchanged paragraph</p>
            </div></div>"#,
        );

        let before = revision.get_cooked_before();
        let after = revision.get_cooked_after();

        assert!(before.contains("First unchanged paragraph"));
        assert!(before.contains("Second removed paragraph"));
        assert!(before.contains("Third unchanged paragraph"));
        assert!(!before.contains("Second added paragraph"));

        assert!(after.contains("First unchanged paragraph"));
        assert!(after.contains("Second added paragraph"));
        assert!(after.contains("Third unchanged paragraph"));
        assert!(!after.contains("Second removed paragraph"));
    }

    #[test]
    fn test_complex_inline_diff() {
        let inline_content = r#"<div class="inline-diff"><p>I’ve listened to most of the Alisha twitter space yesterday and while I understand the pov opposing brantly I still think we haven’t given him the freedom of expression and the chance to apologize, neither have we considered other alternative solutions like sanctions and punishments instead of radical termination.</p><p>So the way it is now, if the proposal has only the Yes/No options, I might lean towards No.<ins> </ins><ins>Not </ins><ins>because </ins><ins>I </ins><ins>agree </ins><ins>with </ins><ins>him</ins><ins>,</ins><ins> </ins><ins>but </ins><ins>because </ins><ins>of </ins><ins>the </ins><ins>short</ins><ins>-</ins><ins>sightedness </ins><ins>of </ins><ins>this </ins><ins>proposal </ins><ins>and </ins><ins>the </ins><ins>lack </ins><ins>of </ins><ins>responsability</ins><ins>.</ins><ins> </ins><ins>None </ins><ins>of </ins><ins>you </ins><ins>have </ins><ins>come </ins><ins>up </ins><ins>with </ins><ins>alternatives </ins><ins>or </ins><ins>seriously </ins><ins>considered </ins><ins>the </ins><ins>aftermath </ins><ins>of </ins><ins>this </ins><ins>decision </ins><ins>on </ins><ins>ENS</ins><ins>.</ins></p><p>Please discuss this thoroughly before taking terminal decisions. Drastic decisions pushed by people that have absolutely no skin in ENS, that joined the community just yesterday… and will get what they want, and never contribute here again.</p></div>"#;

        let revision = create_basic_revision(inline_content);
        let before = revision.get_cooked_before();
        let after = revision.get_cooked_after();

        // Expected content before and after changes
        let expected_before = r#"<p>I’ve listened to most of the Alisha twitter space yesterday and while I understand the pov opposing brantly I still think we haven’t given him the freedom of expression and the chance to apologize, neither have we considered other alternative solutions like sanctions and punishments instead of radical termination.</p><p>So the way it is now, if the proposal has only the Yes/No options, I might lean towards No.</p><p>Please discuss this thoroughly before taking terminal decisions. Drastic decisions pushed by people that have absolutely no skin in ENS, that joined the community just yesterday… and will get what they want, and never contribute here again.</p>"#;

        let expected_after = r#"<p>I’ve listened to most of the Alisha twitter space yesterday and while I understand the pov opposing brantly I still think we haven’t given him the freedom of expression and the chance to apologize, neither have we considered other alternative solutions like sanctions and punishments instead of radical termination.</p><p>So the way it is now, if the proposal has only the Yes/No options, I might lean towards No. Not because I agree with him, but because of the short-sightedness of this proposal and the lack of responsability. None of you have come up with alternatives or seriously considered the aftermath of this decision on ENS.</p><p>Please discuss this thoroughly before taking terminal decisions. Drastic decisions pushed by people that have absolutely no skin in ENS, that joined the community just yesterday… and will get what they want, and never contribute here again.</p>"#;

        // Assert that the extracted content matches the expected content
        assert_eq!(before.trim(), expected_before);
        assert_eq!(after.trim(), expected_after);
    }

    #[test]
    fn test_non_ascii_characters() {
        let revision = create_basic_revision(
            r#"<div class="inline-diff"><p><del>caffé</del><ins>café</ins></p></div>"#,
        );
        assert_eq!(revision.get_cooked_before(), "<p>caffé</p>");
        assert_eq!(revision.get_cooked_after(), "<p>café</p>");
    }

    #[test]
    fn test_mixed_content() {
        let revision = create_basic_revision(
            r#"<div class="inline-diff"><p><del>old <strong>text</strong></del><ins>new <em>content</em></ins></p></div>"#,
        );
        assert_eq!(
            revision.get_cooked_before(),
            "<p>old <strong>text</strong></p>"
        );
        assert_eq!(revision.get_cooked_after(), "<p>new <em>content</em></p>");
    }

    #[test]
    fn test_multiple_nested_tags() {
        let inline_content = r#"<div class="inline-diff"><div><p><del>old text</del><ins>new text</ins></p><div><ul><li><del>item 1</del></li><li class="diff-ins">item 2</li></ul></div></div></div>"#;
        let revision = create_basic_revision(inline_content);
        assert_eq!(
            revision.get_cooked_before(),
            "<div><p>old text</p><div><ul><li>item 1</li></ul></div></div>"
        );
        assert_eq!(
            revision.get_cooked_after(),
            "<div><p>new text</p><div><ul><li></li><li>item 2</li></ul></div></div>"
        );
    }

    #[test]
    fn test_complex_proposal_changes() {
        let revision = create_basic_revision(
            r#"<div class="inline-diff"><p>To <del>cover </del><del>OpCo</del><del>'</del><del>s </del><del>operating </del><del>expenses </del><del>over </del><ins>OpCo </ins><ins>will </ins><ins>be </ins><ins>able </ins><ins>to </ins><ins>utilize </ins>the <del>first </del><del>30 </del><del>months</del><del>,</del><del> </del><del>including </del><del>full</del><del>-</del><del>time </del><del>staff </del><del>appointed </del><del>internally</del><del>,</del><del> </del><del>setup </del><del>and </del><del>other </del><del>admin </del><del>costs</del><del>,</del><del> </del><ins>$</ins><ins>12M </ins><ins>in </ins><ins>cash </ins><ins>equivalents </ins>as <del>well </del><del>as </del><del>the </del><del>DAO</del><del>-</del><del>adjacent </del><del>entity</del><del>'</del><del>s </del><del>oversight </del><del>committee</del><del>,</del><del> </del><del>this </del><del>proposal </del><del>suggests </del><del>earmarking </del><del>35M </del><del>ARB </del><del>for </del><del>the </del><del>initiative</del><ins>follows</ins>:</p><div class="lightbox-wrapper"><a class="lightbox" href="https://example.com/image.png" data-download-href="/uploads/image.png" title="OpCo Budget"><img src="https://example.com/image.png" alt="OpCo Budget" width="690" height="389"><div class="meta">Budget Image</div></a></div></div>"#,
        );

        let expected_before = r#"<p>To cover OpCo's operating expenses over the first 30 months, including full-time staff appointed internally, setup and other admin costs, as well as the DAO-adjacent entity's oversight committee, this proposal suggests earmarking 35M ARB for the initiative:</p><div class="lightbox-wrapper"><a class="lightbox" href="https://example.com/image.png" data-download-href="/uploads/image.png" title="OpCo Budget"><img src="https://example.com/image.png" alt="OpCo Budget" width="690" height="389"><div class="meta">Budget Image</div></a></div>"#;

        let expected_after = r#"<p>To OpCo will be able to utilize the $12M in cash equivalents as follows:</p><div class="lightbox-wrapper"><a class="lightbox" href="https://example.com/image.png" data-download-href="/uploads/image.png" title="OpCo Budget"><img src="https://example.com/image.png" alt="OpCo Budget" width="690" height="389"><div class="meta">Budget Image</div></a></div>"#;

        assert_eq!(revision.get_cooked_before().trim(), expected_before);
        assert_eq!(revision.get_cooked_after().trim(), expected_after);
    }

    #[test]
    fn test_complex_diff_with_lists() {
        let revision = create_basic_revision(
            r#"<div class="inline-diff"><ul class="diff-ins">
                <li>4M ARB allocated to a bonus pool for internal employees and OpCo's oversight committee.</li>
                <li>Of the remaining 18M ARB, tokens will be liquidated until $12M worth of cash equivalents has been attained.</li>
                <li>After subtracting the bonus allocation and the liquidation is complete, the remaining ARB will be transferred back.</li>
            </ul><p class="diff-del">The previous structure has been removed.</p></div>"#,
        );

        let expected_before = "<p>The previous structure has been removed.</p>";
        let expected_after = r#"<ul>
                <li>4M ARB allocated to a bonus pool for internal employees and OpCo's oversight committee.</li>
                <li>Of the remaining 18M ARB, tokens will be liquidated until $12M worth of cash equivalents has been attained.</li>
                <li>After subtracting the bonus allocation and the liquidation is complete, the remaining ARB will be transferred back.</li>
            </ul>"#;

        assert_eq!(revision.get_cooked_before().trim(), expected_before);
        assert_eq!(revision.get_cooked_after().trim(), expected_after);
    }

    #[test]
    fn test_opco_proposal_changes() {
        let revision = create_basic_revision(
            r#"<div class="inline-diff">
                <p class="diff-ins">To cover OpCo's operating expenses over the first 30 months, including full-time staff appointed internally, setup and other admin costs, as well as the DAO-adjacent entity's oversight committee, this proposal suggests earmarking 22M ARB (subject to change in either direction if market conditions change notably between the Snapshot and Tally votes) for the initiative:</p>
                <ul class="diff-ins">
                    <li>4M ARB allocated to a bonus pool for internal employees and OpCo's oversight committee (3M reserved for internal employees and 1M reserved for the committee). If bonuses are paid out, they must be denominated in ARB and have a vesting structure attached, with internal employees' payouts additionally being performance-based.</li>
                    <li>Of the remaining 18M ARB, tokens will be liquidated until $12M worth of cash equivalents has been attained.</li>
                    <li>After subtracting the bonus allocation and the liquidation is complete, the remaining ARB will be immediately transferred back to the DAO treasury.</li>
                </ul>
                <p><del>To cover OpCo's operating expenses over the first 30 months</del><ins>OpCo will be able to utilize the $12M in cash equivalents</ins> as follows:</p>
                <ul>
                    <li class="diff-del">4M ARB allocated to a bonus pool</li>
                    <li>$2.5M worth of <del>ARB</del><ins>stable assets</ins> released upfront.</li>
                    <li>Once OpCo has officially operationalized, the entity can draw up to $500K <del>worth of ARB</del><ins>cash equivalents</ins> each month.</li>
                </ul>
                <p>The Chief of Coins, together with relevant parties, will be responsible for maintaining an adequate runway for covering <del>USD-denominated</del> expenses as well as establishing a low-risk management strategy for idle capital.</p>
            </div>"#,
        );

        // Store the trimmed content in variables
        let before_content = revision.get_cooked_before();
        let before = before_content.trim();

        // Test the before content
        assert!(before.contains("To cover OpCo's operating expenses over the first 30 months"));
        assert!(before.contains("4M ARB allocated to a bonus pool"));
        assert!(before.contains("$2.5M worth of ARB released upfront"));
        assert!(before.contains("worth of ARB each month"));
        assert!(before.contains("USD-denominated expenses"));
        assert!(!before.contains("stable assets"));
        assert!(!before.contains("cash equivalents"));

        // Store the trimmed content in variables
        let after_content = revision.get_cooked_after();
        let after = after_content.trim();

        // Test the after content
        assert!(after.contains("To cover OpCo's operating expenses over the first 30 months"));
        assert!(after.contains("4M ARB allocated to a bonus pool for internal employees"));
        assert!(after.contains("Of the remaining 18M ARB"));
        assert!(after.contains("$12M worth of cash equivalents"));
        assert!(after.contains("$2.5M worth of stable assets released upfront"));
        assert!(after.contains("OpCo will be able to utilize the $12M in cash equivalents"));
        assert!(!after.contains("USD-denominated"));
        assert!(!after.contains("worth of ARB each month"));

        // Test specific structural elements
        assert!(after.contains("<ul>"));
        assert!(after.contains("</ul>"));
        assert!(after.contains("<li>"));
        assert!(after.contains("</li>"));
    }

    #[test]
    fn test_opco_complex_structure_changes() {
        let revision = create_basic_revision(
            r#"<div class="inline-diff">
                <h1><a name="p-61648-governance-and-compliance-requirements-for-opco-its-internal-employees-and-the-oat-12" class="anchor">Governance and Compliance Requirements for OpCo<ins>,</ins><ins> its </ins><del>'s </del>Internal <ins>Employees</ins><ins>,</ins> and the OAT</a></h1>
                <ul>
                    <li>Internal full-time employees (not OAT members): these individuals are <ins>forbidden</ins><del>required to abstain</del> from <ins>participating in</ins> Arbitrum DAO governance <ins>votes</ins>.</li>
                    <li><del>OpCo votes that are directly related to</del><ins>OpCo in its capacity as a legal entity: the entity is prohibited from becoming a delegate</ins> and <ins>cannot assume token delegations</ins><del>its operations</del>.</li>
                </ul>
            </div>"#,
        );

        // Store the trimmed content in variables
        let before_content = revision.get_cooked_before();
        let before = before_content.trim();

        // Test the before content
        assert!(before.contains("required to abstain"));
        assert!(before.contains("OpCo votes that are directly related to"));
        assert!(before.contains("its operations"));
        assert!(!before.contains("forbidden"));
        assert!(!before.contains("cannot assume token delegations"));

        // Store the trimmed content in variables
        let after_content = revision.get_cooked_after();
        let after = after_content.trim();

        // Test the after content
        assert!(after.contains(
            "Governance and Compliance Requirements for OpCo, its Internal Employees, and the OAT"
        ));
        assert!(after.contains("forbidden"));
        assert!(after.contains("participating in"));
        assert!(after.contains("OpCo in its capacity as a legal entity"));
        assert!(after.contains("cannot assume token delegations"));
        assert!(!after.contains("required to abstain"));
        assert!(!after.contains("its operations"));
    }
}
