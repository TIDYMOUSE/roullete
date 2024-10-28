use anchor_lang::error_code;

#[error_code]
pub enum RoulleteErrors {
    #[msg("Session is over")]
    SessionAlreadyOver, //6000
    #[msg("Session has started")]
    SessionAlreadyStarted, //6001
    #[msg("Some logic error!")]
    InternalGameError, //6002
}
