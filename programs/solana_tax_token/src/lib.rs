use anchor_lang::prelude::*;
use anchor_lang::prelude::Clock;
use anchor_spl::token::{self, Token, TokenAccount, Transfer};


declare_id!("6iB5bFvQq7rLJL83odnwjkC1nYUGT6AvT9gSzWpbccEu");

#[program]
pub mod solana_tax_token {
    use super::*;

    
    pub fn initialize(ctx: Context<Initialize>, tax_percentage: u8) -> Result<()> {
        let state = &mut ctx.accounts.state;
        state.tax_percentage = tax_percentage;
        state.total_tokens = 1_000_000;  
        Ok(())
    }

    
    pub fn process_transaction(ctx: Context<ProcessTransaction>, amount: u64) -> Result<()> {
        let state = &mut ctx.accounts.state;

        
        let tax_amount = amount * state.tax_percentage as u64 / 100;
        let dev_fee = amount * 1 / 100;

        
        token::transfer(
            ctx.accounts.into_transfer_to_tax_wallet_context(),
            tax_amount,
        )?;
        token::transfer(
            ctx.accounts.into_transfer_to_dev_wallet_context(),
            dev_fee,
        )?;
        Ok(())
    }

    
    pub fn select_random_wallet(ctx: Context<SelectRandomWallet>) -> Result<()> {
        let state = &mut ctx.accounts.state;
        let random_index = (Clock::get()?.unix_timestamp % state.holders.len() as i64) as usize;
        let selected_wallet = state.holders[random_index];
        msg!("Selected wallet: {}", selected_wallet);
        Ok(())
    }
}


#[derive(Accounts)]
pub struct Initialize<'info> {
    #[account(init, payer = authority, space = 8 + 32 + 1 + 8 + 8 + 8)]
    pub state: Account<'info, State>,
    #[account(mut)]
    pub authority: Signer<'info>,
    pub system_program: Program<'info, System>,
}

#[derive(Accounts)]
pub struct ProcessTransaction<'info> {
    #[account(mut)]
    pub state: Account<'info, State>,
    #[account(mut)]
    pub tax_wallet: Account<'info, TokenAccount>,
    #[account(mut)]
    pub dev_wallet: Account<'info, TokenAccount>,
    #[account(mut)]
    pub user_wallet: Account<'info, TokenAccount>,
    pub token_program: Program<'info, Token>,
}

#[derive(Accounts)]
pub struct SelectRandomWallet<'info> {
    #[account(mut)]
    pub state: Account<'info, State>,
    pub prize_wallet: Account<'info, TokenAccount>,
}


#[account]
pub struct State {
    pub tax_percentage: u8,
    pub total_tokens: u64,
    pub holders: Vec<Pubkey>, 
}


impl<'info> ProcessTransaction<'info> {
    fn into_transfer_to_tax_wallet_context(&self) -> CpiContext<'_, '_, '_, 'info, Transfer<'info>> {
        CpiContext::new(
            self.token_program.to_account_info(),
            Transfer {
                from: self.user_wallet.to_account_info(),
                to: self.tax_wallet.to_account_info(),
                authority: self.state.to_account_info(),
            },
        )
    }

    fn into_transfer_to_dev_wallet_context(&self) -> CpiContext<'_, '_, '_, 'info, Transfer<'info>> {
        CpiContext::new(
            self.token_program.to_account_info(),
            Transfer {
                from: self.user_wallet.to_account_info(),
                to: self.dev_wallet.to_account_info(),
                authority: self.state.to_account_info(),
            },
        )
    }
}


fn get_random_wallet_index(holder_count: usize) -> usize {
    (Clock::get().unwrap().unix_timestamp % holder_count as i64) as usize
}
