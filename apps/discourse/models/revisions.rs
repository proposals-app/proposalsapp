use chrono::{DateTime, Utc};
use fancy_regex::Regex;
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
        Revision::extract_before_content(&self.inline).unwrap_or_default()
    }

    pub fn get_cooked_after(&self) -> String {
        Revision::extract_after_content(&self.inline).unwrap_or_default()
    }
}

impl Revision {
    pub fn get_cooked_markdown_before(&self) -> String {
        let content = self.body_changes.side_by_side_markdown.clone();
        Self::extract_before_content_markdown(&content).unwrap_or_default()
    }

    pub fn get_cooked_markdown_after(&self) -> String {
        let content = self.body_changes.side_by_side_markdown.clone();
        Self::extract_after_content_markdown(&content).unwrap_or_default()
    }
    pub fn get_cooked_before(&self) -> String {
        let content = self.body_changes.inline.clone();
        Self::extract_before_content(&content).unwrap_or_default()
    }

    pub fn get_cooked_after(&self) -> String {
        let content = self.body_changes.inline.clone();
        Self::extract_after_content(&content).unwrap_or_default()
    }

    fn cleanup_html(content: &str) -> String {
        // First normalize all whitespace/newlines to single spaces
        let mut result = content.replace('\n', " ").replace('\r', " ");

        // Remove spaces between tags
        let between_tags = Regex::new(r">\s+<").unwrap();
        result = between_tags.replace_all(&result, "><").to_string();

        // Remove extra spaces
        let multi_spaces = Regex::new(r"\s{2,}").unwrap();
        result = multi_spaces.replace_all(&result, " ").to_string();

        // Trim leading/trailing whitespace
        result.trim().to_string()
    }

