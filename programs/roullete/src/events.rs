use anchor_lang::prelude::*;


#[event]
pub struct MementoMori {
    pub shooter: Pubkey,
    pub target : Pubkey,
    pub winner: Pubkey
}

