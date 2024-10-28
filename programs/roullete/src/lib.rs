use crate::session::*;
use anchor_lang::prelude::*;
use anchor_lang::solana_program::native_token::LAMPORTS_PER_SOL;
use anchor_lang::system_program;
use arrayref::array_ref;
use solana_program::sysvar;

pub mod errors;
pub mod events;
pub mod session;

declare_id!("7MsxXCMjGpb21eykEzP2hdZ1xGgWy3Kb2WQDP2z6RFD");

// TODO: session account does all transactions on its own

#[program]
pub mod roullete {

    use errors::RoulleteErrors;

    use super::*;
    pub fn join_session(
        ctx: Context<JoinSession>,
        player_one: Pubkey,
        player_two: Pubkey,
    ) -> Result<()> {
        require!(
            ctx.accounts.session.is_active(),
            RoulleteErrors::SessionAlreadyStarted
        );

        let data = &ctx.accounts.recent_slothashes.data.borrow();
        ctx.accounts
            .session
            .start_session(player_one, player_two, array_ref![data, 12, 8])?;

        let player_one_context = CpiContext::new(
            ctx.accounts.system_program.to_account_info(),
            system_program::Transfer {
                from: ctx.accounts.player_one.to_account_info().clone(),
                to: ctx.accounts.session.to_account_info().clone(),
            },
        );
        system_program::transfer(player_one_context, LAMPORTS_PER_SOL / 100)?; // 0.01 sol from player one

        let player_two_context = CpiContext::new(
            ctx.accounts.system_program.to_account_info(),
            system_program::Transfer {
                from: ctx.accounts.player_two.to_account_info().clone(),
                to: ctx.accounts.session.to_account_info().clone(),
            },
        );
        system_program::transfer(player_two_context, LAMPORTS_PER_SOL / 100)?; // 0.01 sol from player two

        Ok(())
    }

    pub fn shoot(ctx: Context<Shoot>, target: Pubkey) -> Result<()> {
        ctx.accounts.session.shoot(target)?;
        if !ctx.accounts.session.is_active() {
            match ctx.accounts.session.get_state().state {
                State::Active => {
                    return Err(RoulleteErrors::InternalGameError.into());
                }
                State::Won { winner } => {
                    if winner == *ctx.accounts.player_one.key {
                        ctx.accounts.session.sub_lamports(LAMPORTS_PER_SOL / 50)?;
                        ctx.accounts
                            .player_one
                            .add_lamports(LAMPORTS_PER_SOL / 50)?;
                    } else if winner == ctx.accounts.player_two.key() {
                        ctx.accounts.session.sub_lamports(LAMPORTS_PER_SOL / 50)?;
                        ctx.accounts
                            .player_two
                            .add_lamports(LAMPORTS_PER_SOL / 50)?;
                    } else {
                        return Err(RoulleteErrors::InternalGameError.into());
                    }
                }
            }
        }

        Ok(())
    }

    pub fn get_game_stamp(ctx: Context<GetGameStamp>) -> Result<session::GameStamp> {
        Ok(ctx.accounts.session.get_state())
    }
}

#[derive(Accounts)]
pub struct JoinSession<'info> {
    #[account(init_if_needed, payer=player_one, seeds=[player_one.key().as_ref(), player_two.key().as_ref(),b"session"], bump, space=Session::MAX_SIZE + 8)]
    pub session: Account<'info, Session>,
    #[account(mut)]
    pub player_one: Signer<'info>,
    #[account(mut)]
    pub player_two: Signer<'info>,
    pub system_program: Program<'info, System>,
    /// CHECK: account constraints checked in account trait
    #[account(address = sysvar::slot_hashes::id())]
    recent_slothashes: UncheckedAccount<'info>,
}

#[derive(Accounts)]
pub struct Shoot<'info> {
    #[account(mut, seeds=[player_one.key().as_ref(), player_two.key().as_ref(),b"session"], bump)]
    pub session: Account<'info, Session>,
    #[account(signer)]
    pub shooter: Signer<'info>,
    #[account(mut)]
    /// CHECK: account constraints checked in account trait
    pub player_one: AccountInfo<'info>,
    #[account(mut)]
    /// CHECK: account constraints checked in account trait
    pub player_two: AccountInfo<'info>,
}

#[derive(Accounts)]
pub struct GetGameStamp<'info> {
    #[account(mut, seeds=[player_one.key().as_ref(), player_two.key().as_ref(),b"session"], bump)]
    pub session: Account<'info, Session>,
    #[account(signer)]
    pub payer: Signer<'info>,
    /// CHECK: account constraints checked in account trait
    pub player_one: AccountInfo<'info>,
    /// CHECK: account constraints checked in account trait
    pub player_two: AccountInfo<'info>,
}
