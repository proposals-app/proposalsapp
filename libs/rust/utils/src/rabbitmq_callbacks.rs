use amqprs::{
    callbacks::{ChannelCallback, ConnectionCallback},
    channel::Channel,
    connection::Connection,
    error::Error,
    Ack, BasicProperties, Cancel, Close, CloseChannel, Nack, Return,
};
use async_trait::async_trait;

pub struct AppConnectionCallback;

pub type Result<T> = std::result::Result<T, Error>;

#[async_trait]
impl ConnectionCallback for AppConnectionCallback {
    async fn close(&mut self, _connection: &Connection, _close: Close) -> Result<()> {
        Ok(())
    }

    async fn blocked(&mut self, _connection: &Connection, _reason: String) {}

    async fn unblocked(&mut self, _connection: &Connection) {}
}

pub struct AppChannelCallback;

#[async_trait]
impl ChannelCallback for AppChannelCallback {
    async fn close(&mut self, _channel: &Channel, _close: CloseChannel) -> Result<()> {
        Ok(())
    }
    async fn cancel(&mut self, _channel: &Channel, _cancel: Cancel) -> Result<()> {
        Ok(())
    }
    async fn flow(&mut self, _channel: &Channel, _active: bool) -> Result<bool> {
        Ok(true)
    }
    async fn publish_ack(&mut self, _channel: &Channel, _ack: Ack) {}
    async fn publish_nack(&mut self, _channel: &Channel, _nack: Nack) {}
    async fn publish_return(
        &mut self,
        _channel: &Channel,
        _ret: Return,
        _basic_properties: BasicProperties,
        _content: Vec<u8>,
    ) {
    }
}
