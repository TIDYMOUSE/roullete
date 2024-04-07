use crate::errors::RoulleteErrors;
use crate::session::*;
use anchor_lang::prelude::*;
use arrayref::array_ref;
use solana_program::sysvar;

pub mod errors;
pub mod events;
pub mod session;

declare_id!("GR7AVT5cwad3decrFzMKNz2tKnT5f3BALirQDegq63iZ");

#[program]
pub mod roullete {
    use super::*;

    pub fn start_session(ctx: Context<StartSession>, player_two: Pubkey) -> Result<()> {
        let data = &ctx.accounts.recent_slothashes.data.borrow();
        ctx.accounts.session.start_session(
            [ctx.accounts.player_one.key(), player_two],
            array_ref![data, 12, 8],
        )
    }

    pub fn shoot(ctx: Context<Shoot>, target: Pubkey) -> Result<()> {
        let session = &mut ctx.accounts.session;
        require_eq!(
            ctx.accounts.shooter.key(),
            session.current_player(),
            RoulleteErrors::NotPlayersTurn
        );
        session.shoot(target)
    }

    pub fn pass(ctx: Context<Pass>) -> Result<()> {
        ctx.accounts.session.pass()
    }
}

#[derive(Accounts)]
pub struct StartSession<'info> {
    #[account(init, payer=player_one, space= Session::MAX_SIZE + 8)]
    pub session: Box<Account<'info, Session>>,
    #[account(mut)]
    pub player_one: Signer<'info>,
    pub system_program: Program<'info, System>,
    /// CHECK: account constraints checked in account trait
    #[account(address = sysvar::slot_hashes::id())]
    recent_slothashes: UncheckedAccount<'info>,
}

#[derive(Accounts)]
pub struct Shoot<'info> {
    #[account(mut)]
    pub session: Box<Account<'info, Session>>,
    pub shooter: Signer<'info>,
}

#[derive(Accounts)]
pub struct Pass<'info> {
    #[account(mut)]
    pub session: Box<Account<'info, Session>>,
    pub passer: Signer<'info>,
}
