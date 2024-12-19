use chrono::{DateTime, Utc};
use regex::Regex;
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
        let re_wrapper_div = Regex::new(r#"^<div class="inline-diff">|</div>$"#).unwrap();
        let mut result = re_wrapper_div.replace_all(content, "").to_string();

        // Handle <del>...</del>
        let re_del = Regex::new(r#"<del>(.*?)</del>"#).unwrap();
        for caps in re_del.captures_iter(&result.clone()) {
            result = result.replace(&caps[0], &caps[1]);
        }

        // Remove <ins>...</ins>
        let re_ins = Regex::new(r#"<ins>.*?</ins>"#).unwrap();
        result = re_ins.replace_all(&result, "").to_string();

        // Handle <tag class="diff-del">...</tag>
        let re_diff_del_class = Regex::new(r#"<([^>]+) class="diff-del">(.*?)</[^>]+>"#).unwrap();
        for caps in re_diff_del_class.captures_iter(&result.clone()) {
            result = result.replace(
                &caps[0],
                &format!("<{}>{}</{}>", &caps[1], &caps[2], &caps[1]),
            );
        }

        println!("Remove <tag class=\"diff-ins\">...</tag>");
        // Remove <tag class="diff-ins">...</tag>
        let re_diff_ins_class = Regex::new(r#"<([^>]+) class="diff-ins">(.*?)</[^>]+>"#).unwrap();
        for caps in re_diff_ins_class.captures_iter(&result.clone()) {
            println!("caps");
            println!("{:?}", caps);
            result = result.replace(&caps[0], "");
        }

        // Clean up whitespace and normalize newlines
        result.replace("\r\n", "\n").trim().to_string()
    }

    fn extract_after_content(content: &str) -> String {
        let re_wrapper_div = Regex::new(r#"^<div class="inline-diff">|</div>$"#).unwrap();
        let mut result = re_wrapper_div.replace_all(content, "").to_string();

        // Remove <del>...</del>
        let re_del = Regex::new(r#"<del>.*?</del>"#).unwrap();
        result = re_del.replace_all(&result, "").to_string();

        // Handle <ins>...</ins>
        let re_ins = Regex::new(r#"<ins>(.*?)</ins>"#).unwrap();
        for caps in re_ins.captures_iter(&result.clone()) {
            result = result.replace(&caps[0], &caps[1]);
        }

        // Remove <tag class="diff-del">...</tag>
        let re_diff_del_class = Regex::new(r#"<([^>]+) class="diff-del">(.*?)</[^>]+>"#).unwrap();
        for caps in re_diff_del_class.captures_iter(&result.clone()) {
            result = result.replace(&caps[0], "");
        }

        // Handle <tag class="diff-ins">...</tag>
        let re_diff_ins_class = Regex::new(r#"<([^>]+) class="diff-ins">(.*?)</[^>]+>"#).unwrap();
        for caps in re_diff_ins_class.captures_iter(&result.clone()) {
            result = result.replace(
                &caps[0],
                &format!("<{}>{}</{}>", &caps[1], &caps[2], &caps[1]),
            );
        }

        // Clean up whitespace and normalize newlines
        result.replace("\r\n", "\n").trim().to_string()
    }
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
    fn test_complex_diff_ins_p() {
        let revision = create_basic_revision(
            r#"<div class="inline-diff"><p class="diff-ins">inserted</p><p class="diff-del">removed</p></div>"#,
        );

        let expected_before = "<p>removed</p>";
        let expected_after = r#"<p>inserted</p>"#;

        assert_eq!(revision.get_cooked_before().trim(), expected_before);
        assert_eq!(revision.get_cooked_after().trim(), expected_after);
    }

    #[test]
    fn test_complex_diff_ins_ul() {
        let revision = create_basic_revision(
            r#"<div class="inline-diff"><ul class="diff-ins"><li>inserted</li></ul><ul class="diff-del"><li>removed</li></ul></div>"#,
        );

        let expected_before = "<ul><li>removed</li></ul>";
        let expected_after = r#"<ul><li>inserted</li></ul>"#;

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

    #[test]
    fn test_opco_complex_team_and_cost_changes_before() {
        let inline_content = r#"<div class="inline-diff"><li>Team: Alex Lumley, Lumen of PowerHouse, Customer Stakeholder Representative Group and potentially a group of SPs who will leverage reporting &amp; information and Incorporate community stakeholders into workflows to enhance transparency and collaboration.</li>
        <li><strong class="diff-del">Cost:</strong class="diff-del"> <ins>a </ins><ins>maximum </ins><ins>of </ins><del>Up </del><del>to </del>$263,260 for the continuation of the reporting <ins>function </ins><ins>for </ins><ins>up </ins><ins>to </ins><ins>12 </ins><ins>months</ins><del>function</del>, 4 months of backpay, grants to incorporate the community and research areas such as information dissemination and how to incorporate other tools the community has built.</li>
        </div>"#;

        let revision = create_basic_revision(inline_content);

        // Expected content before and after changes
        let expected_before = r#"<li>Team: Alex Lumley, Lumen of PowerHouse, Customer Stakeholder Representative Group and potentially a group of SPs who will leverage reporting &amp; information and Incorporate community stakeholders into workflows to enhance transparency and collaboration.</li>
        <li><strong>Cost:</strong> Up to $263,260 for the continuation of the reporting function, 4 months of backpay, grants to incorporate the community and research areas such as information dissemination and how to incorporate other tools the community has built.</li>"#;

        // Assert that the extracted content matches the expected content
        assert_eq!(revision.get_cooked_before().trim(), expected_before);
    }

    #[test]
    fn test_opco_complex_team_and_cost_changes_after() {
        let inline_content = r#"<div class="inline-diff"><li>Team: Alex Lumley, Lumen of PowerHouse, Customer Stakeholder Representative Group and potentially a group of SPs who will leverage reporting &amp; information and Incorporate community stakeholders into workflows to enhance transparency and collaboration.</li>
        <li><strong class="diff-del">Cost:</strong class="diff-del"> <ins>a </ins><ins>maximum </ins><ins>of </ins><del>Up </del><del>to </del>$263,260 for the continuation of the reporting <ins>function </ins><ins>for </ins><ins>up </ins><ins>to </ins><ins>12 </ins><ins>months</ins><del>function</del>, 4 months of backpay, grants to incorporate the community and research areas such as information dissemination and how to incorporate other tools the community has built.</li>
        </div>"#;

        let revision = create_basic_revision(inline_content);

        let expected_after = r#"<li>Team: Alex Lumley, Lumen of PowerHouse, Customer Stakeholder Representative Group and potentially a group of SPs who will leverage reporting &amp; information and Incorporate community stakeholders into workflows to enhance transparency and collaboration.</li>
        <li>Cost: a maximum of $263,260 for the continuation of the reporting function for up to 12 months, 4 months of backpay, grants to incorporate the community and research areas such as information dissemination and how to incorporate other tools the community has built.</li>"#;

        // Assert that the extracted content matches the expected content
        assert_eq!(revision.get_cooked_after().trim(), expected_after);
    }
}
