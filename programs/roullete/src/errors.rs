use anchor_lang::error_code;

#[error_code]
pub enum RoulleteErrors {
    SessionAlreadyOver,    //6000
    SessionAlreadyStarted, //6001
    NotPlayersTurn,        //6002
}
