use fancy_regex::Regex;

fn cleanup_html(content: &str) -> String {
    // First normalize all whitespace/newlines to single spaces
    let mut result = content.replace('\n', " ").replace('\r', " ");

    // Remove spaces between tags
    let between_tags = Regex::new(r">\s+<").unwrap();
    result = between_tags.replace_all(&result, "><").to_string();

    // Remove extra spaces
    let multi_spaces = Regex::new(r"\s{2,}").unwrap();
    result = multi_spaces.replace_all(&result, " ").to_string();

    // Fix common HTML structure issues
    // 1. Fix nested meta div inside anchor tags
    let nested_meta = Regex::new(r#"(<div class="meta">.*?)</a></div>"#).unwrap();
    result = nested_meta.replace_all(&result, "$1</div></a>").to_string();

    // Trim leading/trailing whitespace
    let mut result = result.trim().to_string();

    // Final step: Remove outer container <div> if it only contains inline content
    let re_wrapper_div = Regex::new(r#"<div>(.*?)</div>"#).unwrap();
    if let Ok(Some(mat)) = re_wrapper_div.find(&result) {
        let inner_content = mat.as_str().replace("<div>", "").replace("</div>", "");
        // Check if the inner content is the same as the original result without <div> tags
        if format!("<div>{}</div>", inner_content.trim()) == result {
            result = inner_content;
        }
    }

    result
}

pub fn extract_before_content_inline(content: &str) -> Result<String, fancy_regex::Error> {
    let mut result = content.to_string();

    // Rule 1 & 2: Remove outer inline-diff div if both opening and closing tags exist
    let re_wrapper_div = Regex::new(r#"<div class="inline-diff">([\s\S]*?)</div>"#)?;
    if re_wrapper_div.is_match(&result)? {
        result = re_wrapper_div.replace_all(content, "$1").to_string();
    }

    // Handle diff-del in both opening and closing tags (with multiple classes)
    let both_diff_del = Regex::new(
        r#"<([a-zA-Z0-9]+)\s+class="[^"]*diff-del[^"]*">([\s\S]*?)</\1\s+class="[^"]*diff-del[^"]*">"#,
    )?;
    result = both_diff_del
        .replace_all(&result, "<$1>$2</$1>")
        .to_string();

    // Handle diff-del class in opening tag (with multiple classes)
    let diff_del_pattern =
        Regex::new(r#"<([a-zA-Z0-9]+)\s+class="[^"]*diff-del[^"]*">([\s\S]*?)</\1>"#)?;
    result = diff_del_pattern
        .replace_all(&result, "<$1>$2</$1>")
        .to_string();

    // Remove diff-ins elements completely including their content (with multiple classes)
    let diff_ins_pattern =
        Regex::new(r#"<([a-zA-Z0-9]+)\s+class="[^"]*diff-ins[^"]*">[\s\S]*?</\1>"#)?;
    result = diff_ins_pattern.replace_all(&result, "").to_string();

    // Keep content inside <del> tags including whitespace
    let del_pattern = Regex::new(r#"<del>([\s\S]*?)</del>"#)?;
    result = del_pattern.replace_all(&result, "$1").to_string();

    // Remove content inside <ins> tags
    let ins_pattern = Regex::new(r#"<ins>[\s\S]*?</ins>"#)?;
    result = ins_pattern.replace_all(&result, "").to_string();

    // Final cleanup
    Ok(cleanup_html(&result))
}

pub fn extract_after_content_inline(content: &str) -> Result<String, fancy_regex::Error> {
    let mut result = content.to_string();

    // Rule 1 & 2: Remove outer inline-diff div if both opening and closing tags exist
    let re_wrapper_div = Regex::new(r#"<div class="inline-diff">([\s\S]*?)</div>"#)?;
    if re_wrapper_div.is_match(&result)? {
        result = re_wrapper_div.replace_all(content, "$1").to_string();
    }

    // Handle diff-del in both opening and closing tags (with multiple classes)
    let both_diff_del = Regex::new(
        r#"<([a-zA-Z0-9]+)\s+class="[^"]*diff-del[^"]*">(.*?)</\1\s+class="[^"]*diff-del[^"]*">"#,
    )?;
    result = both_diff_del.replace_all(&result, "$2").to_string();

    // Remove diff-del elements completely including their content (with multiple classes)
    let diff_del_pattern =
        Regex::new(r#"<([a-zA-Z0-9]+)\s+class="[^"]*diff-del[^"]*">[\s\S]*?</\1>"#)?;
    result = diff_del_pattern.replace_all(&result, "").to_string();

    // Handle diff-ins class (with multiple classes)
    let diff_ins_pattern =
        Regex::new(r#"<([a-zA-Z0-9]+)\s+class="[^"]*diff-ins[^"]*">([\s\S]*?)</\1>"#)?;
    result = diff_ins_pattern
        .replace_all(&result, "<$1>$2</$1>")
        .to_string();

    // Remove content inside <del> tags
    let del_pattern = Regex::new(r#"<del>[\s\S]*?</del>"#)?;
    result = del_pattern.replace_all(&result, "").to_string();

    // Keep content inside <ins> tags including whitespace
    let ins_pattern = Regex::new(r#"<ins>([\s\S]*?)</ins>"#)?;
    result = ins_pattern.replace_all(&result, "$1").to_string();

    // Final cleanup
    Ok(cleanup_html(&result))
}

#[cfg(test)]
mod inline_changes {
    use crate::models::revisions::inline_changes::{
        extract_after_content_inline, extract_before_content_inline,
    };

    #[test]
    fn test_simple_ins_del() {
        let content = r#"<div class="inline-diff"><del>old text</del><ins>new text</ins></div>"#;
        let before = extract_before_content_inline(&content).unwrap();
        let after = extract_after_content_inline(&content).unwrap();

        assert_eq!(before, "old text");
        assert_eq!(after, "new text");
    }

    #[test]
    fn test_empty_del() {
        let content = r#"<div class="inline-diff"><del>
            </del><ins>new text</ins></div>"#;

        let before = extract_before_content_inline(&content).unwrap();
        let after = extract_after_content_inline(&content).unwrap();
        assert_eq!(before, r#""#);
        assert_eq!(after, "new text");
    }

    #[test]
    fn test_nested_tags() {
        let content = r#"<div class="inline-diff"><p><del>old <strong>formatted</strong> text</del></p><p><ins>new <em>styled</em> text</ins></p></div>"#;
        let before = extract_before_content_inline(&content).unwrap();
        let after = extract_after_content_inline(&content).unwrap();

        assert_eq!(before, "<p>old <strong>formatted</strong> text</p><p></p>");
        assert_eq!(after, "<p></p><p>new <em>styled</em> text</p>");
    }

    #[test]
    fn test_diff_classes() {
        let content = r#"<div class="inline-diff"><p class="diff-del">removed paragraph</p><p class="diff-ins">added paragraph</p></div>"#;

        let before = extract_before_content_inline(&content).unwrap();
        let after = extract_after_content_inline(&content).unwrap();

        assert_eq!(before.trim(), "<p>removed paragraph</p>");
        assert_eq!(after.trim(), "<p>added paragraph</p>");
    }

    #[test]
    fn test_mixed_changes() {
        let content = r#"<div class="inline-diff"><p>unchanged <del>removed</del><ins>added</ins> text</p><p class="diff-del">old para</p><p class="diff-ins">new para</p></div>"#;

        let before = extract_before_content_inline(&content).unwrap();
        let after = extract_after_content_inline(&content).unwrap();
        assert_eq!(before, "<p>unchanged removed text</p><p>old para</p>");
        assert_eq!(after, "<p>unchanged added text</p><p>new para</p>");
    }

    #[test]
    fn test_with_wrapper_div() {
        let content = r#"<div class="inline-diff"><div class="something"><p><del>old</del><ins>new</ins></p></div></div>"#;

        let before = extract_before_content_inline(&content).unwrap();
        let after = extract_after_content_inline(&content).unwrap();
        assert_eq!(before, r#"<div class="something"><p>old</p></div>"#);
        assert_eq!(after, r#"<div class="something"><p>new</p></div>"#);
    }

    #[test]
    fn test_complex_html() {
        let content = r#"<div class="inline-diff"><div class="inline-diff">
                <h1><del>Old Title</del><ins>New Title</ins></h1>
                <p class="diff-del">Removed paragraph</p>
                <ul>
                    <li><del>Old item 1</del></li>
                    <li class="diff-ins">New item 2</li>
                </ul>
            </div></div>"#;

        let before = extract_before_content_inline(&content).unwrap();
        let after = extract_after_content_inline(&content).unwrap();

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
        let content = r#"<div class="inline-diff"><div class="inline-diff">
                <p>First unchanged paragraph</p>
                <p><del>Second removed paragraph</del></p>
                <p><ins>Second added paragraph</ins></p>
                <p>Third unchanged paragraph</p>
            </div></div>"#;

        let before = extract_before_content_inline(&content).unwrap();
        let after = extract_after_content_inline(&content).unwrap();

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
        let content = r#"<div class="inline-diff"><p>I’ve listened to most of the Alisha twitter space yesterday and while I understand the pov opposing brantly I still think we haven’t given him the freedom of expression and the chance to apologize, neither have we considered other alternative solutions like sanctions and punishments instead of radical termination.</p><p>So the way it is now, if the proposal has only the Yes/No options, I might lean towards No.<ins> </ins><ins>Not </ins><ins>because </ins><ins>I </ins><ins>agree </ins><ins>with </ins><ins>him</ins><ins>,</ins><ins> </ins><ins>but </ins><ins>because </ins><ins>of </ins><ins>the </ins><ins>short</ins><ins>-</ins><ins>sightedness </ins><ins>of </ins><ins>this </ins><ins>proposal </ins><ins>and </ins><ins>the </ins><ins>lack </ins><ins>of </ins><ins>responsability</ins><ins>.</ins><ins> </ins><ins>None </ins><ins>of </ins><ins>you </ins><ins>have </ins><ins>come </ins><ins>up </ins><ins>with </ins><ins>alternatives </ins><ins>or </ins><ins>seriously </ins><ins>considered </ins><ins>the </ins><ins>aftermath </ins><ins>of </ins><ins>this </ins><ins>decision </ins><ins>on </ins><ins>ENS</ins><ins>.</ins></p><p>Please discuss this thoroughly before taking terminal decisions. Drastic decisions pushed by people that have absolutely no skin in ENS, that joined the community just yesterday… and will get what they want, and never contribute here again.</p></div>"#;

        let before = extract_before_content_inline(&content).unwrap();
        let after = extract_after_content_inline(&content).unwrap();

        // Expected content before and after changes
        let expected_before = r#"<p>I’ve listened to most of the Alisha twitter space yesterday and while I understand the pov opposing brantly I still think we haven’t given him the freedom of expression and the chance to apologize, neither have we considered other alternative solutions like sanctions and punishments instead of radical termination.</p><p>So the way it is now, if the proposal has only the Yes/No options, I might lean towards No.</p><p>Please discuss this thoroughly before taking terminal decisions. Drastic decisions pushed by people that have absolutely no skin in ENS, that joined the community just yesterday… and will get what they want, and never contribute here again.</p>"#;

        let expected_after = r#"<p>I’ve listened to most of the Alisha twitter space yesterday and while I understand the pov opposing brantly I still think we haven’t given him the freedom of expression and the chance to apologize, neither have we considered other alternative solutions like sanctions and punishments instead of radical termination.</p><p>So the way it is now, if the proposal has only the Yes/No options, I might lean towards No. Not because I agree with him, but because of the short-sightedness of this proposal and the lack of responsability. None of you have come up with alternatives or seriously considered the aftermath of this decision on ENS.</p><p>Please discuss this thoroughly before taking terminal decisions. Drastic decisions pushed by people that have absolutely no skin in ENS, that joined the community just yesterday… and will get what they want, and never contribute here again.</p>"#;

        // Assert that the extracted content matches the expected content
        assert_eq!(before.trim(), expected_before);
        assert_eq!(after.trim(), expected_after);
    }

    #[test]
    fn test_non_ascii_characters() {
        let content = r#"<div class="inline-diff"><p><del>caffé</del><ins>café</ins></p></div>"#;

        let before = extract_before_content_inline(&content).unwrap();
        let after = extract_after_content_inline(&content).unwrap();

        assert_eq!(before, "<p>caffé</p>");
        assert_eq!(after, "<p>café</p>");
    }

    #[test]
    fn test_mixed_content() {
        let content = r#"<div class="inline-diff"><p><del>old <strong>text</strong></del><ins>new <em>content</em></ins></p></div>"#;

        let before = extract_before_content_inline(&content).unwrap();
        let after = extract_after_content_inline(&content).unwrap();
        assert_eq!(before, "<p>old <strong>text</strong></p>");
        assert_eq!(after, "<p>new <em>content</em></p>");
    }

    #[test]
    fn test_multiple_nested_tags() {
        let content = r#"<div class="inline-diff"><div><p><del>old text</del><ins>new text</ins></p><div><ul><li><del>item 1</del></li><li class="diff-ins">item 2</li></ul></div></div></div>"#;

        let before = extract_before_content_inline(&content).unwrap();
        let after = extract_after_content_inline(&content).unwrap();
        assert_eq!(
            before,
            "<div><p>old text</p><div><ul><li>item 1</li></ul></div></div>"
        );
        assert_eq!(
            after,
            "<div><p>new text</p><div><ul><li></li><li>item 2</li></ul></div></div>"
        );
    }

    #[test]
    fn test_complex_proposal_changes() {
        let content = r#"<div class="inline-diff"><p>To <del>cover </del><del>OpCo</del><del>'</del><del>s </del><del>operating </del><del>expenses </del><del>over </del><ins>OpCo </ins><ins>will </ins><ins>be </ins><ins>able </ins><ins>to </ins><ins>utilize </ins>the <del>first </del><del>30 </del><del>months</del><del>,</del><del> </del><del>including </del><del>full</del><del>-</del><del>time </del><del>staff </del><del>appointed </del><del>internally</del><del>,</del><del> </del><del>setup </del><del>and </del><del>other </del><del>admin </del><del>costs</del><del>,</del><del> </del><ins>$</ins><ins>12M </ins><ins>in </ins><ins>cash </ins><ins>equivalents </ins>as <del>well </del><del>as </del><del>the </del><del>DAO</del><del>-</del><del>adjacent </del><del>entity</del><del>'</del><del>s </del><del>oversight </del><del>committee</del><del>,</del><del> </del><del>this </del><del>proposal </del><del>suggests </del><del>earmarking </del><del>35M </del><del>ARB </del><del>for </del><del>the </del><del>initiative</del><ins>follows</ins>:</p><div class="lightbox-wrapper"><a class="lightbox" href="https://example.com/image.png" data-download-href="/uploads/image.png" title="OpCo Budget"><img src="https://example.com/image.png" alt="OpCo Budget" width="690" height="389"><div class="meta">Budget Image</div></a></div></div>"#;

        let expected_before = r#"<p>To cover OpCo's operating expenses over the first 30 months, including full-time staff appointed internally, setup and other admin costs, as well as the DAO-adjacent entity's oversight committee, this proposal suggests earmarking 35M ARB for the initiative:</p><div class="lightbox-wrapper"><a class="lightbox" href="https://example.com/image.png" data-download-href="/uploads/image.png" title="OpCo Budget"><img src="https://example.com/image.png" alt="OpCo Budget" width="690" height="389"><div class="meta">Budget Image</div></a></div>"#;

        let expected_after = r#"<p>To OpCo will be able to utilize the $12M in cash equivalents as follows:</p><div class="lightbox-wrapper"><a class="lightbox" href="https://example.com/image.png" data-download-href="/uploads/image.png" title="OpCo Budget"><img src="https://example.com/image.png" alt="OpCo Budget" width="690" height="389"><div class="meta">Budget Image</div></a></div>"#;

        let before = extract_before_content_inline(&content).unwrap();
        let after = extract_after_content_inline(&content).unwrap();

        assert_eq!(before, expected_before);
        assert_eq!(after, expected_after);
    }

    #[test]
    fn test_complex_diff_ins_p() {
        let content = r#"<div class="inline-diff"><p class="diff-ins">inserted</p><p class="diff-del">removed</p></div>"#;

        let expected_before = "<p>removed</p>";
        let expected_after = r#"<p>inserted</p>"#;

        let before = extract_before_content_inline(&content).unwrap();
        let after = extract_after_content_inline(&content).unwrap();
        assert_eq!(before, expected_before);
        assert_eq!(after, expected_after);
    }

    #[test]
    fn test_complex_diff_ins_ul() {
        let content = r#"<div class="inline-diff"><ul class="diff-ins"><li>inserted</li></ul><ul class="diff-del"><li>removed</li></ul></div>"#;

        let expected_before = "<ul><li>removed</li></ul>";
        let expected_after = r#"<ul><li>inserted</li></ul>"#;

        let before = extract_before_content_inline(&content).unwrap();
        let after = extract_after_content_inline(&content).unwrap();

        assert_eq!(before, expected_before);
        assert_eq!(after, expected_after);
    }

    #[test]
    fn test_opco_proposal_changes() {
        let content = r#"<div class="inline-diff">
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
            </div>"#;

        let before = extract_before_content_inline(&content).unwrap();
        let after = extract_after_content_inline(&content).unwrap();

        // Test the before content
        assert!(before.contains("To cover OpCo's operating expenses over the first 30 months"));
        assert!(before.contains("4M ARB allocated to a bonus pool"));
        assert!(before.contains("$2.5M worth of ARB released upfront"));
        assert!(before.contains("worth of ARB each month"));
        assert!(before.contains("USD-denominated expenses"));
        assert!(!before.contains("stable assets"));

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
        let content = r#"<div class="inline-diff">
                <h1><a name="p-61648-governance-and-compliance-requirements-for-opco-its-internal-employees-and-the-oat-12" class="anchor">Governance and Compliance Requirements for OpCo<ins>,</ins><ins> its </ins><del>'s </del>Internal <ins>Employees</ins><ins>,</ins> and the OAT</a></h1>
                <ul>
                    <li>Internal full-time employees (not OAT members): these individuals are <ins>forbidden</ins><del>required to abstain</del> from <ins>participating in</ins> Arbitrum DAO governance <ins>votes</ins>.</li>
                    <li><del>OpCo votes that are directly related to</del><ins>OpCo in its capacity as a legal entity: the entity is prohibited from becoming a delegate</ins> and <ins>cannot assume token delegations</ins><del>its operations</del>.</li>
                </ul>
            </div>"#;

        let before = extract_before_content_inline(&content).unwrap();
        let after = extract_after_content_inline(&content).unwrap();

        // Test the before content
        assert!(before.contains("required to abstain"));
        assert!(before.contains("OpCo votes that are directly related to"));
        assert!(before.contains("its operations"));
        assert!(!before.contains("forbidden"));
        assert!(!before.contains("cannot assume token delegations"));

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
        let content = r#"<div class="inline-diff"><li>Team: Alex Lumley, Lumen of PowerHouse, Customer Stakeholder Representative Group and potentially a group of SPs who will leverage reporting &amp; information and Incorporate community stakeholders into workflows to enhance transparency and collaboration.</li>
        <li><strong class="diff-del">Cost:</strong class="diff-del"> <ins>a </ins><ins>maximum </ins><ins>of </ins><del>Up </del><del>to </del>$263,260 for the continuation of the reporting <ins>function </ins><ins>for </ins><ins>up </ins><ins>to </ins><ins>12 </ins><ins>months</ins><del>function</del>, 4 months of backpay, grants to incorporate the community and research areas such as information dissemination and how to incorporate other tools the community has built.</li>
        </div>"#;

        // Expected content before and after changes
        let expected_before = r#"<li>Team: Alex Lumley, Lumen of PowerHouse, Customer Stakeholder Representative Group and potentially a group of SPs who will leverage reporting &amp; information and Incorporate community stakeholders into workflows to enhance transparency and collaboration.</li><li><strong>Cost:</strong> Up to $263,260 for the continuation of the reporting function, 4 months of backpay, grants to incorporate the community and research areas such as information dissemination and how to incorporate other tools the community has built.</li>"#;

        let before = extract_before_content_inline(&content).unwrap();

        // Assert that the extracted content matches the expected content
        assert_eq!(before, expected_before);
    }

    #[test]
    fn test_opco_complex_team_and_cost_changes_after() {
        let content = r#"<div class="inline-diff"><li>Team: Alex Lumley, Lumen of PowerHouse, Customer Stakeholder Representative Group and potentially a group of SPs who will leverage reporting &amp; information and Incorporate community stakeholders into workflows to enhance transparency and collaboration.</li>
        <li><strong class="diff-del">Cost:</strong class="diff-del"> <ins>a </ins><ins>maximum </ins><ins>of </ins><del>Up </del><del>to </del>$263,260 for the continuation of the reporting <ins>function </ins><ins>for </ins><ins>up </ins><ins>to </ins><ins>12 </ins><ins>months</ins><del>function</del>, 4 months of backpay, grants to incorporate the community and research areas such as information dissemination and how to incorporate other tools the community has built.</li>
        </div>"#;

        let expected_after = r#"<li>Team: Alex Lumley, Lumen of PowerHouse, Customer Stakeholder Representative Group and potentially a group of SPs who will leverage reporting &amp; information and Incorporate community stakeholders into workflows to enhance transparency and collaboration.</li><li>Cost: a maximum of $263,260 for the continuation of the reporting function for up to 12 months, 4 months of backpay, grants to incorporate the community and research areas such as information dissemination and how to incorporate other tools the community has built.</li>"#;

        let after = extract_after_content_inline(&content).unwrap();
        // Assert that the extracted content matches the expected content
        assert_eq!(after, expected_after);
    }

    #[test]
    fn test_complex_proposal_with_tables_and_images() {
        let content = r#"<div class="inline-diff"><h1><a name="p-62786-tldr-1" class="anchor" href="\#p-62786-tldr-1"></a><strong>TLDR:</strong></h1><ul><li>Overview: The DAO has existed for 18 months, <a href="https://online.flippingbook.com/view/927107714/2/" rel="noopener nofollow ugc">total expenditures of 425M ARB</a> with 40+ initiatives that have passed Tally; and only in the last three months did we create a single list with the live initiatives. We can do better.</li><li>Still, reporting has had inconsistent processes, making it difficult to see all the initiatives, let alone determine relative performance.</li><li>This proposal enables the DAO to create a Reporting and Information function that will enable transparency and visibility into the status and performance of initiatives.</li><li>Critical Importance: Reporting and information management are a critical component of growing organizations as it enables them to learn and improve. As the DAO evolves, a reporting function is a critical way to improve and show investors it is more than just "the teenager with the trust fund".</li><li>This lack of a DAO-wide reporting function has led to issues for delegates and initiatives, reducing our speed of learning.</li><li>The problem is that while the Arbitrum DAO has made strides in data capture and reporting, gaps remain in transparency, documentation, and the distribution of data to stakeholders.</li><li>The work, Basic Reporting continuation [Stream]: the ongoing work required to maintain, document, and incrementally improve current data capture and reporting workflows.</li><li>Team: Alex Lumley, Lumen of PowerHouse, Customer Stakeholder Representative Group and potentially a group of SPs who will leverage reporting &amp; information and Incorporate community stakeholders into workflows to enhance transparency and collaboration.</li><li><strong class="diff-del">Cost:</strong class="diff-del"> <ins>a </ins><ins>maximum </ins><ins>of </ins><del>Up </del><del>to </del>$263,260 for the continuation of the reporting <ins>function </ins><ins>for </ins><ins>up </ins><ins>to </ins><ins>12 </ins><ins>months</ins><del>function</del>, 4 months of backpay, grants to incorporate the community and research areas such as information dissemination and how to incorporate other tools the community has built.</li></ul></div>"#;

        // Expected content before changes (without newlines and indentation)
        let expected_before = r#"<h1><a name="p-62786-tldr-1" class="anchor" href="\#p-62786-tldr-1"></a><strong>TLDR:</strong></h1><ul><li>Overview: The DAO has existed for 18 months, <a href="https://online.flippingbook.com/view/927107714/2/" rel="noopener nofollow ugc">total expenditures of 425M ARB</a> with 40+ initiatives that have passed Tally; and only in the last three months did we create a single list with the live initiatives. We can do better.</li><li>Still, reporting has had inconsistent processes, making it difficult to see all the initiatives, let alone determine relative performance.</li><li>This proposal enables the DAO to create a Reporting and Information function that will enable transparency and visibility into the status and performance of initiatives.</li><li>Critical Importance: Reporting and information management are a critical component of growing organizations as it enables them to learn and improve. As the DAO evolves, a reporting function is a critical way to improve and show investors it is more than just "the teenager with the trust fund".</li><li>This lack of a DAO-wide reporting function has led to issues for delegates and initiatives, reducing our speed of learning.</li><li>The problem is that while the Arbitrum DAO has made strides in data capture and reporting, gaps remain in transparency, documentation, and the distribution of data to stakeholders.</li><li>The work, Basic Reporting continuation [Stream]: the ongoing work required to maintain, document, and incrementally improve current data capture and reporting workflows.</li><li>Team: Alex Lumley, Lumen of PowerHouse, Customer Stakeholder Representative Group and potentially a group of SPs who will leverage reporting &amp; information and Incorporate community stakeholders into workflows to enhance transparency and collaboration.</li><li><strong>Cost:</strong> Up to $263,260 for the continuation of the reporting function, 4 months of backpay, grants to incorporate the community and research areas such as information dissemination and how to incorporate other tools the community has built.</li></ul>"#;

        // Expected content after changes (without newlines and indentation)
        let expected_after = r#"<h1><a name="p-62786-tldr-1" class="anchor" href="\#p-62786-tldr-1"></a><strong>TLDR:</strong></h1><ul><li>Overview: The DAO has existed for 18 months, <a href="https://online.flippingbook.com/view/927107714/2/" rel="noopener nofollow ugc">total expenditures of 425M ARB</a> with 40+ initiatives that have passed Tally; and only in the last three months did we create a single list with the live initiatives. We can do better.</li><li>Still, reporting has had inconsistent processes, making it difficult to see all the initiatives, let alone determine relative performance.</li><li>This proposal enables the DAO to create a Reporting and Information function that will enable transparency and visibility into the status and performance of initiatives.</li><li>Critical Importance: Reporting and information management are a critical component of growing organizations as it enables them to learn and improve. As the DAO evolves, a reporting function is a critical way to improve and show investors it is more than just "the teenager with the trust fund".</li><li>This lack of a DAO-wide reporting function has led to issues for delegates and initiatives, reducing our speed of learning.</li><li>The problem is that while the Arbitrum DAO has made strides in data capture and reporting, gaps remain in transparency, documentation, and the distribution of data to stakeholders.</li><li>The work, Basic Reporting continuation [Stream]: the ongoing work required to maintain, document, and incrementally improve current data capture and reporting workflows.</li><li>Team: Alex Lumley, Lumen of PowerHouse, Customer Stakeholder Representative Group and potentially a group of SPs who will leverage reporting &amp; information and Incorporate community stakeholders into workflows to enhance transparency and collaboration.</li><li>Cost: a maximum of $263,260 for the continuation of the reporting function for up to 12 months, 4 months of backpay, grants to incorporate the community and research areas such as information dissemination and how to incorporate other tools the community has built.</li></ul>"#;

        // Get the actual before and after content
        let before = extract_before_content_inline(&content).unwrap();
        let after = extract_after_content_inline(&content).unwrap();

        // Assert the full content matches
        assert_eq!(before.trim(), expected_before);
        assert_eq!(after.trim(), expected_after);

        // Additional assertions remain the same...
        assert!(before.contains("Up to $263,260"));
        assert!(before.contains("<strong>Cost:</strong>"));
        assert!(!after.contains("<strong>Cost:</strong>"));
        assert!(after.contains("Cost:"));
        assert!(after.contains("a maximum of $263,260"));
        assert!(after.contains("for up to 12 months"));
        assert!(!before.contains("for up to 12 months"));

        assert!(before.contains("<strong>TLDR:</strong>"));
        assert!(after.contains("<strong>TLDR:</strong>"));
        assert!(before.contains("total expenditures of 425M ARB"));
        assert!(after.contains("total expenditures of 425M ARB"));

        assert!(before.contains(r#"<a href="https://online.flippingbook.com/view/927107714/2/""#));
        assert!(after.contains(r#"<a href="https://online.flippingbook.com/view/927107714/2/""#));
        assert!(before.contains("&amp;"));
        assert!(after.contains("&amp;"));

        assert!(before.contains("<ul>"));
        assert!(before.contains("</ul>"));
        assert!(after.contains("<ul>"));
        assert!(after.contains("</ul>"));
    }

    #[test]
    fn test_multiple_classes() {
        let content = r#"<div class="inline-diff">
                <p class="anchor diff-del important">old text</p>
                <p class="highlight diff-ins main">new text</p>
                <span class="diff-del bold">removed</span>
                <span class="diff-ins italic">added</span>
            </div>"#;

        let expected_before = r#"<p>old text</p><span>removed</span>"#;
        let expected_after = r#"<p>new text</p><span>added</span>"#;

        let before = extract_before_content_inline(&content).unwrap();
        let after = extract_after_content_inline(&content).unwrap();

        assert_eq!(before, expected_before);
        assert_eq!(after, expected_after);
    }

    #[test]
    fn test_complex_multiple_classes() {
        let content = r#"<div class="inline-diff">
                <h1 class="anchor diff-del main">Old Title</h1>
                <h1 class="anchor diff-ins main">New Title</h1>
                <p class="text-lg diff-del highlight">Removed paragraph</p>
                <p class="text-lg diff-ins highlight">Added paragraph</p>
                <ul class="list-style diff-del numbered">
                    <li>Old item</li>
                </ul>
                <ul class="list-style diff-ins numbered">
                    <li>New item</li>
                </ul>
            </div>"#;

        let expected_before =
            r#"<h1>Old Title</h1><p>Removed paragraph</p><ul><li>Old item</li></ul>"#;
        let expected_after =
            r#"<h1>New Title</h1><p>Added paragraph</p><ul><li>New item</li></ul>"#;

        let before = extract_before_content_inline(&content).unwrap();
        let after = extract_after_content_inline(&content).unwrap();

        assert_eq!(before, expected_before);
        assert_eq!(after, expected_after);
    }

    #[test]
    fn test_title_div() {
        let content = r#"<div class="inline-diff"><div><del>[</del><del>PROPOSAL</del><del>]</del><del> </del><del>-</del><del> </del>Transaction Fee Distribution</div></div>"#;

        let expected_before = r#"[PROPOSAL] - Transaction Fee Distribution"#;
        let expected_after = r#"Transaction Fee Distribution"#;

        let before = extract_before_content_inline(&content).unwrap();
        let after = extract_after_content_inline(&content).unwrap();

        assert_eq!(before, expected_before);
        assert_eq!(after, expected_after);
    }
}
