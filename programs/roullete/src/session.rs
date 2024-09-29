use crate::errors::RoulleteErrors;
use crate::events::*;
use anchor_lang::prelude::*;

// TODO: trigger out of bounds?
#[account]
pub struct Session {
    player_one: Option<Pubkey>, // 32 + 1
    player_two: Option<Pubkey>, // 32 + 1
    turn: bool,                 // 1 (0 for playerOne and 1 for playerTwo)
    load: [bool; 6],            // 1 * 6
    trigger: u8,                //1
    state: State,               // 32 + 1
}

impl Session {
    pub const MAX_SIZE: usize = (33 * 2) + 1 + (1 * 6) + 1 + (32 + 1);

    pub fn join_session(&mut self, player: Pubkey, most_recent: &[u8; 8]) -> Result<()> {
        if self.player_one.is_none() {
            self.player_one = Some(player);
            Ok(())
        } else {
            self.player_two = Some(player);
            self.start_session(most_recent)
        }
    }

    fn start_session(&mut self, most_recent: &[u8; 8]) -> Result<()> {
        // require_eq!(self.state, State::Active || State::Won { winner: () }, RoulleteErrors::SessionAlreadyStarted);
        self.turn = false;
        self.trigger = 0;
        let clock = Clock::get()?;
        let seed = u64::from_le_bytes(*most_recent).saturating_sub(clock.unix_timestamp as u64);
        self.load[(seed % 6) as usize] = true;
        Ok(())
    }

    pub fn shoot(&mut self, target: Pubkey) -> Result<()> {
        require!(self.is_active(), RoulleteErrors::SessionAlreadyOver);
        if self.load[self.trigger as usize] {
            let winner: Pubkey;
            if target == self.current_player() {
                winner = self.other_player();
            } else {
                winner = self.current_player();
            }

            emit!(MementoMori {
                shooter: self.current_player(),
                target: target,
                winner
            });
            self.state = State::Won { winner }
        } else {
            if self.state == State::Active {
                self.trigger += 1;
                if target == self.current_player() {
                    self.turn = !self.turn;
                }
            }
        }
        Ok(())
    }

    fn other_player(&self) -> Pubkey {
        if self.turn {
            self.player_one.unwrap()
        } else {
            self.player_two.unwrap()
        }
    }

    pub fn current_player(&self) -> Pubkey {
        if !self.turn {
            self.player_one.unwrap()
        } else {
            self.player_two.unwrap()
        }
    }

    pub fn is_active(&self) -> bool {
        self.state == State::Active
    }

    pub fn get_state(&self) -> State {
        self.state
    }
}

#[derive(AnchorSerialize, AnchorDeserialize, Clone, PartialEq, Eq, Copy)]
pub enum State {
    Active,
    Won { winner: Pubkey },
}