    fn extract_before_content(content: &str) -> Result<String, fancy_regex::Error> {
        let mut result = content.to_string();

        // Rule 1 & 2: Remove outer inline-diff div
        let re_wrapper_div = Regex::new(r#"^<div class="inline-diff">|</div>$"#).unwrap();
        result = re_wrapper_div.replace_all(content, "").to_string();

        // Rule 7: Handle diff-del in both opening and closing tags (with multiple classes)
        let both_diff_del = Regex::new(
            r#"<([a-zA-Z0-9]+)\s+class="[^"]*diff-del[^"]*">([\s\S]*?)</\1\s+class="[^"]*diff-del[^"]*">"#,
        )?;
        result = both_diff_del
            .replace_all(&result, "<$1>$2</$1>")
            .to_string();

        // Rule 5: Handle diff-del class in opening tag (with multiple classes)
        let diff_del_pattern =
            Regex::new(r#"<([a-zA-Z0-9]+)\s+class="[^"]*diff-del[^"]*">([\s\S]*?)</\1>"#)?;
        result = diff_del_pattern
            .replace_all(&result, "<$1>$2</$1>")
            .to_string();

        // Rule 6: Remove diff-ins elements completely including their content (with multiple classes)
        let diff_ins_pattern =
            Regex::new(r#"<([a-zA-Z0-9]+)\s+class="[^"]*diff-ins[^"]*">[\s\S]*?</\1>"#)?;
        result = diff_ins_pattern.replace_all(&result, "").to_string();

        // Rule 3: Keep content inside <del> tags including whitespace
        let del_pattern = Regex::new(r#"<del>([\s\S]*?)</del>"#)?;
        result = del_pattern.replace_all(&result, "$1").to_string();

        // Rule 4: Remove content inside <ins> tags
        let ins_pattern = Regex::new(r#"<ins>[\s\S]*?</ins>"#)?;
        result = ins_pattern.replace_all(&result, "").to_string();

        // Clean up at the end
        Ok(Self::cleanup_html(&result))
    }

    fn extract_after_content(content: &str) -> Result<String, fancy_regex::Error> {
        let mut result = content.to_string();

        // Rule 1 & 2: Remove outer inline-diff div
        let re_wrapper_div = Regex::new(r#"^<div class="inline-diff">|</div>$"#).unwrap();
        result = re_wrapper_div.replace_all(content, "").to_string();

        // Rule 7: Handle diff-del in both opening and closing tags (with multiple classes)
        let both_diff_del = Regex::new(
            r#"<([a-zA-Z0-9]+)\s+class="[^"]*diff-del[^"]*">(.*?)</\1\s+class="[^"]*diff-del[^"]*">"#,
        )?;
        result = both_diff_del.replace_all(&result, "$2").to_string();

        // Rule 5: Remove diff-del elements completely including their content (with multiple classes)
        let diff_del_pattern =
            Regex::new(r#"<([a-zA-Z0-9]+)\s+class="[^"]*diff-del[^"]*">[\s\S]*?</\1>"#)?;
        result = diff_del_pattern.replace_all(&result, "").to_string();

        // Rule 6: Handle diff-ins class (with multiple classes)
        let diff_ins_pattern =
            Regex::new(r#"<([a-zA-Z0-9]+)\s+class="[^"]*diff-ins[^"]*">([\s\S]*?)</\1>"#)?;
        result = diff_ins_pattern
            .replace_all(&result, "<$1>$2</$1>")
            .to_string();

        // Rule 3: Remove content inside <del> tags
        let del_pattern = Regex::new(r#"<del>[\s\S]*?</del>"#)?;
        result = del_pattern.replace_all(&result, "").to_string();

        // Rule 4: Keep content inside <ins> tags including whitespace
        let ins_pattern = Regex::new(r#"<ins>([\s\S]*?)</ins>"#)?;
        result = ins_pattern.replace_all(&result, "$1").to_string();

        // Clean up at the end
        Ok(Self::cleanup_html(&result))
    }

    fn extract_before_content_markdown(content: &str) -> Result<String, fancy_regex::Error> {
        // Create regex patterns for matching table cells
        let table_pattern = Regex::new(r#"<table class="markdown">(.*?)</table>"#)?;
        let row_pattern = Regex::new(r#"<tr>(.*?)</tr>"#)?;
        let first_cell_pattern = Regex::new(r#"<td(?:\s+class="[^"]*")?>([^<]*)</td>"#)?;

        let mut result = String::new();

        // Extract table content
        if let Some(table_cap) = table_pattern.captures(content)? {
            if let Some(table_content) = table_cap.get(1) {
                // Process each row - handle the Result from find_iter
                for row_match in row_pattern.find_iter(table_content.as_str()) {
                    if let Ok(match_content) = row_match {
                        // Get the row content and process it
                        if let Some(cell_cap) =
                            first_cell_pattern.captures(match_content.as_str())?
                        {
                            if let Some(cell_content) = cell_cap.get(1) {
                                result.push_str(cell_content.as_str());
                            }
                        }
                    }
                }
            }
        }

        Ok(result)
    }

    fn extract_after_content_markdown(content: &str) -> Result<String, fancy_regex::Error> {
        // Create regex patterns for matching table cells
        let table_pattern = Regex::new(r#"<table class="markdown">(.*?)</table>"#)?;
        let row_pattern = Regex::new(r#"<tr>(.*?)</tr>"#)?;
        let second_cell_pattern =
            Regex::new(r#"<td(?:[^>]*?)>([^<]*)</td>(?:[^<]*)<td(?:[^>]*?)>([^<]*)</td>"#)?;

        let mut result = String::new();

        // Extract table content
        if let Some(table_cap) = table_pattern.captures(content)? {
            if let Some(table_content) = table_cap.get(1) {
                // Process each row - handle the Result from find_iter
                for row_match in row_pattern.find_iter(table_content.as_str()) {
                    if let Ok(match_content) = row_match {
                        // Get the row content and process it
                        if let Some(cell_cap) =
                            second_cell_pattern.captures(match_content.as_str())?
                        {
                            if let Some(cell_content) = cell_cap.get(2) {
                                result.push_str(cell_content.as_str());
                            }
                        }
                    }
                }
            }
        }

        Ok(result)
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

    fn create_markdown_revision(markdown_content: &str) -> Revision {
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
                inline: String::new(),
                side_by_side: String::new(),
                side_by_side_markdown: markdown_content.to_string(),
            },
            title_changes: None,
            can_edit: true,
        }
    }

    #[test]
    fn test_markdown_extraction_big() {
        let markdown_content = r#"<table class=\"markdown\"><tr><td># Non-Constitutional\n\n# Abstract\n\n</td><td># Non-Constitutional\n\n# Abstract\n\n</td></tr><tr><td class=\"diff-del\">This proposal builds on the ideas and concepts introduced by @<del>dk3 </del>in the initial [Operation Company (OpCo) proposal](https://forum.arbitrum.foundation/t/the-opco-scale-structure-synergy/22737). The OpCo is a legal entity that delegates and key stakeholders can leverage to achieve DAO-defined goals, principally by forming an operational mesh layer and assigning internal employees or negotiating and entering into agreements with service providers and individual contributors to facilitate <del>initiatives within a targeted selection of the DAO’s current focus categories</del>. OpCo’s mission is to negate identified frictions affecting the DAO’s strategy execution, such as allowing for the establishment of more operational roles for the DAO, facilitating efficient and competitive contributor and service provider negotiations and information flow between these parties, creating clear responsibilities for carrying out initiatives, and helping ensure the continuation of programs the DAO depends upon.\n\n</td><td class=\"diff-ins\">This proposal builds on the ideas and concepts introduced by <ins>[</ins>@<ins>dk3](https://forum.arbitrum.foundation/u/dk3) </ins>in the initial [Operation Company (OpCo) proposal](https://forum.arbitrum.foundation/t/the-opco-scale-structure-synergy/22737). The OpCo is a legal entity that delegates and key stakeholders can leverage to achieve DAO-defined goals, principally by forming an operational mesh layer and assigning internal employees or negotiating and entering into agreements with service providers and individual contributors to facilitate <ins>initiatives</ins>. OpCo’s mission is to negate identified frictions affecting the DAO’s strategy execution, such as allowing for the establishment of more operational roles for the DAO, facilitating efficient and competitive contributor and service provider negotiations and information flow between these parties, creating clear responsibilities for carrying out initiatives, and helping ensure the continuation of programs the DAO depends upon.<ins> OpCo is also required to be proactive, meaning that if the entity has the bandwidth and recognizes a potential advancement that could be made within its mandated focus areas, it can work on and propose a strategy through which the entity would address the identified frictions.</ins>\n\n</td></tr><tr><td>As it currently stands, the Arbitrum DAO is generally unable to move swiftly when it requires specialized contributors to execute a strategy, for which there isn’t a straightforward and low-friction approach, with these processes typically requiring a vast amount of effort from the supply side instead of being driven by the demand side. Moreover, many initiatives, especially more complex and wider-reaching ones, lack clear owners in charge of ensuring a holistic approach to execution and initiatives’ continuation, meaning that in the unfortunate case that a service provider decides/is forced to disengage from its duties, there aren’t always accountable individuals or entities that would push the initiatives forward. OpCo’s goal is to function as the entity the DAO can leverage to remedy these limitations and move forward in areas that require a more structured approach.\n\n</td><td>As it currently stands, the Arbitrum DAO is generally unable to move swiftly when it requires specialized contributors to execute a strategy, for which there isn’t a straightforward and low-friction approach, with these processes typically requiring a vast amount of effort from the supply side instead of being driven by the demand side. Moreover, many initiatives, especially more complex and wider-reaching ones, lack clear owners in charge of ensuring a holistic approach to execution and initiatives’ continuation, meaning that in the unfortunate case that a service provider decides/is forced to disengage from its duties, there aren’t always accountable individuals or entities that would push the initiatives forward. OpCo’s goal is to function as the entity the DAO can leverage to remedy these limitations and move forward in areas that require a more structured approach.\n\n</td></tr><tr><td class=\"diff-del\">To cover OpCo’s operating expenses over the first 30 months, including full-time staff appointed internally, setup and other admin costs, as well as the DAO-adjacent entity’s oversight committee, this proposal suggests earmarking <del>34M </del>ARB for the initiative:\n\n* <del>10M </del>ARB <del>released upfront</del>\n* <del>24M </del>ARB <del>vested over 24 months</del>. Once OpCo has officially <del>been established and </del>operationalized, <del>1M </del>ARB <del>will vest every 30 days</del>\n<del>\nThe 34M ARB includes </del>a <del>significant buffer and we do not anticipate that all ARB will be liquidated</del>.<del> Having said that</del>, <del>some capital might be converted into stablecoins </del>before <del>being put in a vesting contract to ensure that OpCo can operate in case of large market downturns</del>.\n<del>\nIf there is consensus among delegates,</del> <del>an additional 1M ARB bonus would be earmarked to OpCo’s oversight committee over its first two terms.</del> <del>We expect each term would be allocated 500K ARB,</del> <del>subject to </del>a <del>vesting schedule with a 24-month cliff following an oversight committee term’s end</del>. <del>A further explanation of </del>the <del>vesting structure as well as an in-depth breakdown of how the aforementioned figures have been derived are presented in the OpCo Financials and Costs section of this post</del>.\n\n</td><td class=\"diff-ins\">To cover OpCo’s operating expenses over the first 30 months, including full-time staff appointed internally, setup and other admin costs, as well as the DAO-adjacent entity’s oversight committee, this proposal suggests earmarking <ins>35M </ins>ARB for the initiative:\n\n* <ins>4M </ins>ARB <ins>allocated to a bonus pool for internal employees and OpCo’s oversight committee (3M reserved for internal employees and 1M reserved for the committee). These bonuses must be paid out in ARB and have a vesting structure attached, with internal employees’ payouts additionally being performance-based.</ins>\n* <ins>From the remaining 31M ARB, OpCo can draw up to $12M worth of </ins>ARB <ins>tokens through the following structure:\n  * $2</ins>.<ins>5M worth of ARB released upfront.\n</ins> <ins> * </ins>Once OpCo has officially operationalized, <ins>the entity can draw up to $500K worth of </ins>ARB <ins>each month.</ins>\n<ins>  * If </ins>a <ins>monthly drawdown exceeds $500K but is below $1</ins>.<ins>5M</ins>, <ins>the executive-equivalent employees must get approval from the OAT </ins>before <ins>accessing the funds</ins>.\n  <ins>*</ins> <ins>If </ins>a <ins>monthly drawdown exceeds $1</ins>.<ins>5M,</ins> <ins>OpCo must seek approval from </ins>the <ins>DAO through a Snapshot vote</ins>.\n\n</td></tr><tr><td># Motivation\n\n</td><td># Motivation\n\n</td></tr><tr><td class=\"diff-del\">Presently, most DAO programs operate in silos, leading to, among other things, redundant efforts and non-existing cross-initiative resources. The DAO also generally depends on a single initiative leader for the continuation of a successful program, while some initiatives don’t even have clear owners, which adds significant friction to strategy execution. DAOs are also inherently disadvantaged when evaluating and swiftly engaging individual contributors or service providers, and Arbitrum is no exception.<del>\n\n</del>This proposal aims to provide the DAO with the capabilities to nullify the abovementioned frictions by creating a DAO-adjacent legal entity—OpCo<del>—functioning as a facilitator for strategies formed through a decentralized system</del>.<del>\n\n</del>Among other things, the DAO may choose to leverage OpCo to manage:\n\n</td><td class=\"diff-ins\">Presently, most DAO programs operate in silos, leading to, among other things, redundant efforts and non-existing cross-initiative resources. The DAO also generally depends on a single initiative leader for the continuation of a successful program, while some initiatives don’t even have clear owners, which adds significant friction to strategy execution. DAOs are also inherently disadvantaged when evaluating and swiftly engaging individual contributors or service providers, and Arbitrum is no exception.<ins> </ins>This proposal aims to provide the DAO with the capabilities to nullify the abovementioned frictions by creating a DAO-adjacent legal entity—OpCo.<ins> </ins>Among other things, the DAO may choose to leverage OpCo to manage:\n\n</td></tr><tr><td>* Operational support &amp; project planning,\n* Project management of DAO initiatives,\n* Negotiations with service providers,\n* Allocation of resources across contributors &amp; DAO-approved projects.\n\nOpCo will grant the Arbitrum DAO better capabilities to bootstrap initiatives and secure the continuation and execution of them, while also expanding the total addressable contributor and service provider base as certain sensitive negotiations and deal terms don’t necessarily have to be disclosed publicly. Moreover, the DAO-adjacent entity will function as the operational mesh layer for individual contributors and service providers, streamlining communications and knowledge sharing across engaged entities and individuals.\n\nOverall, the DAO’s past, current, and likely upcoming initiatives can be divided into 5 high-level categories: Governance Frameworks, Financial Management, Investments, Ecosystem Support, and Grants. The initiatives, their respective owners, and into which of the 5 categories they fall are visualized below.\n\n![OpCo 1|690x388](upload://3jFYkLzj9h9zcLRlbzBk0kOmvpe.png)\n\n</td><td>* Operational support &amp; project planning,\n* Project management of DAO initiatives,\n* Negotiations with service providers,\n* Allocation of resources across contributors &amp; DAO-approved projects.\n\nOpCo will grant the Arbitrum DAO better capabilities to bootstrap initiatives and secure the continuation and execution of them, while also expanding the total addressable contributor and service provider base as certain sensitive negotiations and deal terms don’t necessarily have to be disclosed publicly. Moreover, the DAO-adjacent entity will function as the operational mesh layer for individual contributors and service providers, streamlining communications and knowledge sharing across engaged entities and individuals.\n\nOverall, the DAO’s past, current, and likely upcoming initiatives can be divided into 5 high-level categories: Governance Frameworks, Financial Management, Investments, Ecosystem Support, and Grants. The initiatives, their respective owners, and into which of the 5 categories they fall are visualized below.\n\n![OpCo 1|690x388](upload://3jFYkLzj9h9zcLRlbzBk0kOmvpe.png)\n\n</td></tr><tr><td class=\"diff-del\">It is of utmost importance that Arbitrum DAO maintains a decentralized and bottoms-up system for bootstrapping new projects, DAO contributors, and setting strategies, including creating and steering the DAO’s vision, mission, and purpose, as well as approaches to achieve the goals and decision-making. As such, <del>these areas </del>will <del>fall outside </del>of <del>the OpCo</del>’s <del>central mandate. Instead, it will </del>focus <del>on increasing </del>the efficiency of strategy execution through operational optimization and, in particular, activating and recruiting the optimal stakeholders, contributors, and service providers. For the avoidance of doubt, the DAO would always have ultimate authority over OpCo, with the entity purely being a helpful resource focused on streamlining wider-reaching and complex initiatives that require a more structured execution <del>framework</del>. We want to stress the importance of ensuring that one of Arbitrum DAO’s key differentiators—enabling new participants to join the ecosystem and make an impact, growing into well-established contributors—is conserved. <del>This has historically been facilitated through distributed and grassroots grants processes, which would also fall outside OpCo’s mandate. </del>Without Arbitrum DAO empowering its contributors and delegates, the DAO might sacrifice one of its core strengths, and we believe that entities such as SEEDGov, Entropy Advisors, Tally, etc., are present within the ecosystem exactly because of this empowerment.\n\nArbitrum has one of the most active and engaged DAOs within the industry, combined with help from the Arbitrum Foundation and robust programs for bootstrapping and fostering growth within the ecosystem. Although there is always room for improvement, these factors have enabled the DAO to allocate grants with positive results, sustaining a vibrant and welcoming ecosystem. When it comes to investments from treasury funds, the GCP has been established to facilitate capital allocation into the gaming sector, while the AVI is currently working on setting up a structure allowing the DAO to make venture bets across other verticals. As alluded to earlier, we also feel as though it’s crucial that the facilitation and implementation of governance frameworks continue being driven by decentralized actors, but <del>these </del>could <del>be overseen by OpCo (e</del>.<del>g., OpCo could be the entity enforcing the code of conduct).</del>\n\nWith that said, certain inefficiencies have been identified with respect to the Financial Management and Ecosystem Support categories. This is likely due to the operational frameworks enabling execution for these categories still being somewhat underexplored areas. As such, there is a lack of ownership, and the DAO has no structured way to frictionlessly operationalize contributors to push complex challenges forward within these verticals, often requiring a vast amount of Arbitrum DAO-specific knowledge and even lobbying efforts from the supply side instead of the demand side. Due to the current structure, active governance participants are generally purely incentivized to prioritize strategies that they are fit to solve. This has left certain critical domains unattended and reflects the need for an entity that could be mandated to help define the root causes of execution obstacles and provide solutions to remedy them.\n\n</td><td class=\"diff-ins\">It is of utmost importance that Arbitrum DAO maintains a decentralized and bottoms-up system for bootstrapping new projects, DAO contributors, and setting strategies, including creating and steering the DAO’s vision, mission, and purpose, as well as approaches to achieve the goals and decision-making. As such, <ins>OpCo </ins>will <ins>be focused on the Ecosystem Support and Financial Management initiative categories, but note that the mandate can be expanded into Grants and Governance Frameworks if the DAO so chooses through a Snapshot vote (simple majority with at least 3% </ins>of <ins>all votable tokens voting either “For” or “Abstain”).\n\nThe entity</ins>’s <ins>main </ins>focus <ins>is to increase </ins>the efficiency of strategy execution through operational optimization and, in particular, activating and recruiting the optimal stakeholders, contributors, and service providers. For the avoidance of doubt, the DAO would always have ultimate authority over OpCo, with the entity purely being a helpful resource focused on streamlining wider-reaching and complex initiatives that require a more structured execution <ins>framework as well as helping push the DAO forward within areas where the entity identifies shortcomings</ins>. We want to stress the importance of ensuring that one of Arbitrum DAO’s key differentiators—enabling new participants to join the ecosystem and make an impact, growing into well-established contributors—is conserved. Without Arbitrum DAO empowering its contributors and delegates, the DAO might sacrifice one of its core strengths, and we believe that entities such as SEEDGov, Entropy Advisors, Tally, etc., are present within the ecosystem exactly because of this empowerment.\n\nArbitrum has one of the most active and engaged DAOs within the industry, combined with help from the Arbitrum Foundation and robust programs for bootstrapping and fostering growth within the ecosystem. Although there is always room for improvement, these factors have enabled the DAO to allocate grants with positive results, sustaining a vibrant and welcoming ecosystem. <ins>Having said that, if the DAO wishes to, it can expand OpCo’s mandate to include grants in the future through a Snapshot vote. </ins>When it comes to investments from treasury funds, the GCP has been established to facilitate capital allocation into the gaming sector, while the AVI is currently working on setting up a structure allowing the DAO to make venture bets across other verticals<ins>, which is why OpCo will be excluded from operating within the investments category</ins>. As alluded to earlier, we also feel as though it’s crucial that the facilitation and implementation of governance frameworks continue being driven by decentralized actors, but <ins>the DAO </ins>could <ins>again expand OpCo’s operations into this initiative category if it so wishes</ins>.\n\nWith that said, certain <ins>clear </ins>inefficiencies have been identified with respect to the Financial Management and Ecosystem Support categories. This is likely due to the operational frameworks enabling execution for these categories still being somewhat underexplored areas. As such, there is a lack of ownership, and the DAO has no structured way to frictionlessly operationalize contributors to push complex challenges forward within these verticals, often requiring a vast amount of Arbitrum DAO-specific knowledge and even lobbying efforts from the supply side instead of the demand side. Due to the current structure, active governance participants are generally purely incentivized to prioritize strategies that they are fit to solve. This has left certain critical domains unattended and reflects the need for an entity that could be mandated to help define the root causes of execution obstacles and provide solutions to remedy them.\n\n</td></tr><tr><td>The aforementioned inefficiencies are naturally amplified by the fact that the number of potential contributors is often restricted due to many initiatives requiring deep specialization. Finding the facilitators capable of managing initiatives end-to-end within these categories can be difficult. Oftentimes, the contributor and owner roles for initiatives are separated or there is not a clear owner at all, meaning that no one party is responsible for the continuation of these initiatives. For initiatives where the contributor and owner roles are the same or there is a clearly defined owner, the DAO generally relies on a single party for the continuation of the initiative. If the service provider or contributor, for any reason, decides or is forced to exit the ecosystem, there is not a well-defined framework for the initiative to be moved to a new owner.\n\n</td><td>The aforementioned inefficiencies are naturally amplified by the fact that the number of potential contributors is often restricted due to many initiatives requiring deep specialization. Finding the facilitators capable of managing initiatives end-to-end within these categories can be difficult. Oftentimes, the contributor and owner roles for initiatives are separated or there is not a clear owner at all, meaning that no one party is responsible for the continuation of these initiatives. For initiatives where the contributor and owner roles are the same or there is a clearly defined owner, the DAO generally relies on a single party for the continuation of the initiative. If the service provider or contributor, for any reason, decides or is forced to exit the ecosystem, there is not a well-defined framework for the initiative to be moved to a new owner.\n\n</td></tr><tr><td class=\"diff-del\">OpCo’s <del>main </del>mandate <del>is </del>to enable the execution of DAO-defined strategies within the Financial Management and Ecosystem Support categories when requested by delegates. Typically, the current protocol for the execution of strategies and new initiatives within the DAO’s two aforementioned focus areas is as follows: (i) either the proposer defines the strategic approach and goals for the initiative or a working group is created that aims to outline these specifics such that a proposal can be created, with the working group also sometimes facilitating some or all of the work required for the execution of the strategy; (ii) if not done by the working group, the proposer or proposer-connected party is contracted to facilitate the strategy or the DAO runs some type of a procurement/election process to decide the service providers or contributors; (iii) once the work has been performed and the facilitators’ term ends, a continuation proposal is created if the initiative has a clear owner. Otherwise, individual DAO contributors are required to take charge of the initiative and push it forward.\n\nIf OpCo were to be created, it would primarily be leveraged to assume responsibility for phases (ii) and (iii). I.e., the DAO defines strategies or simply strategic goals. If a clear executor to reach the key objectives exists within the DAO, they could be chosen as a facilitator and would be contracted by the OpCo. If not, OpCo could be mandated to execute these strategies by either assigning existing internal employees, hiring new internal resources, or contracting outside service providers/individual contributors to perform the required undertakings. OpCo would have full discretion over hiring internal employees, while anyone interested in facilitating a DAO initiative could propose themselves (or another party) for that. Such a proposal must include a capital allocation to cover the facilitator’s expenses since OpCo’s budget only covers internal employees’ salaries. If approved through governance, the facilitator would then be contracted by OpCo as a service provider for the DAO. Depending on what is viewed as the most efficient approach, OpCo will have the ability to negotiate and run procurement processes both privately and publicly, which will further strengthen the Arbitrum DAO’s ability to attract and retain top talent, with all information that can be shared with the wider DAO being made available through oversight and financial reports.\n\n</td><td class=\"diff-ins\"><ins>As initiated, </ins>OpCo’s <ins>core </ins>mandate <ins>will be </ins>to enable the execution of DAO-defined strategies within the Financial Management and Ecosystem Support categories when requested by delegates. <ins>However, OpCo is also required to be proactive, meaning that if the entity has the bandwidth and recognizes an area within its focus categories where developments could be made, it can propose a strategy through which the entity would address the identified frictions.\n\n</ins>Typically, the current protocol for the execution of strategies and new initiatives within the DAO’s two aforementioned focus areas is as follows: (i) either the proposer defines the strategic approach and goals for the initiative or a working group is created that aims to outline these specifics such that a proposal can be created, with the working group also sometimes facilitating some or all of the work required for the execution of the strategy; (ii) if not done by the working group, the proposer or proposer-connected party is contracted to facilitate the strategy or the DAO runs some type of a procurement/election process to decide the service providers or contributors; (iii) once the work has been performed and the facilitators’ term ends, a continuation proposal is created if the initiative has a clear owner. Otherwise, individual DAO contributors are required to take charge of the initiative and push it forward.\n\nIf OpCo were to be created, it would primarily be leveraged to assume responsibility for phases (ii) and (iii). I.e., the DAO defines strategies or simply strategic goals. If a clear executor to reach the key objectives exists within the DAO, they could be chosen as a facilitator and would be contracted by the OpCo. If not, OpCo could be mandated to execute these strategies by either assigning existing internal employees, hiring new internal resources, or contracting outside service providers/individual contributors to perform the required undertakings. <ins>However, if the DAO isn’t proactively defining strategies/strategic goals, </ins>OpCo <ins>is required to be active within this area as well, given it has the bandwidth to do so, with these OpCo-created strategies then ratified by the DAO through the regular voting process.\n\nOpCo </ins>would have full discretion over hiring internal employees, while anyone interested in facilitating a DAO initiative could propose themselves (or another party) for that. Such a proposal must include a capital allocation to cover the facilitator’s expenses since OpCo’s budget only covers internal employees’ salaries. If approved through governance, the facilitator would then be contracted by OpCo as a service provider for the DAO. Depending on what is viewed as the most efficient approach, OpCo will have the ability to negotiate and run procurement processes both privately and publicly, which will further strengthen the Arbitrum DAO’s ability to attract and retain top talent, with all information that can be shared with the wider DAO being made available through oversight and financial reports.<ins> The below slide depicts OpCo’s initial focus categories, but please note that OpCo’s mandate can be expanded to include Governance Frameworks and Grants if the DAO so chooses.</ins>\n\n</td></tr><tr><td>![OpCo M|690x388](upload://vlfYjBig2cebCD7agRCcJL7N1Z3.png)\n\nIf a DAO-ratified strategy or strategic goal that the OpCo is mandated to facilitate doesn’t have a specific end date, the DAO-adjacent entity would continue executing until the entity feels as though the associated goals have been reached or the DAO instructs the entity to stop executing by passing a Snapshot vote (simple majority with at least 3% of all votable tokens voting either “For” or “Abstain”). If the work is expected to be long-term in nature, OpCo would be responsible for ensuring that it can be continued by accounting for associated costs in its budget extension request.\n\nFor example, delegates could define a high-level events strategy by deciding the number of events the Arbitrum DAO should be represented at in 2025, whether the strategy facilitator is the proposer, a proposer-related party, an OpCo internal employee, or someone who is chosen through a procurement process, and approving the strategy’s costs that are not covered by OpCo’s budget (i.e., salaries if the facilitators are not full-time staff appointed internally, booking event venues, catering, etc.) through the typical governance process, after which OpCo plans the exact events to participate in, contracts the required service providers or operationalizes internal employees, and manages all involved stakeholders and other related aspects throughout the process.\n\nService providers and individual contributors that are currently contracted, or will likely be in the near future, with the Arbitrum Foundation and fall within the Financial Management and Ecosystem Support categories, such as SEEDGov in its role as the Delegate Incentive Program Manager, MSS members, firms forming the ADPC, Entropy Advisors, etc., should collaborate closely with OpCo once its operations are fully established and stabilized. Once fully operational, OpCo will have the capacity to project manage and oversee these initiatives according to its complete mandate. The long-term vision for this process is as follows:\n\n1. OpCo’s core team is hired, and operations begin;\n2. OpCo demonstrates product-market fit (i.e., the DAO is satisfied with the entity’s output) and that it has adequate processes, capabilities, and any other relevant functions to execute according to its complete mandate;\n3. OpCo is prepared to oversee full-time DAO operations, assuming existing contributor contracts through novation and managing new initiatives on behalf of the DAO (e.g., by ensuring that appropriate KYC measures and documentation are implemented).\n\nIn the case that an integral facilitator within the Ecosystem Support and Financial Management categories exits the ecosystem for any reason and an initiative is left without an owner, the DAO could likewise mandate OpCo to find a replacement solution.\n\n</td><td>![OpCo M|690x388](upload://vlfYjBig2cebCD7agRCcJL7N1Z3.png)\n\nIf a DAO-ratified strategy or strategic goal that the OpCo is mandated to facilitate doesn’t have a specific end date, the DAO-adjacent entity would continue executing until the entity feels as though the associated goals have been reached or the DAO instructs the entity to stop executing by passing a Snapshot vote (simple majority with at least 3% of all votable tokens voting either “For” or “Abstain”). If the work is expected to be long-term in nature, OpCo would be responsible for ensuring that it can be continued by accounting for associated costs in its budget extension request.\n\nFor example, delegates could define a high-level events strategy by deciding the number of events the Arbitrum DAO should be represented at in 2025, whether the strategy facilitator is the proposer, a proposer-related party, an OpCo internal employee, or someone who is chosen through a procurement process, and approving the strategy’s costs that are not covered by OpCo’s budget (i.e., salaries if the facilitators are not full-time staff appointed internally, booking event venues, catering, etc.) through the typical governance process, after which OpCo plans the exact events to participate in, contracts the required service providers or operationalizes internal employees, and manages all involved stakeholders and other related aspects throughout the process.\n\nService providers and individual contributors that are currently contracted, or will likely be in the near future, with the Arbitrum Foundation and fall within the Financial Management and Ecosystem Support categories, such as SEEDGov in its role as the Delegate Incentive Program Manager, MSS members, firms forming the ADPC, Entropy Advisors, etc., should collaborate closely with OpCo once its operations are fully established and stabilized. Once fully operational, OpCo will have the capacity to project manage and oversee these initiatives according to its complete mandate. The long-term vision for this process is as follows:\n\n1. OpCo’s core team is hired, and operations begin;\n2. OpCo demonstrates product-market fit (i.e., the DAO is satisfied with the entity’s output) and that it has adequate processes, capabilities, and any other relevant functions to execute according to its complete mandate;\n3. OpCo is prepared to oversee full-time DAO operations, assuming existing contributor contracts through novation and managing new initiatives on behalf of the DAO (e.g., by ensuring that appropriate KYC measures and documentation are implemented).\n\nIn the case that an integral facilitator within the Ecosystem Support and Financial Management categories exits the ecosystem for any reason and an initiative is left without an owner, the DAO could likewise mandate OpCo to find a replacement solution.\n\n</td></tr><tr><td class=\"diff-del\">It’s important to note that OpCo will not have the authority to enter into contracts with service providers or individual contributors for strategies not approved by the DAO through governance. OpCo internal employees cannot be contributors to DAO initiatives as individuals (they need to do so through OpCo), whilst contractors that facilitate a specific vertical and are signed to OpCo can <del>be involved </del>in other DAO <del>initiatives</del>. Full-time OpCo staff can only be appointed internally. However, as mentioned earlier, the DAO can roll any service provider or individual contributor into OpCo by passing an onchain vote. This vote has to request for capital to cover the facilitators’ expenses since when it comes to salaries, OpCo’s budget only covers internal full-time staff. OpCo is expected to work closely with Offchain Labs as well as the Arbitrum Foundation to ensure that scopes of work do not overlap.\n\n</td><td class=\"diff-ins\">It’s important to note that OpCo will not have the authority to enter into contracts with service providers or individual contributors for strategies not approved by the DAO through governance. OpCo internal <ins>full-time </ins>employees cannot be contributors to DAO initiatives as individuals (they need to do so through OpCo)<ins> and are strictly prohibited from entering into employment engagements with other DAOs</ins>, <ins>organizations, entities, or comparable affiliations, </ins>whilst contractors that facilitate a specific vertical and are signed to OpCo can <ins>have engagements </ins>in other DAO <ins>initiatives and outside of the ecosystem</ins>. Full-time OpCo staff can only be appointed internally. However, as mentioned earlier, the DAO can roll any service provider or individual contributor into OpCo by passing an onchain vote. This vote has to request for capital to cover the facilitators’ expenses since when it comes to salaries, OpCo’s budget only covers internal full-time staff. OpCo is expected to work closely with Offchain Labs as well as the Arbitrum Foundation to ensure that scopes of work do not overlap.\n\n</td></tr><tr><td>Individual contributors, service providers, and other analogous entities are naturally free to go directly to the DAO to propose they facilitate a workstream and get paid for it without facilitation by the OpCo. However, if the proposed scope of work falls within OpCo’s mandate, it is expected that delegates vote against such a proposal if it can be better executed via OpCo’s involvement. Proposers will be encouraged to engage with OpCo before posting a proposal to the forum to align with the DAO-adjacent entity’s internal employees. OpCo’s internal employees will also proactively communicate with proposal authors and facilitators outside of OpCo such that there is no overlap between deliverables and the future plans for all initiatives are clear.\n\nFinally, it’s crucial to mention that the introduction of a DAO-adjacent legal entity carries risks and burdens that shouldn’t be ignored. Among other things, it requires some trust in a select group of facilitators as they are responsible for hiring and procuring the correct contributors as well as operationalizing and managing the DAO-adjacent entity, OpCo’s setup and fixed costs are quite notable, and some amount of administrative work is required that otherwise wouldn’t have arisen.\n\n# Specifications\n\n## OpCo Operational Process\n\nWe expect the general workflow for OpCo to be as follows:\n\n</td><td>Individual contributors, service providers, and other analogous entities are naturally free to go directly to the DAO to propose they facilitate a workstream and get paid for it without facilitation by the OpCo. However, if the proposed scope of work falls within OpCo’s mandate, it is expected that delegates vote against such a proposal if it can be better executed via OpCo’s involvement. Proposers will be encouraged to engage with OpCo before posting a proposal to the forum to align with the DAO-adjacent entity’s internal employees. OpCo’s internal employees will also proactively communicate with proposal authors and facilitators outside of OpCo such that there is no overlap between deliverables and the future plans for all initiatives are clear.\n\nFinally, it’s crucial to mention that the introduction of a DAO-adjacent legal entity carries risks and burdens that shouldn’t be ignored. Among other things, it requires some trust in a select group of facilitators as they are responsible for hiring and procuring the correct contributors as well as operationalizing and managing the DAO-adjacent entity, OpCo’s setup and fixed costs are quite notable, and some amount of administrative work is required that otherwise wouldn’t have arisen.\n\n# Specifications\n\n## OpCo Operational Process\n\nWe expect the general workflow for OpCo to be as follows:\n\n</td></tr><tr><td class=\"diff-del\">* A forum discussion is initiated, with the owner of that discussion having communicated with <del>the </del>OpCo and defined whether the covered subject falls within <del>the </del>OpCo’s mandate, i.e., the Financial Management or Ecosystem Support verticals.\n</td><td class=\"diff-ins\">* A forum discussion is initiated, with the owner of that discussion having communicated with OpCo and defined whether the covered subject falls within OpCo’s <ins>initial </ins>mandate, i.e., the Financial Management or Ecosystem Support verticals.\n</td></tr><tr><td>* For verticals that are included in OpCo’s mandate, a discussion could broadly take one of the following forms:\n</td><td>* For verticals that are included in OpCo’s mandate, a discussion could broadly take one of the following forms:\n</td></tr><tr><td class=\"diff-del\">  * <del>*</del>A new key objective is introduced, but the roadmap to achieve that objective is unclear<del>*</del>: Delegates have the option to create a Snapshot proposal to direct OpCo to produce an onchain proposal that defines the strategy to achieve the key objective(s), whether the entity would procure a facilitator or hire/operationalize an internal employee, as well as any funds needed to cover the strategy’s expenses, excluding OpCo’s internal employee costs. If approved, OpCo would begin facilitating the proposal created by itself.\n</td><td class=\"diff-ins\">  * A new key objective is introduced, but the roadmap to achieve that objective is unclear: Delegates have the option to create a Snapshot proposal to direct OpCo to produce an onchain proposal that defines the strategy to achieve the key objective(s), whether the entity would procure a facilitator or hire/operationalize an internal employee, as well as any funds needed to cover the strategy’s expenses, excluding OpCo’s internal employee costs. If approved, OpCo would begin facilitating the proposal created by itself.<ins> It’s important to note that OpCo, together with its oversight committee (OAT), is responsible for keeping the DAO informed about the entity&#39;s bandwidth. They’ll also provide updates on when current projects are expected to end. This ensures that if there is a sudden spike in new proposals, especially complex and more time-intensive ones, delegates can prioritize and vote on the ones OpCo can take on.</ins>\n</td></tr><tr><td>    * Example: The DAO wants to run an incentive program to expand the ecosystem, but the incentive program’s structure and size are unclear. A proposal is passed for OpCo to operationalize internal employees and create the exact strategy. OpCo then defines, e.g., the amount of incentives to be distributed, what the application process to receive incentives looks like, how success will be measured, etc. A proposal to ratify the strategy, the incentives to be distributed, and the required workforce is then created. If passed, OpCo will activate the needed facilitators (program manager, data team, etc.) and strategy execution begins.\n</td><td>    * Example: The DAO wants to run an incentive program to expand the ecosystem, but the incentive program’s structure and size are unclear. A proposal is passed for OpCo to operationalize internal employees and create the exact strategy. OpCo then defines, e.g., the amount of incentives to be distributed, what the application process to receive incentives looks like, how success will be measured, etc. A proposal to ratify the strategy, the incentives to be distributed, and the required workforce is then created. If passed, OpCo will activate the needed facilitators (program manager, data team, etc.) and strategy execution begins.\n</td></tr><tr><td class=\"diff-del\">  * <del>*</del>A new key objective is introduced and the roadmap to achieve that objective is clear<del>*</del>: Delegates approve an onchain proposal that defines the strategy, whether the facilitator is the proposer, proposer-related party, an internal OpCo employee, or someone the OpCo procures, and the related expenses excluding facilitator fees for internal OpCo employees, after which strategy execution begins.\n</td><td class=\"diff-ins\">  * A new key objective is introduced and the roadmap to achieve that objective is clear: Delegates approve an onchain proposal that defines the strategy, whether the facilitator is the proposer, proposer-related party, an internal OpCo employee, or someone the OpCo procures, and the related expenses excluding facilitator fees for internal OpCo employees, after which strategy execution begins.<ins> If a proposal introduces a new key objective with a clear roadmap but that roadmap is ambitious, the OAT together with OpCo should signal how feasible it is for the entity to execute the proposal. If it’s determined that such a roadmap is feasible, the OAT together with OpCo would also communicate whether or not the entity needs more internal resources to be able to execute.</ins>\n</td></tr><tr><td>    * Example: The DAO wants to run an incentive program to expand the ecosystem, and the structure and size are clear. An onchain proposal to ratify the strategy, the facilitators, and the capital needed is then created. If passed, the required facilitators (program manager, data team, etc.) are contracted by OpCo, or OpCo operationalizes/hires internal employees, depending on the DAO’s decision, and the strategy is activated.\n\n</td><td>    * Example: The DAO wants to run an incentive program to expand the ecosystem, and the structure and size are clear. An onchain proposal to ratify the strategy, the facilitators, and the capital needed is then created. If passed, the required facilitators (program manager, data team, etc.) are contracted by OpCo, or OpCo operationalizes/hires internal employees, depending on the DAO’s decision, and the strategy is activated.\n\n</td></tr><tr><td class=\"diff-del\"><del>It’s important to reiterate that proposals </del>and their execution can still be DAO-led end-to-end and outside of OpCo if delegates vote in this regard. OpCo is a tool for the DAO to leverage if needed. The DAO-adjacent entity is <del>also expected </del>to be proactive, meaning that internal employees <del>are encouraged </del>to actively give feedback in the forums and participate in opinionated discussions. Furthermore, if OpCo has <del>bandwidth and recognizes an area </del>within its mandated verticals <del>that isn’t currently addressed,</del> there is no clear owner for <del>that area, </del>and addressing <del>that area </del>would <del>be beneficial for </del>the DAO, OpCo can create a proposal <del>that defines </del>the strategy <del>to address </del>the targeted area, <del>allocates </del>funds to cover <del>expenses </del>excluding costs for OpCo<del>’</del>s internal <del>employees</del>, and <del>authorizes </del>the DAO-adjacent entity to operationalize facilitators to execute the strategy.\n\n</td><td class=\"diff-ins\"><ins>To reiterate:\n\n* Proposals </ins>and their execution can still be DAO-led end-to-end and outside of OpCo if delegates vote in this regard. OpCo is a tool for the DAO to leverage if needed.<ins>\n*</ins> The DAO-adjacent entity is <ins>required </ins>to be proactive, meaning that internal employees <ins>need </ins>to actively give feedback in the forums and participate in opinionated discussions.<ins>\n*</ins> Furthermore, if OpCo has <ins>available bandwidth, it should identify areas </ins>within its mandated verticals <ins>where improvements could be made.</ins> <ins>If </ins>there is no clear owner for <ins>such areas </ins>and addressing <ins>them </ins>would <ins>benefit </ins>the DAO, OpCo <ins>should take action. OpCo </ins>can create a proposal <ins>to define </ins>the strategy <ins>for addressing </ins>the targeted area, <ins>requesting </ins>funds to cover <ins>expenses, </ins>excluding costs for OpCo<ins>&#39;</ins>s internal <ins>employees and other related operating expenses</ins>, and <ins>authorizing </ins>the DAO-adjacent entity to operationalize facilitators to execute the strategy.\n\n</td></tr><tr><td>OpCo’s initial ARB allocation is meant to cover the entity’s setup costs and operating expenses, including full-time internal staff salaries, recurring administrative costs, and OpCo’s oversight committee. After OpCo’s core team has been hired, the entity has demonstrated product-market fit and readiness to execute according to its complete mandate, OpCo could be leveraged to help develop a DAO-wide budget, in which case the DAO-adjacent entity could hold the budgeted capital for at least the Ecosystem Support and Financial Management categories. In this case, when proposals related to these verticals are passed, no capital would have to be moved from the treasury as OpCo would be able to cover all expenses from its holdings.\n\n## Establishing OpCo\n\n</td><td>OpCo’s initial ARB allocation is meant to cover the entity’s setup costs and operating expenses, including full-time internal staff salaries, recurring administrative costs, and OpCo’s oversight committee. After OpCo’s core team has been hired, the entity has demonstrated product-market fit and readiness to execute according to its complete mandate, OpCo could be leveraged to help develop a DAO-wide budget, in which case the DAO-adjacent entity could hold the budgeted capital for at least the Ecosystem Support and Financial Management categories. In this case, when proposals related to these verticals are passed, no capital would have to be moved from the treasury as OpCo would be able to cover all expenses from its holdings.\n\n## Establishing OpCo\n\n</td></tr><tr><td class=\"diff-del\">Exploratory work on OpCo’s legal structure has already been initiated, but further effort and consultation with key stakeholders, delegates, and the Arbitrum Foundation are needed to hammer down the exact structure. Any costs incurred by the Foundation for setting up the legal structure would be reimbursed from capital allocated to this initiative if this proposal were to pass.\n\n</td><td class=\"diff-ins\">Exploratory work on OpCo’s legal structure has already been initiated, but further effort and consultation with key stakeholders, delegates, <ins>legal parties, </ins>and the Arbitrum Foundation are needed to hammer down the exact structure. Any costs incurred by the Foundation for setting up the legal structure would be reimbursed from capital allocated to this initiative if this proposal were to pass.\n\n</td></tr><tr><td>OpCo’s initial term will tentatively be 30 months (around 6 months for setup and 24 months for operations from the entity’s official initiation date). The initial term’s length has been chosen to allow ample time for any unforeseen delays in establishing the legal entity, ramping up and stabilizing its operations, and will enable OpCo to focus on more complex and long-term strategies and internalize top talent as a longer initial term provides predictability/job security for employees. Once the first term is coming to an end, the executive-equivalent internal personnel together with OpCo’s oversight committee—the Oversight and Transparency Committee (OAT), introduced below—are required to collaborate to create the continuation proposal for the DAO-adjacent entity. This is expected to cover, among other things, the second OpCo term’s length, the required budget, and any changes or improvements that should be made. It should be noted that if OpCo is required to internalize a vast amount of facilitator roles before a DAO-wide budget is put in place, OpCo might have to create a proposal that would allocate additional funds as its initial exemplary budget has been constructed to cover up to 12 internal full-time employees at different salaries.\n\nTo enable OpCo to successfully fulfill its mandate, the entity should, among other things, have the following initial operational capabilities, internal employees, and resources:\n\n* Internal Finances, Financial Rails, and Controls\n  * Appoint an external accounting and audit firm to maintain financial records and create yearly audits of financial statements and internal controls.\n  * Capital conversion capabilities to be able to liquidate ARB into stablecoins. We expect the groundwork for this solution to be facilitated by the Treasury Management Committee.\n  * Banking capabilities to be able to convert stablecoins into fiat currency and pay service providers not accepting tokens.\n* Legal\n  * Hire a full-time, in-house legal counsel.\n  * Obtain the required insurances that cover the DAO-adjacent entity as well as internal employees and the OAT.\n* Business-Critical Software\n  * Acquire any needed collaboration and communication tools, accounting and financial management software, human resources management systems, etc.\n* Internal Executive-Equivalent Employees\n  * Chief Chaos Coordinator\n    * Ensures that OpCo has the required internal resources, employees, and contracted service providers such that the DAO-adjacent entity can operate properly and execute strategies mandated by the DAO.\n</td><td>OpCo’s initial term will tentatively be 30 months (around 6 months for setup and 24 months for operations from the entity’s official initiation date). The initial term’s length has been chosen to allow ample time for any unforeseen delays in establishing the legal entity, ramping up and stabilizing its operations, and will enable OpCo to focus on more complex and long-term strategies and internalize top talent as a longer initial term provides predictability/job security for employees. Once the first term is coming to an end, the executive-equivalent internal personnel together with OpCo’s oversight committee—the Oversight and Transparency Committee (OAT), introduced below—are required to collaborate to create the continuation proposal for the DAO-adjacent entity. This is expected to cover, among other things, the second OpCo term’s length, the required budget, and any changes or improvements that should be made. It should be noted that if OpCo is required to internalize a vast amount of facilitator roles before a DAO-wide budget is put in place, OpCo might have to create a proposal that would allocate additional funds as its initial exemplary budget has been constructed to cover up to 12 internal full-time employees at different salaries.\n\nTo enable OpCo to successfully fulfill its mandate, the entity should, among other things, have the following initial operational capabilities, internal employees, and resources:\n\n* Internal Finances, Financial Rails, and Controls\n  * Appoint an external accounting and audit firm to maintain financial records and create yearly audits of financial statements and internal controls.\n  * Capital conversion capabilities to be able to liquidate ARB into stablecoins. We expect the groundwork for this solution to be facilitated by the Treasury Management Committee.\n  * Banking capabilities to be able to convert stablecoins into fiat currency and pay service providers not accepting tokens.\n* Legal\n  * Hire a full-time, in-house legal counsel.\n  * Obtain the required insurances that cover the DAO-adjacent entity as well as internal employees and the OAT.\n* Business-Critical Software\n  * Acquire any needed collaboration and communication tools, accounting and financial management software, human resources management systems, etc.\n* Internal Executive-Equivalent Employees\n  * Chief Chaos Coordinator\n    * Ensures that OpCo has the required internal resources, employees, and contracted service providers such that the DAO-adjacent entity can operate properly and execute strategies mandated by the DAO.\n</td></tr><tr><td class=\"diff-del\">    * Responsible for building and advancing the entity’s operational structure and managing workflows as initiatives are rolled into the organization and new focus areas <del>within the Ecosystem Support and Financial Management verticals </del>are introduced.\n</td><td class=\"diff-ins\">    * Responsible for building and advancing the entity’s operational structure and managing workflows as initiatives are rolled into the organization and new focus areas are introduced.\n</td></tr><tr><td>    * Similarly to other executive-equivalent personnel, accountable for adequate record keeping and internal controls.\n    * Collaborates with any other executive-equivalent personnel and the OAT to produce bi-annual oversight and financial reports.\n    * Together with executive-equivalent personnel and the OAT, in charge of creating the continuation proposal for OpCo’s next term.\n  * Chief of Coins\n    * Works with the relevant parties to produce a detailed, actual budget for OpCo, ratified by the OAT and the DAO. In the future, we expect the Chief of Coins to help facilitate a DAO-wide budget together with the relevant parties.\n    * Before a DAO-wide budget is created, responsible for requesting additional funds to ensure the entity’s operations if ARB allocated for OpCo’s OpEx is close to being depleted.\n    * Verifies that allocated funds are custodied in a secure manner and utilized as intended.\n    * Makes sure that the OAT and the DAO have required visibility into ongoing expenses, how financials are expected to develop, and any other relevant considerations.\n    * Monitors Arbitrum’s financial performance and makes new recommendations based on this information.\n    * Closely collaborates with entities and individuals responsible for treasury management-related tasks, enabling the creation of a unified asset allocation and risk diversification strategy in line with the DAO’s vision, mission, and purpose.\n    * Manages accounting, payroll, and payment infrastructure.\n\n## OpCo KPIs\n\n</td><td>    * Similarly to other executive-equivalent personnel, accountable for adequate record keeping and internal controls.\n    * Collaborates with any other executive-equivalent personnel and the OAT to produce bi-annual oversight and financial reports.\n    * Together with executive-equivalent personnel and the OAT, in charge of creating the continuation proposal for OpCo’s next term.\n  * Chief of Coins\n    * Works with the relevant parties to produce a detailed, actual budget for OpCo, ratified by the OAT and the DAO. In the future, we expect the Chief of Coins to help facilitate a DAO-wide budget together with the relevant parties.\n    * Before a DAO-wide budget is created, responsible for requesting additional funds to ensure the entity’s operations if ARB allocated for OpCo’s OpEx is close to being depleted.\n    * Verifies that allocated funds are custodied in a secure manner and utilized as intended.\n    * Makes sure that the OAT and the DAO have required visibility into ongoing expenses, how financials are expected to develop, and any other relevant considerations.\n    * Monitors Arbitrum’s financial performance and makes new recommendations based on this information.\n    * Closely collaborates with entities and individuals responsible for treasury management-related tasks, enabling the creation of a unified asset allocation and risk diversification strategy in line with the DAO’s vision, mission, and purpose.\n    * Manages accounting, payroll, and payment infrastructure.\n\n## OpCo KPIs\n\n</td></tr><tr><td class=\"diff-del\">We are looking for community feedback on this front, but some potential, apparent KPIs for OpCo (h/t @<del>dk3 </del>for most of these) include:\n\n</td><td class=\"diff-ins\">We are looking for community feedback on this front, but some potential, apparent KPIs for OpCo (h/t <ins>[</ins>@<ins>dk3](https://forum.arbitrum.foundation/u/dk3) </ins>for most of these) include:\n\n</td></tr><tr><td>* Talent Acquisition, Service Provider Selection, and Program Management\n  * Decrease in time-to-hire, compared to the DAO’s previous structure\n  * Employee engagement and satisfaction\n  * Retention rate\n  * Share of service providers meeting or exceeding performance metrics\n  * Cost savings or added value generated\n  * Diversity of service providers engaged\n* Ecosystem Coordination\n  * Time to solve open questions and other ambiguities\n  * Number of initiatives facilitated and their success\n  * Level of community engagement and stakeholder satisfaction\n  * Agility in adapting objectives\n  * Share of OpCo-initiated strategies accepted by the DAO\n* Performance Tracking and Transparency\n  * Timeliness of oversight and financial reports\n  * Share of data and metrics made publicly available\n  * Community engagement with reports\n\n</td><td>* Talent Acquisition, Service Provider Selection, and Program Management\n  * Decrease in time-to-hire, compared to the DAO’s previous structure\n  * Employee engagement and satisfaction\n  * Retention rate\n  * Share of service providers meeting or exceeding performance metrics\n  * Cost savings or added value generated\n  * Diversity of service providers engaged\n* Ecosystem Coordination\n  * Time to solve open questions and other ambiguities\n  * Number of initiatives facilitated and their success\n  * Level of community engagement and stakeholder satisfaction\n  * Agility in adapting objectives\n  * Share of OpCo-initiated strategies accepted by the DAO\n* Performance Tracking and Transparency\n  * Timeliness of oversight and financial reports\n  * Share of data and metrics made publicly available\n  * Community engagement with reports\n\n</td></tr><tr><td></td><td class=\"diff-ins\">Ultimately, the OAT will be responsible for designing, finalizing, and implementing the relevant KPIs once OpCo is at a point where this can be sufficiently done. We envision that this will be a collaborative effort between the OAT and the DAO, with KPIs reviewed and adjusted periodically based on how OpCo evolves and the community’s feedback.\n\n</td></tr><tr><td>## OpCo Accountability – The Oversight and Transparency Committee (OAT)\n\nThe OAT is a group of five individuals with the primary mandate to oversee OpCo’s operations, ensure the DAO maintains transparency into the DAO-adjacent entity, function as the coordinator between the DAO and OpCo, and establish clear communication channels with the other committees overseeing the separate DAO-adjacent entities such as the GCP and possibly the CapCo in the future should the DAO vote accordingly. More specifically, the OAT’s responsibilities include but are not limited to:\n\n</td><td>## OpCo Accountability – The Oversight and Transparency Committee (OAT)\n\nThe OAT is a group of five individuals with the primary mandate to oversee OpCo’s operations, ensure the DAO maintains transparency into the DAO-adjacent entity, function as the coordinator between the DAO and OpCo, and establish clear communication channels with the other committees overseeing the separate DAO-adjacent entities such as the GCP and possibly the CapCo in the future should the DAO vote accordingly. More specifically, the OAT’s responsibilities include but are not limited to:\n\n</td></tr><tr><td class=\"diff-del\">* Accountability: Ensures that OpCo is not overstepping its mandate, over-hiring doesn’t take place, and execution is constrained solely to strategies approved by the DAO. Holds the executive-equivalent personnel accountable, helps produce and approves bi-annual oversight and financial reports, gives other <del>relevant </del>updates to the community <del>when appropriate</del>, reviews all relevant internal materials, and monitors that funds held in OpCo-related wallets are used correctly.\n</td><td class=\"diff-ins\">* Accountability: Ensures that OpCo is not overstepping its mandate, over-hiring doesn’t take place, and execution is constrained solely to strategies approved by the DAO. Holds the executive-equivalent personnel accountable, helps produce and approves bi-annual oversight and financial reports, <ins>designs relevant KPIs for OpCo once the entity is at a point where this can be sufficiently done, and </ins>gives other <ins>quarterly </ins>updates to the community <ins>(such as how OpCo is progressing towards the KPIs designed by the OAT</ins>, <ins>any operational developments, etc.), </ins>reviews all relevant internal materials, and monitors that funds held in OpCo-related wallets are used correctly.\n</td></tr><tr><td>* Operational Support: Provides assistance in the entity’s legal setup process, gives guidance on OpCo’s operational development, assists the executive-equivalent personnel in producing a continuation proposal for OpCo, and continuously guides OpCo-related contributors to align with the DAO’s will.\n* Hiring, Termination, &amp; Authorization: The OAT, in collaboration with the Arbitrum Foundation, would hire the executive-equivalent personnel to the OpCo (the Chief Chaos Coordinator, the Chief of Coins, and any other positions of equivalent responsibility that may be introduced in the future) once the legal entity is established. The OAT will help onboard the executive-equivalent personnel and assist in the creation of a standardized onboarding process for future internal employees such that new hires’ expectations are managed properly. Once the first internal employees are hired, the OAT would act as the approving authority when OpCo enters into contracts with service providers or individual contributors, as well as greenlight salaries, larger spends, expenses, and budgets, having the authority to challenge decisions made within OpCo that may have a material, negative impact. Moreover, the OAT would be empowered to terminate service provider/individual contributor/etc. contracts as well as fire OpCo’s internal staff. If the OAT decides to take such an action, the concerned party will be suspended from their duties, and payments will be halted in accordance with applicable laws and regulations. Removal of OAT Members: OAT Members may be removed for a variety of reasons, including, but not limited to, a violation of a conflict of interest or other OpCo policies. In the event of a violation: (A) an OAT Member may call up an internal vote for removal with a memo detailing the alleged violation; (B) for a vote to remove an OAT Member to pass, it must have at least 4 out of the 5 OAT Members voting in favor; and (C) the ArbitrumDAO may also call for a vote to remove OAT Members at any time pursuant to a Temperature Check vote in accordance with the quorum and voting threshold requirements of a Temperature Check. The OpCo Team has the ability to call for a Temperature Check vote to remove an OAT Member as voted upon by the ArbitrumDAO. (i) The OpCo Team member may flag to another OpCo Team member that an election to remove an OAT Member via a Temperature Check vote is warranted; (ii) If such other OpCo Team member considers the request for removal to be warranted, then the OpCo Team member who originally made the flag may call for a removal election (subject to a 3 day feedback period, followed by a 7 day voting period) as a Temperature Check vote; (iii) In the event that a call to remove fails, the OpCo Team member who called for such Temperature Check vote cannot call another vote for removal for a period of 3 months. The process for electing a replacement for a removed OAT member will be equivalent to how the removed member was elected. I.e., if the removed member was elected through a DAO vote, the replacement member will be elected through a DAO vote. If the removed member was elected by the OAT, the OAT will elect the replacement member. A removed OAT member cannot be reappointed to the OAT. Further details on the OAT election process are given below.\n</td><td>* Operational Support: Provides assistance in the entity’s legal setup process, gives guidance on OpCo’s operational development, assists the executive-equivalent personnel in producing a continuation proposal for OpCo, and continuously guides OpCo-related contributors to align with the DAO’s will.\n* Hiring, Termination, &amp; Authorization: The OAT, in collaboration with the Arbitrum Foundation, would hire the executive-equivalent personnel to the OpCo (the Chief Chaos Coordinator, the Chief of Coins, and any other positions of equivalent responsibility that may be introduced in the future) once the legal entity is established. The OAT will help onboard the executive-equivalent personnel and assist in the creation of a standardized onboarding process for future internal employees such that new hires’ expectations are managed properly. Once the first internal employees are hired, the OAT would act as the approving authority when OpCo enters into contracts with service providers or individual contributors, as well as greenlight salaries, larger spends, expenses, and budgets, having the authority to challenge decisions made within OpCo that may have a material, negative impact. Moreover, the OAT would be empowered to terminate service provider/individual contributor/etc. contracts as well as fire OpCo’s internal staff. If the OAT decides to take such an action, the concerned party will be suspended from their duties, and payments will be halted in accordance with applicable laws and regulations. Removal of OAT Members: OAT Members may be removed for a variety of reasons, including, but not limited to, a violation of a conflict of interest or other OpCo policies. In the event of a violation: (A) an OAT Member may call up an internal vote for removal with a memo detailing the alleged violation; (B) for a vote to remove an OAT Member to pass, it must have at least 4 out of the 5 OAT Members voting in favor; and (C) the ArbitrumDAO may also call for a vote to remove OAT Members at any time pursuant to a Temperature Check vote in accordance with the quorum and voting threshold requirements of a Temperature Check. The OpCo Team has the ability to call for a Temperature Check vote to remove an OAT Member as voted upon by the ArbitrumDAO. (i) The OpCo Team member may flag to another OpCo Team member that an election to remove an OAT Member via a Temperature Check vote is warranted; (ii) If such other OpCo Team member considers the request for removal to be warranted, then the OpCo Team member who originally made the flag may call for a removal election (subject to a 3 day feedback period, followed by a 7 day voting period) as a Temperature Check vote; (iii) In the event that a call to remove fails, the OpCo Team member who called for such Temperature Check vote cannot call another vote for removal for a period of 3 months. The process for electing a replacement for a removed OAT member will be equivalent to how the removed member was elected. I.e., if the removed member was elected through a DAO vote, the replacement member will be elected through a DAO vote. If the removed member was elected by the OAT, the OAT will elect the replacement member. A removed OAT member cannot be reappointed to the OAT. Further details on the OAT election process are given below.\n</td></tr><tr><td class=\"diff-del\">* Coordination: Actively engage with Offchain Labs and the Arbitrum Foundation to align on deliverables and serve as the liaison between delegates, key stakeholders, the wider DAO, and other DAO-adjacent entities’ oversight committees. The OAT will also initiate <del>an </del>OpCo oversight call for community members to get updates on the most recent developments and for them to have the opportunity to make inquiries. A separate forum section will be created for OpCo.\n\n</td><td class=\"diff-ins\">* Coordination: Actively engage with Offchain Labs and the Arbitrum Foundation to align on deliverables and serve as the liaison between delegates, key stakeholders, the wider DAO, and other DAO-adjacent entities’ oversight committees. The OAT will also initiate <ins>a monthly </ins>OpCo oversight call for community members to get updates on the most recent developments and for them to have the opportunity to make inquiries. A separate forum section will be created for OpCo.\n\n</td></tr><tr><td>## OAT Election Process\n\nIf this proposal were to pass Snapshot, the formation of the Oversight and Transparency Committee would commence. The DAO would elect 3 individuals to the OAT, with these individuals then promptly appointing 2 additional members with specialized skill sets to ensure all Arbitrum stakeholders’ interests are represented and the OAT’s proficiencies are varied and complete. Additionally, the Arbitrum Foundation will be given an observing and non-voting sixth seat on the OAT similar to the GCP. OAT members are expected to be able to contribute at least 10 hours per week to OAT-related tasks.\n\nOAT applicants are required to apply as individuals to increase accountability. Applicants are required to disclose any current or possible future conflicts of interest in their applications, including but not limited to financial, personal, and professional. Applicants are also required to disclose all active contributor roles and payment streams related to the Arbitrum DAO that they, and entities that they have a professional or financial relationship with, have and are receiving. The application process for the 3 DAO-elected members would be initiated soon after the OpCo proposal passes an offchain vote and would run for ~3 weeks. Note that the application period can be extended if the size of the applicant pool is limited. A shutterized, weighted voting system will be utilized on Snapshot, and the 3 applicants with the most votes will be chosen as members of the OAT. The DAO-elected members should then prioritize appointing 2 additional members (required to be individuals as well). The 2 additional members don’t have to be appointed at the same time. The additional members will be added to the OAT optimistically, with the DAO having the ability to reject either/both of the additional members through a Snapshot vote (simple majority with at least 3% of all votable tokens voting either “For” or “Abstain”). All members will serve until the end of the first OAT term unless removed or they resign.\n\n</td><td>## OAT Election Process\n\nIf this proposal were to pass Snapshot, the formation of the Oversight and Transparency Committee would commence. The DAO would elect 3 individuals to the OAT, with these individuals then promptly appointing 2 additional members with specialized skill sets to ensure all Arbitrum stakeholders’ interests are represented and the OAT’s proficiencies are varied and complete. Additionally, the Arbitrum Foundation will be given an observing and non-voting sixth seat on the OAT similar to the GCP. OAT members are expected to be able to contribute at least 10 hours per week to OAT-related tasks.\n\nOAT applicants are required to apply as individuals to increase accountability. Applicants are required to disclose any current or possible future conflicts of interest in their applications, including but not limited to financial, personal, and professional. Applicants are also required to disclose all active contributor roles and payment streams related to the Arbitrum DAO that they, and entities that they have a professional or financial relationship with, have and are receiving. The application process for the 3 DAO-elected members would be initiated soon after the OpCo proposal passes an offchain vote and would run for ~3 weeks. Note that the application period can be extended if the size of the applicant pool is limited. A shutterized, weighted voting system will be utilized on Snapshot, and the 3 applicants with the most votes will be chosen as members of the OAT. The DAO-elected members should then prioritize appointing 2 additional members (required to be individuals as well). The 2 additional members don’t have to be appointed at the same time. The additional members will be added to the OAT optimistically, with the DAO having the ability to reject either/both of the additional members through a Snapshot vote (simple majority with at least 3% of all votable tokens voting either “For” or “Abstain”). All members will serve until the end of the first OAT term unless removed or they resign.\n\n</td></tr><tr><td class=\"diff-del\">While the same internal OpCo employees as well as contracted service providers and individual contributors will continue in their roles across OpCo’s terms if the DAO-adjacent entity is extended in the future, the OAT’s term is 12 months, with a re-election process initiated when the OAT’s term has around 3 months left. The DAO would again choose 3 members who then appoint 2 additional members. If the new cohort is different from the previous one, the previous OAT members are expected to help onboard the new members when the term is coming to an end. There are no consecutive term limits for OAT members. As the OAT is mandated to assist in OpCo’s setup process, the first OAT term will be slightly longer than subsequent ones since it will include the period from when the initial OAT members are selected to the establishment of the entity, plus 12 months from the entity<del>&#39;</del>s official start date.\n\n</td><td class=\"diff-ins\">While the same internal OpCo employees as well as contracted service providers and individual contributors will continue in their roles across OpCo’s terms if the DAO-adjacent entity is extended in the future, the OAT’s term is 12 months, with a re-election process initiated when the OAT’s term has around 3 months left. The DAO would again choose 3 members who then appoint 2 additional members. If the new cohort is different from the previous one, the previous OAT members are expected to help onboard the new members when the term is coming to an end. There are no consecutive term limits for OAT members. As the OAT is mandated to assist in OpCo’s setup process, the first OAT term will be slightly longer than subsequent ones since it will include the period from when the initial OAT members are selected to the establishment of the entity, plus 12 months from the entity<ins>’</ins>s official start date.\n\n</td></tr><tr><td>Any individual may apply to the OAT. However, all appointed individuals that have a non-observing seat, as well as any companies with which these appointees maintain a professional or financial relationship, are required to relinquish any and all contributor roles within the Arbitrum DAO that were obtained through an official election or ratification process conducted via Snapshot or Tally. As long as an individual has a non-obseving seat on the OAT, they and their affiliates as defined above are prohibited from becoming an internal employee for OpCo, entering into service provider contracts with the entity, and applying to a contributor role related to the Arbitrum DAO that requires an official election or ratification process through Snapshot or Tally. Due to legal constraints, an OAT member and their affiliates as defined above cannot be members of another initiative’s or DAO-adjacent entity’s oversight committee. If an appointed individual or their affiliate as defined above sits on another oversight committee(s), they are required to resign from any such position(s) to be able to join the OAT.\n\n## OAT Applicant Requirements\n\nApplicants must be individuals, not entities, and should possess familiarity with the Arbitrum DAO, governance processes, multisig operations, and a strong industry reputation. Additionally, candidates should demonstrate substantial experience and expertise in one or more of the following fields:\n\n1. Corporate Finance &amp; Financial Management\n   * Treasury Management\n   * Finance / Accounting / Budgeting\n\n2. Operations &amp; Strategy\n   * (DAO) Operations / Business Development / Growth / Strategy\n   * Procurement / HR / People\n   * Crypto Law / Compliance\n\nWhen applying to become an OAT member, applicants should specify the primary domain(s) from the list above in which they have the most experience and describe the nature of that experience. More details about candidates’ desired skill sets and professional experience, as well as an application template, will be posted by Entropy Advisors once the Snapshot to signal approval/disapproval of OpCo is underway and if the vote passes.\n\n## OAT Compensation Structure\n\n</td><td>Any individual may apply to the OAT. However, all appointed individuals that have a non-observing seat, as well as any companies with which these appointees maintain a professional or financial relationship, are required to relinquish any and all contributor roles within the Arbitrum DAO that were obtained through an official election or ratification process conducted via Snapshot or Tally. As long as an individual has a non-obseving seat on the OAT, they and their affiliates as defined above are prohibited from becoming an internal employee for OpCo, entering into service provider contracts with the entity, and applying to a contributor role related to the Arbitrum DAO that requires an official election or ratification process through Snapshot or Tally. Due to legal constraints, an OAT member and their affiliates as defined above cannot be members of another initiative’s or DAO-adjacent entity’s oversight committee. If an appointed individual or their affiliate as defined above sits on another oversight committee(s), they are required to resign from any such position(s) to be able to join the OAT.\n\n## OAT Applicant Requirements\n\nApplicants must be individuals, not entities, and should possess familiarity with the Arbitrum DAO, governance processes, multisig operations, and a strong industry reputation. Additionally, candidates should demonstrate substantial experience and expertise in one or more of the following fields:\n\n1. Corporate Finance &amp; Financial Management\n   * Treasury Management\n   * Finance / Accounting / Budgeting\n\n2. Operations &amp; Strategy\n   * (DAO) Operations / Business Development / Growth / Strategy\n   * Procurement / HR / People\n   * Crypto Law / Compliance\n\nWhen applying to become an OAT member, applicants should specify the primary domain(s) from the list above in which they have the most experience and describe the nature of that experience. More details about candidates’ desired skill sets and professional experience, as well as an application template, will be posted by Entropy Advisors once the Snapshot to signal approval/disapproval of OpCo is underway and if the vote passes.\n\n## OAT Compensation Structure\n\n</td></tr><tr><td class=\"diff-del\">OAT members must be properly compensated, highly incentivized to commit their full attention to the outlined responsibilities, and aligned with Arbitrum DAO’s long-term success. OAT members’ base monthly payment is $5K. <del>We believe an </del>additional <del>ARB-denominated, </del>vesting bonus payment <del>should </del>be allocated to OAT members <del>to ensure long-term alignment and fair compensation. Subject to community feedback on this forum post, a bonus of 1M ARB designated for OAT members </del>(excluding the Arbitrum Foundation in its role as an observer) <del>will be included in the Snapshot vote for OpCo</del>. At the end of the first OAT term, 50% of this ARB would be sent to a vesting contract that would release the funds after a 24-month cliff following the first OAT term’s end. Each individual who is an active member when the OAT term ends and was appointed as part of the dedicated election process <del>would </del>be allocated an equal share of the funds (100K ARB). If an OAT member steps down or is removed, they become ineligible for the bonus, in which case that ARB would be allocated pro rata to the replacing member. For example, if the initial OAT term’s length is 14 months and a replacement member is appointed with 7 months remaining in the initial term, they would be eligible to receive a bonus of 50K ARB subject to the same vesting terms as outlined above. The other 500K ARB <del>would </del>be allocated in a similar manner as described above for the second OAT term.\n\n</td><td class=\"diff-ins\">OAT members must be properly compensated, highly incentivized to commit their full attention to the outlined responsibilities, and aligned with Arbitrum DAO’s long-term success. OAT members’ base monthly payment is $<ins>7.</ins>5K. <ins>An </ins>additional <ins>1M ARB </ins>vesting bonus payment <ins>will </ins>be allocated to OAT members (excluding the Arbitrum Foundation in its role as an observer) <ins>to ensure long-term alignment and fair compensation</ins>. At the end of the first OAT term, 50% of this ARB would be sent to a vesting contract that would release the funds after a 24-month cliff following the first OAT term’s end. Each individual who is an active member when the OAT term ends and was appointed as part of the dedicated election process <ins>will </ins>be allocated an equal share of the funds (100K ARB). If an OAT member steps down or is removed, they become ineligible for the bonus, in which case that ARB would be allocated pro rata to the replacing member. For example, if the initial OAT term’s length is 14 months and a replacement member is appointed with 7 months remaining in the initial term, they would be eligible to receive a bonus of 50K ARB subject to the same vesting terms as outlined above. The other 500K ARB <ins>will </ins>be allocated in a similar manner as described above for the second OAT term.\n\n</td></tr><tr><td>## Governance and Compliance Requirements for OpCo’s Internal Employees and the OAT\n\nThe non-exhaustive list of governance and compliance obligations for OpCo’s internal employees and OAT members comprises:\n\n* Bound to be aligned with the community values listed in The Amended Constitution of the Arbitrum DAO, be committed to prioritizing the Arbitrum DAO’s needs, and act in absolute good faith and utmost honesty to fulfill their duties to the best of their abilities.\n* Required to maintain a public record of all actual and potential conflicts of interest.\n* Have to go through a KYC process and enter into an Agreement with the OpCo legal entity. The Agreement will cover, including but not limited to, appointment, conflict of interest, mandate, confidentiality, record-keeping, duty of impartiality, recusal, self-dealing prohibition, and ethical trading standards.\n* Required to sign any relevant non-disclosure agreements with respect to confidential information they might gain access to as part of their duties.\n</td><td>## Governance and Compliance Requirements for OpCo’s Internal Employees and the OAT\n\nThe non-exhaustive list of governance and compliance obligations for OpCo’s internal employees and OAT members comprises:\n\n* Bound to be aligned with the community values listed in The Amended Constitution of the Arbitrum DAO, be committed to prioritizing the Arbitrum DAO’s needs, and act in absolute good faith and utmost honesty to fulfill their duties to the best of their abilities.\n* Required to maintain a public record of all actual and potential conflicts of interest.\n* Have to go through a KYC process and enter into an Agreement with the OpCo legal entity. The Agreement will cover, including but not limited to, appointment, conflict of interest, mandate, confidentiality, record-keeping, duty of impartiality, recusal, self-dealing prohibition, and ethical trading standards.\n* Required to sign any relevant non-disclosure agreements with respect to confidential information they might gain access to as part of their duties.\n</td></tr><tr><td class=\"diff-del\">* Bound to follow the Code of Conduct for delegates if the DAO votes to ratify it.\n\n</td><td class=\"diff-ins\">* Bound to follow the Code of Conduct for delegates if the DAO votes to ratify it.\n<ins>* Internal full-time employees (not OAT members): these individuals, as well as any companies and analogous entities with which these individuals maintain a professional or financial relationship, are required to abstain from Arbitrum DAO governance votes that are directly related to OpCo and its operations.</ins>\n<ins>\n</ins></td></tr><tr><td>## OpCo Financials and Costs\n\n</td><td>## OpCo Financials and Costs\n\n</td></tr><tr><td class=\"diff-del\">OpCo’s budget is intended to fund its initial 30-month term, with funds covering the entity’s legal setup, any outsourced professional services <del>that are </del>required for operations such as legal counsel and accounting/auditing services, other incurred operating expenses such as business-critical software and insurance, internal full-time employee salaries, and the OAT’s salaries.\n\nThis proposal would earmark 35M ARB <del>(34M if the DAO doesn’t support the 1M bonus allocated </del>to <del>the OAT) to </del>cover OpCo’s initial term, with an <del>**</del>exemplary budget <del>breakdown** </del>shown below. <del>**</del>This is not an official budget, meaning that capital may be budgeted and allocated differently once the entity is stood up<del>**</del>. For example, Employee #4 doesn’t have to be hired at a yearly salary of ~$130K. The exemplary budget’s purpose is instead to showcase that the <del>35/34M </del>ARB figure isn’t arbitrary, and how the figure has been derived.\n\nIt’s also important to note that several line items, such as entity setup and legal services are notably larger than what the actual expenses are expected to be. This was done to account for any unforeseen events or worst-case scenarios which could require notable capital commitments. Moreover, several buffers have been applied to the <del>35/34M </del>ARB figure to account for the risk of a decreasing ARB price, with the purpose of securing OpCo’s continuous operations even if notable market downturns materialize.\n\n</td><td class=\"diff-ins\">OpCo’s budget is intended to fund its initial 30-month term, with funds covering the entity’s legal setup, any outsourced professional services required for operations such as legal counsel and accounting/auditing services, other incurred operating expenses such as business-critical software and insurance, internal full-time employee salaries, and the OAT’s salaries.\n\nThis proposal would earmark 35M ARB to cover OpCo’s initial term, with an exemplary budget <ins>breakdown </ins>shown below. This is not an official budget, meaning that capital may be budgeted and allocated differently once the entity is stood up. For example, Employee #4 doesn’t have to be hired at a yearly salary of ~$130K. The exemplary budget’s purpose is instead to showcase that the <ins>35M </ins>ARB figure isn’t arbitrary, and how the figure has been derived.\n\nIt’s also important to note that several line items, such as entity setup and legal services are notably larger than what the actual expenses are expected to be. This was done to account for any unforeseen events or worst-case scenarios which could require notable capital commitments. Moreover, several buffers have been applied to the <ins>35M </ins>ARB figure to account for the risk of a decreasing ARB price, with the purpose of securing OpCo’s continuous operations even if notable market downturns materialize.\n\n</td></tr><tr><td>![Screenshot 2024-10-30 at 13.07.04|690x413](upload://Af5nfKxrUh69Dz4VbksH2Ngd9wR.png)\n\n</td><td>![Screenshot 2024-10-30 at 13.07.04|690x413](upload://Af5nfKxrUh69Dz4VbksH2Ngd9wR.png)\n\n</td></tr><tr><td class=\"diff-del\">Funds will be transferred to an Arbitrum Foundation-controlled address and <del>10M </del>ARB will be <del>liquid </del>immediately. Once OpCo’s legal setup and related aspects are finalized, <del>24M </del>ARB will <del>begin vesting </del>to <del>an </del>OpCo<del>-connected multisig(s)</del>, <del>with 1M ARB vested every 30 days over 24 months</del>. <del>Some of the </del>ARB <del>connected to </del>the <del>vesting structure might be converted into stablecoins before </del>being <del>put </del>in <del>a vesting contract </del>to <del>ensure </del>that <del>OpCo can operate in case of large market downturns</del>.<del> </del>The Chief of Coins, together with relevant parties, will be responsible for maintaining an adequate runway for covering USD-denominated expenses while accounting for market volatility, as well as establishing a low-risk management strategy for idle capital to enhance the impact of the allocated funds.\n\nThe DAO will have the capability to clawback OpCo’s funding <del>and the OAT’s bonus payment, if allocated, </del>at any time. Defunding OpCo entirely by the DAO requires a forum post outlining the rationale behind the request for change, allowing for a reasonable time for discussion, and a subsequent Temperature Check vote (simple majority with at least 3% of all votable tokens voting either “For” or “Abstain”). If a Snapshot vote to defund OpCo is passed, payments will immediately be halted and all earmarked funds returned to the DAO Treasury, with OpCo ceasing operations.\n\n</td><td class=\"diff-ins\">Funds will be transferred to an Arbitrum Foundation-controlled address and <ins>$2.5M worth of </ins>ARB will be <ins>liquidated </ins>immediately<ins>, with 4M ARB allocated to a bonus pool for internal employees and OpCo’s oversight committee</ins>. <ins>Again, these bonuses must be paid out in ARB and have a vesting structure attached, with internal employees’ payouts additionally being performance-based. </ins>Once OpCo’s legal setup and related aspects are finalized, <ins>the entity can draw up to $500K worth of </ins>ARB <ins>each month. If a monthly drawdown exceeds $500K but is below $1.5M, the executive-equivalent employees must get approval from the OAT before accessing the funds. If a monthly drawdown exceeds $1.5M, OpCo must seek approval from the DAO through a Snapshot vote. Residual ARB (as well as capital in other denominations) </ins>will <ins>be sent back </ins>to <ins>the DAO treasury at the end of </ins>OpCo<ins>’s first term if the initiative isn’t renewed. Otherwise</ins>, <ins>the budget will be rolled over</ins>. ARB <ins>associated with this initiative, held by OpCo or </ins>the <ins>Arbitrum Foundation, is prohibited from </ins>being <ins>used </ins>in <ins>governance and must be delegated </ins>to <ins>the Exclude Address wherever practicable such </ins>that <ins>these funds don’t count towards the quorum</ins>.<ins>\n\n</ins>The Chief of Coins, together with relevant parties, will be responsible for maintaining an adequate runway for covering USD-denominated expenses while accounting for market volatility, as well as establishing a low-risk management strategy for idle capital to enhance the impact of the allocated funds.\n\nThe DAO will have the capability to clawback OpCo’s funding at any time. Defunding OpCo entirely by the DAO requires a forum post outlining the rationale behind the request for change, allowing for a reasonable time for discussion, and a subsequent Temperature Check vote (simple majority with at least 3% of all votable tokens voting either “For” or “Abstain”). If a Snapshot vote to defund OpCo is passed, payments will immediately be halted and all earmarked funds returned to the DAO Treasury, with OpCo ceasing operations.\n\n</td></tr><tr><td># Snapshot Voting Structure\n\nThe Snapshot vote will utilize Basic Voting:\n\n* FOR: Establish OpCo and initiate the application process for the 3 DAO-elected OAT members.\n* AGAINST: Do not establish OpCo.\n* ABSTAIN\n\n# Timeline\n\n1. ~21 days: OpCo forum period requesting comments and time to edit the proposal with delegate/broader community suggestions.\n2. 7 days: Snapshot to signal approval/disapproval of OpCo.\n3. ~21 days: Application period for the 3 DAO-elected OAT members. Entropy Advisors will handle application template creation and will be ready to post directly after the above Snapshot is complete. It is worth noting that if at least 3 suitably qualified individuals do not apply within the ~3 weeks, this application period may be extended. These are critical contributors to the DAO’s operations, and the process of finding the right candidates should not be rushed.\n4. 7 days: Snapshot to elect the 3 OAT members. Once chosen, the 3 members will KYC with the Foundation, sign any required NDAs, and begin searching for the 2 additional members, who will also go through a similar KYC process and sign the required NDAs (all OAT members will sign a contract with OpCo once the legal entity is finalized). After all OAT members are KYCd and the required NDAs have been signed, they will begin the recruitment process for the Chief Chaos Coordinator and Chief of Coins.\n5. 21 days: Tally proposal to fund OpCo. Capital will be sent to an Arbitrum Foundation-controlled address.\n6. TBD: When the legal entity is finalized and the required internal employees have been contracted, OpCo will begin operationalizing and executing according to its mandate.</td><td># Snapshot Voting Structure\n\nThe Snapshot vote will utilize Basic Voting:\n\n* FOR: Establish OpCo and initiate the application process for the 3 DAO-elected OAT members.\n* AGAINST: Do not establish OpCo.\n* ABSTAIN\n\n# Timeline\n\n1. ~21 days: OpCo forum period requesting comments and time to edit the proposal with delegate/broader community suggestions.\n2. 7 days: Snapshot to signal approval/disapproval of OpCo.\n3. ~21 days: Application period for the 3 DAO-elected OAT members. Entropy Advisors will handle application template creation and will be ready to post directly after the above Snapshot is complete. It is worth noting that if at least 3 suitably qualified individuals do not apply within the ~3 weeks, this application period may be extended. These are critical contributors to the DAO’s operations, and the process of finding the right candidates should not be rushed.\n4. 7 days: Snapshot to elect the 3 OAT members. Once chosen, the 3 members will KYC with the Foundation, sign any required NDAs, and begin searching for the 2 additional members, who will also go through a similar KYC process and sign the required NDAs (all OAT members will sign a contract with OpCo once the legal entity is finalized). After all OAT members are KYCd and the required NDAs have been signed, they will begin the recruitment process for the Chief Chaos Coordinator and Chief of Coins.\n5. 21 days: Tally proposal to fund OpCo. Capital will be sent to an Arbitrum Foundation-controlled address.\n6. TBD: When the legal entity is finalized and the required internal employees have been contracted, OpCo will begin operationalizing and executing according to its mandate.</td></tr></table>"#;

        let revision = create_markdown_revision(markdown_content);

        assert_eq!(
            revision.get_cooked_markdown_before().trim(),
            "- Why should people use this category? What is it for?\\n\\n- How exactly is this different than the other categories we already have?\\n\\n- What should topics in this category generally contain?\\n\\n- Do we need this category? Can we merge with another category, or subcategory?\\n\\n"
        );
        assert_eq!(
            revision.get_cooked_markdown_after().trim(),
            "- Why should people use this category? What is it for?\\n\\n- How exactly is this different than the other categories we already have?\\n\\n- What should topics in this category generally contain?\\n\\n- Do we need this category? Can we merge with another category, or subcategory?\\n\\n"
        );
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
    fn test_empty_del() {
        let revision = create_basic_revision(
            r#"<div class="inline-diff"><del>
            </del><ins>new text</ins></div>"#,
        );
        assert_eq!(revision.get_cooked_before(), r#""#);
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
        let expected_before = r#"<li>Team: Alex Lumley, Lumen of PowerHouse, Customer Stakeholder Representative Group and potentially a group of SPs who will leverage reporting &amp; information and Incorporate community stakeholders into workflows to enhance transparency and collaboration.</li><li><strong>Cost:</strong> Up to $263,260 for the continuation of the reporting function, 4 months of backpay, grants to incorporate the community and research areas such as information dissemination and how to incorporate other tools the community has built.</li>"#;

        // Assert that the extracted content matches the expected content
        assert_eq!(revision.get_cooked_before().trim(), expected_before);
    }

    #[test]
    fn test_opco_complex_team_and_cost_changes_after() {
        let inline_content = r#"<div class="inline-diff"><li>Team: Alex Lumley, Lumen of PowerHouse, Customer Stakeholder Representative Group and potentially a group of SPs who will leverage reporting &amp; information and Incorporate community stakeholders into workflows to enhance transparency and collaboration.</li>
        <li><strong class="diff-del">Cost:</strong class="diff-del"> <ins>a </ins><ins>maximum </ins><ins>of </ins><del>Up </del><del>to </del>$263,260 for the continuation of the reporting <ins>function </ins><ins>for </ins><ins>up </ins><ins>to </ins><ins>12 </ins><ins>months</ins><del>function</del>, 4 months of backpay, grants to incorporate the community and research areas such as information dissemination and how to incorporate other tools the community has built.</li>
        </div>"#;

        let revision = create_basic_revision(inline_content);

        let expected_after = r#"<li>Team: Alex Lumley, Lumen of PowerHouse, Customer Stakeholder Representative Group and potentially a group of SPs who will leverage reporting &amp; information and Incorporate community stakeholders into workflows to enhance transparency and collaboration.</li><li>Cost: a maximum of $263,260 for the continuation of the reporting function for up to 12 months, 4 months of backpay, grants to incorporate the community and research areas such as information dissemination and how to incorporate other tools the community has built.</li>"#;

        // Assert that the extracted content matches the expected content
        assert_eq!(revision.get_cooked_after().trim(), expected_after);
    }

    #[test]
    fn test_complex_proposal_with_tables_and_images() {
        let inline_content = r#"<div class="inline-diff"><h1><a name="p-62786-tldr-1" class="anchor" href="\#p-62786-tldr-1"></a><strong>TLDR:</strong></h1><ul><li>Overview: The DAO has existed for 18 months, <a href="https://online.flippingbook.com/view/927107714/2/" rel="noopener nofollow ugc">total expenditures of 425M ARB</a> with 40+ initiatives that have passed Tally; and only in the last three months did we create a single list with the live initiatives. We can do better.</li><li>Still, reporting has had inconsistent processes, making it difficult to see all the initiatives, let alone determine relative performance.</li><li>This proposal enables the DAO to create a Reporting and Information function that will enable transparency and visibility into the status and performance of initiatives.</li><li>Critical Importance: Reporting and information management are a critical component of growing organizations as it enables them to learn and improve. As the DAO evolves, a reporting function is a critical way to improve and show investors it is more than just "the teenager with the trust fund".</li><li>This lack of a DAO-wide reporting function has led to issues for delegates and initiatives, reducing our speed of learning.</li><li>The problem is that while the Arbitrum DAO has made strides in data capture and reporting, gaps remain in transparency, documentation, and the distribution of data to stakeholders.</li><li>The work, Basic Reporting continuation [Stream]: the ongoing work required to maintain, document, and incrementally improve current data capture and reporting workflows.</li><li>Team: Alex Lumley, Lumen of PowerHouse, Customer Stakeholder Representative Group and potentially a group of SPs who will leverage reporting &amp; information and Incorporate community stakeholders into workflows to enhance transparency and collaboration.</li><li><strong class="diff-del">Cost:</strong class="diff-del"> <ins>a </ins><ins>maximum </ins><ins>of </ins><del>Up </del><del>to </del>$263,260 for the continuation of the reporting <ins>function </ins><ins>for </ins><ins>up </ins><ins>to </ins><ins>12 </ins><ins>months</ins><del>function</del>, 4 months of backpay, grants to incorporate the community and research areas such as information dissemination and how to incorporate other tools the community has built.</li></ul></div>"#;

        let revision = create_basic_revision(inline_content);

        // Expected content before changes (without newlines and indentation)
        let expected_before = r#"<h1><a name="p-62786-tldr-1" class="anchor" href="\#p-62786-tldr-1"></a><strong>TLDR:</strong></h1><ul><li>Overview: The DAO has existed for 18 months, <a href="https://online.flippingbook.com/view/927107714/2/" rel="noopener nofollow ugc">total expenditures of 425M ARB</a> with 40+ initiatives that have passed Tally; and only in the last three months did we create a single list with the live initiatives. We can do better.</li><li>Still, reporting has had inconsistent processes, making it difficult to see all the initiatives, let alone determine relative performance.</li><li>This proposal enables the DAO to create a Reporting and Information function that will enable transparency and visibility into the status and performance of initiatives.</li><li>Critical Importance: Reporting and information management are a critical component of growing organizations as it enables them to learn and improve. As the DAO evolves, a reporting function is a critical way to improve and show investors it is more than just "the teenager with the trust fund".</li><li>This lack of a DAO-wide reporting function has led to issues for delegates and initiatives, reducing our speed of learning.</li><li>The problem is that while the Arbitrum DAO has made strides in data capture and reporting, gaps remain in transparency, documentation, and the distribution of data to stakeholders.</li><li>The work, Basic Reporting continuation [Stream]: the ongoing work required to maintain, document, and incrementally improve current data capture and reporting workflows.</li><li>Team: Alex Lumley, Lumen of PowerHouse, Customer Stakeholder Representative Group and potentially a group of SPs who will leverage reporting &amp; information and Incorporate community stakeholders into workflows to enhance transparency and collaboration.</li><li><strong>Cost:</strong> Up to $263,260 for the continuation of the reporting function, 4 months of backpay, grants to incorporate the community and research areas such as information dissemination and how to incorporate other tools the community has built.</li></ul>"#;

        // Expected content after changes (without newlines and indentation)
        let expected_after = r#"<h1><a name="p-62786-tldr-1" class="anchor" href="\#p-62786-tldr-1"></a><strong>TLDR:</strong></h1><ul><li>Overview: The DAO has existed for 18 months, <a href="https://online.flippingbook.com/view/927107714/2/" rel="noopener nofollow ugc">total expenditures of 425M ARB</a> with 40+ initiatives that have passed Tally; and only in the last three months did we create a single list with the live initiatives. We can do better.</li><li>Still, reporting has had inconsistent processes, making it difficult to see all the initiatives, let alone determine relative performance.</li><li>This proposal enables the DAO to create a Reporting and Information function that will enable transparency and visibility into the status and performance of initiatives.</li><li>Critical Importance: Reporting and information management are a critical component of growing organizations as it enables them to learn and improve. As the DAO evolves, a reporting function is a critical way to improve and show investors it is more than just "the teenager with the trust fund".</li><li>This lack of a DAO-wide reporting function has led to issues for delegates and initiatives, reducing our speed of learning.</li><li>The problem is that while the Arbitrum DAO has made strides in data capture and reporting, gaps remain in transparency, documentation, and the distribution of data to stakeholders.</li><li>The work, Basic Reporting continuation [Stream]: the ongoing work required to maintain, document, and incrementally improve current data capture and reporting workflows.</li><li>Team: Alex Lumley, Lumen of PowerHouse, Customer Stakeholder Representative Group and potentially a group of SPs who will leverage reporting &amp; information and Incorporate community stakeholders into workflows to enhance transparency and collaboration.</li><li>Cost: a maximum of $263,260 for the continuation of the reporting function for up to 12 months, 4 months of backpay, grants to incorporate the community and research areas such as information dissemination and how to incorporate other tools the community has built.</li></ul>"#;

        // Get the actual before and after content
        let before = revision.get_cooked_before();
        let after = revision.get_cooked_after();

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
        let revision = create_basic_revision(
            r#"<div class="inline-diff">
                <p class="anchor diff-del important">old text</p>
                <p class="highlight diff-ins main">new text</p>
                <span class="diff-del bold">removed</span>
                <span class="diff-ins italic">added</span>
            </div>"#,
        );

        let expected_before = r#"<p>old text</p><span>removed</span>"#;
        let expected_after = r#"<p>new text</p><span>added</span>"#;

        assert_eq!(revision.get_cooked_before().trim(), expected_before);
        assert_eq!(revision.get_cooked_after().trim(), expected_after);
    }

    #[test]
    fn test_complex_multiple_classes() {
        let revision = create_basic_revision(
            r#"<div class="inline-diff">
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
            </div>"#,
        );

        let expected_before =
            r#"<h1>Old Title</h1><p>Removed paragraph</p><ul><li>Old item</li></ul>"#;
        let expected_after =
            r#"<h1>New Title</h1><p>Added paragraph</p><ul><li>New item</li></ul>"#;

        assert_eq!(revision.get_cooked_before().trim(), expected_before);
        assert_eq!(revision.get_cooked_after().trim(), expected_after);
    }
}
