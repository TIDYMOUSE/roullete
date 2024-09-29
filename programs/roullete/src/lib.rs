use crate::session::*;
use anchor_lang::prelude::*;
use anchor_lang::solana_program::native_token::LAMPORTS_PER_SOL;
use anchor_lang::system_program;
use arrayref::array_ref;
use solana_program::sysvar;

pub mod errors;
pub mod events;
pub mod session;

declare_id!("mvtjnnwtwXKExeWAoMwemapbBxa2QUsr3TQfWHmMmzf");

// TODO: Paymaster  ( fund from both parties that cover cost of contract deployment and 6 round charges )
// i.e session account does all transactions on its own

#[program]
pub mod roullete {

    use super::*;
    // TODO: Get report of game after over

    pub fn join_session(ctx: Context<JoinSession>) -> Result<()> {
        let data = &ctx.accounts.recent_slothashes.data.borrow();
        // TODO: fix type out of index error for data[]
        ctx.accounts
            .session
            .join_session(ctx.accounts.player.key(), array_ref![data, 12, 8])?;

        let cpi_context = CpiContext::new(
            ctx.accounts.system_program.to_account_info(),
            system_program::Transfer {
                from: ctx.accounts.player.to_account_info().clone(),
                to: ctx.accounts.session.to_account_info().clone(),
            },
        );
        system_program::transfer(cpi_context, LAMPORTS_PER_SOL / 100)?; // 0.01 sol

        Ok(())
    }

    pub fn shoot(ctx: Context<Shoot>, target: Pubkey) -> Result<()> {
        ctx.accounts.session.shoot(target)?;
        if !ctx.accounts.session.is_active() {
            **ctx
                .accounts
                .session
                .to_account_info()
                .try_borrow_mut_lamports()? -= LAMPORTS_PER_SOL / 100;
            **ctx
                .accounts
                .shooter
                .to_account_info()
                .try_borrow_mut_lamports()? += LAMPORTS_PER_SOL / 100;
        }

        Ok(())
    }
}

#[derive(Accounts)]
pub struct JoinSession<'info> {
    #[account(init_if_needed, payer=player, seeds=[b"session"], bump, space=Session::MAX_SIZE + 8)]
    pub session: Account<'info, Session>,
    #[account(mut)]
    player: Signer<'info>,
    pub system_program: Program<'info, System>,
    /// CHECK: account constraints checked in account trait
    #[account(address = sysvar::slot_hashes::id())]
    recent_slothashes: UncheckedAccount<'info>,
}

#[derive(Accounts)]
pub struct Shoot<'info> {
    #[account(mut, seeds=[b"session"], bump)]
    pub session: Box<Account<'info, Session>>,
    #[account(mut)]
    pub shooter: Signer<'info>,
}
