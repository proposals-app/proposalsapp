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
        result = result
            .replace(r#"<div class="inline-diff">"#, "")
            .replace("</div>", "");

        // Remove all insertion tags and their content
        while let Some(start) = result.find("<ins>") {
            if let Some(end) = result[start..].find("</ins>") {
                result.replace_range(start..start + end + 6, "");
            } else {
                break;
            }
        }

        // Handle elements with diff-ins class
        while let Some(start_tag) = find_tag_with_class(&result, "diff-ins") {
            if let Some(end_tag) = find_closing_tag(&result[start_tag..]) {
                result.replace_range(start_tag..start_tag + end_tag, "");
            }
        }

        // Clean up deletion markers but keep content
        result = result.replace("<del>", "").replace("</del>", "");

        // Remove diff-del class but keep content
        result = remove_class_keep_content(&result, "diff-del");

        // Clean up whitespace and normalize newlines
        result = result.replace("\r\n", "\n").trim().to_string();

        result
    }

    fn extract_after_content(content: &str) -> String {
        let mut result = content.to_string();

        // Remove wrapper div if present
        result = result
            .replace(r#"<div class="inline-diff">"#, "")
            .replace("</div>", "");

        // Remove all deletion tags and their content
        while let Some(start) = result.find("<del>") {
            if let Some(end) = result[start..].find("</del>") {
                result.replace_range(start..start + end + 6, "");
            } else {
                break;
            }
        }

        // Handle elements with diff-del class
        while let Some(start_tag) = find_tag_with_class(&result, "diff-del") {
            if let Some(end_tag) = find_closing_tag(&result[start_tag..]) {
                result.replace_range(start_tag..start_tag + end_tag, "");
            }
        }

        // Clean up insertion markers but keep content
        result = result.replace("<ins>", "").replace("</ins>", "");

        // Remove diff-ins class but keep content
        result = remove_class_keep_content(&result, "diff-ins");

        // Clean up whitespace and normalize newlines
        result = result.replace("\r\n", "\n").trim().to_string();

        result
    }
}

fn find_closing_tag(content: &str) -> Option<usize> {
    let bytes = content.as_bytes();
    let mut depth = 0;
    let mut pos = 0;
    let mut in_tag = false;

    while pos < bytes.len() {
        match bytes[pos] {
            b'<' => {
                if pos + 1 < bytes.len() {
                    match bytes[pos + 1] {
                        b'/' => {
                            if depth > 0 {
                                depth -= 1;
                                if depth == 0 {
                                    // Find the end of this closing tag
                                    while pos < bytes.len() && bytes[pos] != b'>' {
                                        pos += 1;
                                    }
                                    return Some(pos + 1);
                                }
                            }
                        }
                        b'!' | b'?' => {
                            // Skip comments and processing instructions
                            while pos < bytes.len() && bytes[pos] != b'>' {
                                pos += 1;
                            }
                        }
                        _ => {
                            if !in_tag {
                                depth += 1;
                                in_tag = true;
                            }
                        }
                    }
                }
            }
            b'>' => {
                in_tag = false;
                // Handle self-closing tags
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

fn remove_class_keep_content(content: &str, class_name: &str) -> String {
    let mut result = content.to_string();
    let mut pos = 0;
    let mut processed_len = 0;

    while pos < result.len() {
        if let Some(start_tag) = find_tag_with_class(&result[pos..], class_name) {
            let absolute_start = pos + start_tag;
            if let Some(end_tag) = find_closing_tag(&result[absolute_start..]) {
                let absolute_end = absolute_start + end_tag;
                let full_tag_content = &result[absolute_start..absolute_end];
                let tag_name = extract_tag_name(full_tag_content);

                if let Some(tag) = tag_name {
                    // Extract the content between the opening and closing tags
                    if let Some(content_start) = full_tag_content.find('>') {
                        let content_start = absolute_start + content_start + 1;
                        let content_end = absolute_end - tag.len() - 3; // "</tag>"
                        let inner_content = result[content_start..content_end].to_string();

                        // Replace the entire element with just its content
                        result.replace_range(
                            absolute_start..absolute_end,
                            &format!("<{}>{}</{}>", tag, inner_content, tag),
                        );

                        // Move position past the processed content
                        processed_len = tag.len() * 2 + inner_content.len() + 5; // <tag>content</tag>
                        pos = absolute_start + processed_len;
                        continue;
                    }
                }
            }
        }
        pos += 1;
    }
    result
}

fn find_tag_with_class(content: &str, class_name: &str) -> Option<usize> {
    let class_attr = format!("class=\"{}\"", class_name);
    let mut start_pos = 0;

    while let Some(class_pos) = content[start_pos..].find(&class_attr) {
        let absolute_pos = start_pos + class_pos;
        // Search backwards for the opening '<'
        for i in (0..absolute_pos).rev() {
            if content.as_bytes()[i] == b'<' {
                return Some(i);
            }
        }
        start_pos = absolute_pos + class_attr.len();
    }
    None
}

fn extract_tag_name(tag: &str) -> Option<String> {
    let start = tag.find('<')? + 1;
    let remaining = &tag[start..];
    let end = remaining.find(|c: char| c.is_whitespace() || c == '>')?;
    Some(remaining[..end].to_string())
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
            r#"<div class="inline-diff"><div class="inline-diff"><p><del>old</del><ins>new</ins></p></div></div>"#,
        );
        assert_eq!(revision.get_cooked_before(), "<p>old</p>");
        assert_eq!(revision.get_cooked_after(), "<p>new</p>");
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
        let expected_before = r#"<p>I’ve listened to most of the Alisha twitter space yesterday and while I understand the pov opposing brantly I still think we haven’t given him the freedom of expression and the chance to apologize, neither have we considered other alternative solutions like sanctions and punishments instead of radical termination.</p><p>So the way it is now, if the proposal has only the Yes/No options, I might lean towards No.None of you have come up with alternatives or seriously considered the aftermath of this decision on ENS.</p><p>Please discuss this thoroughly before taking terminal decisions. Drastic decisions pushed by people that have absolutely no skin in ENS, that joined the community just yesterday… and will get what they want, and never contribute here again.</p>"#;

        let expected_after = r#"<p>I’ve listened to most of the Alisha twitter space yesterday and while I understand the pov opposing brantly I still think we haven’t given him the freedom of expression and the chance to apologize, neither have we considered other alternative solutions like sanctions and punishments instead of radical termination.</p><p>So the way it is now, if the proposal has only the Yes/No options, I might lean towards No. Not because I agree with him, but because of the short-sightedness of this proposal and the lack of responsability. None of you have come up with alternatives or seriously considered the aftermath of this decision on ENS.</p><p>Please discuss this thoroughly before taking terminal decisions. Drastic decisions pushed by people that have absolutely no skin in ENS, that joined the community just yesterday… and will get what they want, and never contribute here again.</p>"#;

        // Assert that the extracted content matches the expected content
        assert_eq!(before.trim(), expected_before);
        assert_eq!(after.trim(), expected_after);
    }

    #[test]
    fn test_non_ascii_characters() {
        let revision = create_basic_revision(
            r#"<div class="inline-diff"><p><del>café</del><ins>café</ins></p></div>"#,
        );
        assert_eq!(revision.get_cooked_before(), "café");
        assert_eq!(revision.get_cooked_after(), "café");
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
            "<p>old text</p><ul><li>item 1</li></ul>"
        );
        assert_eq!(
            revision.get_cooked_after(),
            "<p>new text</p><ul><li>item 2</li></ul>"
        );
    }
}
