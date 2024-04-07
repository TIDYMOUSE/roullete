use crate::errors::RoulleteErrors;
use crate::events::*;
use anchor_lang::prelude::*;

#[account]
pub struct Session {
    players: [Pubkey; 2], // 32 * 2
    turn: u8,             // 1
    load: [bool; 6],      // 1 * 6
    trigger: u8,          //1
    state: State,         // 32 + 1
}

impl Session {
    pub const MAX_SIZE: usize = (32 * 2) + 1 + (1 * 6) + 1 + (32 + 1);

    pub fn start_session(&mut self, player: [Pubkey; 2], most_recent: &[u8; 8]) -> Result<()> {
        require_eq!(self.turn, 0, RoulleteErrors::SessionAlreadyStarted);
        self.players = player;
        self.turn += 1;
        let clock = Clock::get()?;
        let seed = u64::from_le_bytes(*most_recent).saturating_sub(clock.unix_timestamp as u64);
        self.load[(seed % 6) as usize] = true;
        Ok(())
    }

    pub fn shoot(&mut self, target: Pubkey) -> Result<()> {
        require!(self.is_active(), RoulleteErrors::SessionAlreadyOver);
        if self.load[self.trigger as usize] {
            if target == self.current_player() {
                emit!(MementoMori {
                    shooter: self.current_player(),
                    target: target,
                    winner: self.other_player()
                });
                self.state = State::Won {
                    winner: self.other_player(),
                }
            } else {
                emit!(MementoMori {
                    shooter: self.current_player(),
                    target: target,
                    winner: self.current_player()
                });
                self.state = State::Won {
                    winner: self.current_player(),
                }
            }
        }
        if self.state == State::Active {
            self.turn += 1;
            self.trigger += 1;
        }
        Ok(())
    }

    pub fn pass(&mut self) -> Result<()> {
        require!(self.is_active(), RoulleteErrors::SessionAlreadyOver);
        self.turn += 1;
        Ok(())
    }

    fn current_player_idx(&self) -> usize {
        ((self.turn - 1) % 2).into()
    }

    fn other_player(&self) -> Pubkey {
        self.players[(self.turn % 2) as usize]
    }

    pub fn current_player(&self) -> Pubkey {
        self.players[self.current_player_idx()]
    }

    pub fn is_active(&self) -> bool {
        self.state == State::Active
    }
}

#[derive(AnchorSerialize, AnchorDeserialize, Clone, PartialEq, Eq)]
pub enum State {
    Active,
    Won { winner: Pubkey },
}
