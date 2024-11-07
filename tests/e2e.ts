import * as anchor from "@project-serum/anchor";
import { Program, AnchorProvider, web3 } from "@project-serum/anchor";
import { SolanaTaxToken } from "../target/types/solana_tax_token";
import { assert } from "chai";

describe("SolanaTaxToken E2E Tests", () => {
  
  const provider = anchor.AnchorProvider.env();
  anchor.setProvider(provider);

  const program = anchor.workspace.SolanaTaxToken as Program<SolanaTaxToken>;

  
  let stateAccount = anchor.web3.Keypair.generate();
  let taxWallet = anchor.web3.Keypair.generate();
  let devWallet = anchor.web3.Keypair.generate();
  let userWallet = anchor.web3.Keypair.generate();
  let prizeWallet = anchor.web3.Keypair.generate();

  const taxPercentage = 5; 

  before(async () => {
    
    await provider.connection.requestAirdrop(userWallet.publicKey, 1_000_000_000);
    await provider.connection.requestAirdrop(taxWallet.publicKey, 1_000_000_000);
    await provider.connection.requestAirdrop(devWallet.publicKey, 1_000_000_000);
    await provider.connection.requestAirdrop(prizeWallet.publicKey, 1_000_000_000);
  });

  it("Initializes the contract state", async () => {
    
    await program.methods
      .initialize(taxPercentage)
      .accounts({
        state: stateAccount.publicKey,
        authority: provider.wallet.publicKey,
        systemProgram: web3.SystemProgram.programId,
      })
      .signers([stateAccount])
      .rpc();

    
    const state = await program.account.state.fetch(stateAccount.publicKey);
    assert.equal(state.taxPercentage, taxPercentage, "Tax percentage should be set correctly");
    assert.equal(state.totalTokens.toNumber(), 1_000_000, "Initial supply should be 1,000,000 tokens");
  });

  it("Processes a transaction and verifies tax distribution", async () => {
    const transactionAmount = new anchor.BN(200_000);

    
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
    const expectedTaxAmount = transactionAmount.muln(taxPercentage).divn(100);
    const expectedDevFee = transactionAmount.divn(100);

    
    const remainingTokens = new anchor.BN(1_000_000).sub(expectedTaxAmount).sub(expectedDevFee);
    assert.equal(state.totalTokens.toNumber(), remainingTokens.toNumber(), "Total tokens should be reduced by tax and dev fee");
  });

  it("Adds multiple holders and selects a random wallet", async () => {
    
    const holderWallets = [
      anchor.web3.Keypair.generate(),
      anchor.web3.Keypair.generate(),
      anchor.web3.Keypair.generate(),
    ];

    
    await program.methods
      .initialize(taxPercentage)
      .accounts({
        state: stateAccount.publicKey,
        authority: provider.wallet.publicKey,
        systemProgram: web3.SystemProgram.programId,
      })
      .signers([stateAccount])
      .rpc();

    const state = await program.account.state.fetch(stateAccount.publicKey);
    state.holders = holderWallets.map(wallet => wallet.publicKey);

    
    await program.methods
      .selectRandomWallet()
      .accounts({
        state: stateAccount.publicKey,
        prizeWallet: prizeWallet.publicKey,
      })
      .rpc();

    const updatedState = await program.account.state.fetch(stateAccount.publicKey);
    const selectedWallet = updatedState.selectedWallet;

    
    const isHolderSelected = holderWallets.map(h => h.publicKey.toString()).includes(selectedWallet.toString());
    assert.isTrue(isHolderSelected, "Selected wallet should be one of the holders");
  });

  it("Simulates weekly prize distribution", async () => {
    
    for (let week = 0; week < 4; week++) {
      await program.methods
        .selectRandomWallet()
        .accounts({
          state: stateAccount.publicKey,
          prizeWallet: prizeWallet.publicKey,
        })
        .rpc();

      const state = await program.account.state.fetch(stateAccount.publicKey);
      console.log(`Week ${week + 1} selected wallet: ${state.selectedWallet}`);
    }

    
  });

  it("Fails gracefully when no holders are available", async () => {
    
    await program.methods
      .initialize(taxPercentage)
      .accounts({
        state: stateAccount.publicKey,
        authority: provider.wallet.publicKey,
        systemProgram: web3.SystemProgram.programId,
      })
      .signers([stateAccount])
      .rpc();

    const state = await program.account.state.fetch(stateAccount.publicKey);
    state.holders = []; 

    try {
      await program.methods
        .selectRandomWallet()
        .accounts({
          state: stateAccount.publicKey,
          prizeWallet: prizeWallet.publicKey,
        })
        .rpc();
      assert.fail("Selection should fail with no holders");
    } catch (error) {
      assert.include(error.toString(), "No holders", "Error should indicate no holders available");
    }
  });
});
