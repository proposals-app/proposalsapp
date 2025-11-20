#[cfg(test)]
mod tests {
    use crate::extensions::snapshot::SnapshotApi;
    use mockito::Server;

    #[tokio::test]
    async fn test_fetch_messages() {
        let mut server = Server::new_async().await;
        let url = server.url();
        let api = SnapshotApi::new_with_endpoint(url);

        let mock = server.mock("POST", "/")
            .with_status(200)
            .with_header("content-type", "application/json")
            .with_body(r#"
                {
                    "data": {
                        "messages": [
                            {
                                "id": "msg1",
                                "mci": 100,
                                "timestamp": 1234567890,
                                "space": "test.eth",
                                "type": "proposal"
                            }
                        ]
                    }
                }
            "#)
            .create_async().await;

        let messages = api.fetch_messages(&["test.eth".to_string()], 0, 10).await.unwrap();
        
        assert_eq!(messages.len(), 1);
        assert_eq!(messages[0].id, "msg1");
        assert_eq!(messages[0].mci, 100);
        
        mock.assert_async().await;
    }

    #[tokio::test]
    async fn test_fetch_proposals_by_ids() {
        let mut server = Server::new_async().await;
        let url = server.url();
        let api = SnapshotApi::new_with_endpoint(url);

        let mock = server.mock("POST", "/")
            .with_status(200)
            .with_header("content-type", "application/json")
            .with_body(r#"
                {
                    "data": {
                        "proposals": [
                            {
                                "id": "prop1",
                                "author": "0x123",
                                "title": "Test Proposal",
                                "body": "Test Body",
                                "discussion": "",
                                "choices": ["Yes", "No"],
                                "scores_state": "final",
                                "privacy": "any",
                                "created": 1234567890,
                                "start": 1234567890,
                                "end": 1234567890,
                                "quorum": 100.0,
                                "link": "https://snapshot.org",
                                "state": "closed",
                                "type": "single-choice",
                                "flagged": false,
                                "ipfs": "ipfs_hash",
                                "votes": 10,
                                "space": { "id": "test.eth" }
                            }
                        ]
                    }
                }
            "#)
            .create_async().await;

        let proposals = api.fetch_proposals_by_ids(&["prop1".to_string()]).await.unwrap();
        
        assert_eq!(proposals.len(), 1);
        assert_eq!(proposals[0].id, "prop1");
        assert_eq!(proposals[0].space.id, "test.eth");
        
        mock.assert_async().await;
    }

    #[tokio::test]
    async fn test_fetch_votes_by_ids() {
        let mut server = Server::new_async().await;
        let url = server.url();
        let api = SnapshotApi::new_with_endpoint(url);

        let mock = server.mock("POST", "/")
            .with_status(200)
            .with_header("content-type", "application/json")
            .with_body(r#"
                {
                    "data": {
                        "votes": [
                            {
                                "voter": "0xabc",
                                "reason": "",
                                "choice": 1,
                                "vp": 100.0,
                                "created": 1234567890,
                                "ipfs": "ipfs_hash",
                                "proposal": { "id": "prop1" },
                                "space": { "id": "test.eth" }
                            }
                        ]
                    }
                }
            "#)
            .create_async().await;

        let votes = api.fetch_votes_by_ids(&["vote1".to_string()]).await.unwrap();
        
        assert_eq!(votes.len(), 1);
        assert_eq!(votes[0].voter, "0xabc");
        assert_eq!(votes[0].space.id, "test.eth");
        
        mock.assert_async().await;
    }
}
