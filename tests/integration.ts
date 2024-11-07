import * as anchor from "@project-serum/anchor";
import { Program } from "@project-serum/anchor";
import { SolanaTaxToken } from "../target/types/solana_tax_token";
import { assert } from "chai";

describe("solana_tax_token", () => {
  
  const provider = anchor.AnchorProvider.env();
  anchor.setProvider(provider);

  const program = anchor.workspace.SolanaTaxToken as Program<SolanaTaxToken>;

  let stateAccount = anchor.web3.Keypair.generate();
  let taxWallet = anchor.web3.Keypair.generate();
  let devWallet = anchor.web3.Keypair.generate();
  let userWallet = anchor.web3.Keypair.generate();

  const taxPercentage = 5; 

  it("Initializes the program state", async () => {
    
    await program.methods
      .initialize(taxPercentage)
      .accounts({
        state: stateAccount.publicKey,
        authority: provider.wallet.publicKey,
        systemProgram: anchor.web3.SystemProgram.programId,
      })
      .signers([stateAccount])
      .rpc();

    
    const state = await program.account.state.fetch(stateAccount.publicKey);

    assert.equal(state.taxPercentage, taxPercentage);
    assert.equal(state.totalTokens.toNumber(), 1_000_000);
  });

  it("Processes a transaction with tax and dev fee", async () => {
    const transactionAmount = new anchor.BN(100_000);

    
    await provider.connection.requestAirdrop(userWallet.publicKey, 1_000_000_000);

    
    await program.methods
      .processTransaction(transactionAmount)
      .accounts({
        state: stateAccount.publicKey,
        taxWallet: taxWallet.publicKey,
        devWallet: devWallet.publicKey,
        userWallet: userWallet.publicKey,
        tokenProgram: anchor.web3.Token.programId,
      })
      .signers([userWallet])
      .rpc();

    
    const state = await program.account.state.fetch(stateAccount.publicKey);

    
    const expectedTax = transactionAmount.muln(taxPercentage).divn(100);
    const expectedDevFee = transactionAmount.divn(100);

    
    const remainingTokens = new anchor.BN(1_000_000).sub(expectedTax).sub(expectedDevFee);
    assert.equal(state.totalTokens.toNumber(), remainingTokens.toNumber());
  });

  it("Selects a random wallet from holders", async () => {
    
    await program.methods
      .initialize(taxPercentage)
      .accounts({
        state: stateAccount.publicKey,
        authority: provider.wallet.publicKey,
        systemProgram: anchor.web3.SystemProgram.programId,
      })
      .signers([stateAccount])
      .rpc();

    
    const holderPublicKeys = [
      anchor.web3.Keypair.generate().publicKey,
      anchor.web3.Keypair.generate().publicKey,
      anchor.web3.Keypair.generate().publicKey,
    ];

    const state = await program.account.state.fetch(stateAccount.publicKey);
    state.holders = holderPublicKeys;

    
    await program.methods
      .selectRandomWallet()
      .accounts({
        state: stateAccount.publicKey,
        prizeWallet: taxWallet.publicKey,
      })
      .rpc();

   
    const updatedState = await program.account.state.fetch(stateAccount.publicKey);
    const selectedWallet = updatedState.selectedWallet;

    assert.isTrue(holderPublicKeys.includes(selectedWallet), "Selected wallet should be one of the holders");
  });

  it("Handles zero holders gracefully in random selection", async () => {
    
    await program.methods
      .initialize(taxPercentage)
      .accounts({
        state: stateAccount.publicKey,
        authority: provider.wallet.publicKey,
        systemProgram: anchor.web3.SystemProgram.programId,
      })
      .signers([stateAccount])
      .rpc();

    
    const state = await program.account.state.fetch(stateAccount.publicKey);
    assert.equal(state.holders.length, 0);

    
    try {
      await program.methods
        .selectRandomWallet()
        .accounts({
          state: stateAccount.publicKey,
          prizeWallet: taxWallet.publicKey,
        })
        .rpc();
      
    } catch (error) {
      assert.fail("selectRandomWallet should not fail when holders are empty");
    }
  });
});
