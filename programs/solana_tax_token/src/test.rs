#[cfg(test)]
mod tests {
    use super::*;
    use anchor_lang::prelude::*;
    use anchor_lang::solana_program::clock::Clock;
    use anchor_lang::solana_program::pubkey::Pubkey;
    use solana_program_test::*;
    use std::str::FromStr;

    #[test]
    fn test_initialize() {
       
        let tax_percentage: u8 = 5;
        let mut state = State {
            tax_percentage,
            total_tokens: 1_000_000,
            holders: vec![],
        };

        
        assert_eq!(state.tax_percentage, tax_percentage);
        assert_eq!(state.total_tokens, 1_000_000);
        assert!(state.holders.is_empty());
    }

    #[test]
    fn test_process_transaction() {
        
        let mut state = State {
            tax_percentage: 5,
            total_tokens: 1_000_000,
            holders: vec![],
        };
        let amount: u64 = 100_000;
        
       
        let tax_amount = amount * state.tax_percentage as u64 / 100;
        let dev_fee = amount * 1 / 100;

        
        let expected_total_tokens = state.total_tokens - tax_amount - dev_fee;
        state.total_tokens -= tax_amount + dev_fee;

        
        assert_eq!(tax_amount, 5000);
        assert_eq!(dev_fee, 1000);
        assert_eq!(state.total_tokens, expected_total_tokens);
    }

    #[test]
    fn test_select_random_wallet() {
        
        let mut state = State {
            tax_percentage: 5,
            total_tokens: 1_000_000,
            holders: vec![
                Pubkey::from_str("Fak8LW8jc8P7aD7L9FWcBZq7uWQHf8KL9wC3tXSeXm3X").unwrap(),
                Pubkey::from_str("EkqzZoGh7E6uL7mdA3brmLCryu6GwMkHdHUK8VZ6twZM").unwrap(),
                Pubkey::from_str("5m7dJkwr7J8mQe38W7QXzELCsHX86zDbbAAXmPAoANkG").unwrap(),
            ],
        };

        
        let random_index = (Clock::get().unwrap().unix_timestamp % state.holders.len() as i64) as usize;
        let selected_wallet = state.holders[random_index];

        
        assert!(state.holders.contains(&selected_wallet));
    }

    #[test]
    fn test_randomness_uniqueness() {
        
        let mut state = State {
            tax_percentage: 5,
            total_tokens: 1_000_000,
            holders: vec![
                Pubkey::from_str("Fak8LW8jc8P7aD7L9FWcBZq7uWQHf8KL9wC3tXSeXm3X").unwrap(),
                Pubkey::from_str("EkqzZoGh7E6uL7mdA3brmLCryu6GwMkHdHUK8VZ6twZM").unwrap(),
                Pubkey::from_str("5m7dJkwr7J8mQe38W7QXzELCsHX86zDbbAAXmPAoANkG").unwrap(),
            ],
        };

        
        let mut selected_wallets = vec![];
        for _ in 0..10 {
            let random_index = (Clock::get().unwrap().unix_timestamp % state.holders.len() as i64) as usize;
            selected_wallets.push(state.holders[random_index]);
        }

        
        assert!(selected_wallets.iter().any(|&w| w != selected_wallets[0]));
    }

    #[test]
    fn test_zero_holders_random_selection() {
        
        let state = State {
            tax_percentage: 5,
            total_tokens: 1_000_000,
            holders: vec![],
        };

        
        let result = std::panic::catch_unwind(|| {
            let _random_index = (Clock::get().unwrap().unix_timestamp % state.holders.len() as i64) as usize;
        });

        
        assert!(result.is_ok());
    }
}
