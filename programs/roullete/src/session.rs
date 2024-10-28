use crate::errors::*;
use crate::events::*;
use anchor_lang::prelude::*;

// TODO: turn array

// Logic:
// turn 0-> first player,
// turn 1-> second player
#[account]
pub struct Session {
    player_one: Pubkey, // 32
    player_two: Pubkey, // 32
    turn: bool,         // 1 (0 for playerOne and 1 for playerTwo)
    load: [bool; 6],    // 1 * 6
    trigger: u8,        //1
    state: State,       // 32 + 2
}

impl Session {
    pub const MAX_SIZE: usize = (32 * 2) + 1 + (1 * 6) + 1 + (32 + 2);

    pub fn start_session(
        &mut self,
        player_one: Pubkey,
        player_two: Pubkey,
        most_recent: &[u8; 8],
    ) -> Result<()> {
        self.player_one = player_one;
        self.player_two = player_two;
        self.state = State::Active;
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
            let shooter = self.current_player();
            let opponent = self.other_player();
            let winner = if target == shooter { opponent } else { shooter };

            emit!(MementoMori {
                shooter,
                target,
                winner
            });
            self.state = State::Won { winner };
        } else {
            if self.state == State::Active {
                if target == self.other_player() {
                    self.turn = !self.turn;
                }
            } else {
                return Err(RoulleteErrors::InternalGameError.into());
            }
        }
        self.trigger += 1;
        Ok(())
    }

    fn other_player(&self) -> Pubkey {
        if self.turn {
            self.player_one
        } else {
            self.player_two
        }
    }

    fn current_player(&self) -> Pubkey {
        if !self.turn {
            self.player_one
        } else {
            self.player_two
        }
    }

    pub fn is_active(&self) -> bool {
        self.state == State::Active
    }

    pub fn get_state(&self) -> GameStamp {
        GameStamp {
            state: self.state,
            load: self.load,
            player_one: self.player_one,
            player_two: self.player_two,
        }
    }
}

#[derive(AnchorSerialize, AnchorDeserialize, Clone, PartialEq, Eq, Copy)]
pub enum State {
    Active,
    Won { winner: Pubkey },
}

#[derive(AnchorSerialize, AnchorDeserialize)]
pub struct GameStamp {
    pub state: State,
    pub load: [bool; 6],
    pub player_one: Pubkey,
    pub player_two: Pubkey,
}
