import { testWithSynpress } from '@synthetixio/synpress';
import { MetaMask, metaMaskFixtures } from '@synthetixio/synpress/playwright';
import basicSetup from './wallet-setup/basic.setup';

const test = testWithSynpress(metaMaskFixtures(basicSetup));

const { expect } = test;

test('should connect wallet to the MetaMask Test Dapp', async ({
  context,
  page,
  metamaskPage,
  extensionId,
}) => {
  const metamask = new MetaMask(
    context,
    metamaskPage,
    basicSetup.walletPassword,
    extensionId
  );

  await page.goto('http://localhost:61000/?story=vote-button--no-choices');
  await page.getByTestId('rk-connect-button').click();
  await page.getByTestId('rk-wallet-option-io.metamask').click();

  await metamask.connectToDapp();
  await metamask.approveNewNetwork();
  await metamask.approveSwitchNetwork();

  await expect(page.getByRole('main')).toHaveText('Unknown Vote Choices');

  await page.goto(
    'http://localhost:61000/?story=vote-button--offchain-approval'
  );
  await expect(page.getByRole('main')).toHaveText('Cast Your Vote');

  await page.goto('http://localhost:61000/?story=vote-button--offchain-basic');
  await expect(page.getByRole('main')).toHaveText('Cast Your Vote');

  await page.goto(
    'http://localhost:61000/?story=vote-button--offchain-quadratic'
  );
  await expect(page.getByRole('main')).toHaveText('Cast Your Vote');

  await page.goto(
    'http://localhost:61000/?story=vote-button--offchain-ranked-choice'
  );
  await expect(page.getByRole('main')).toHaveText('Cast Your Vote');

  await page.goto(
    'http://localhost:61000/?story=vote-button--offchain-single-choice'
  );
  await expect(page.getByRole('main')).toHaveText('Cast Your Vote');

  await page.goto(
    'http://localhost:61000/?story=vote-button--offchain-weighted'
  );
  await expect(page.getByRole('main')).toHaveText('Cast Your Vote');

  await page.goto('http://localhost:61000/?story=vote-button--voting-ended');
  await expect(page.getByRole('main')).toHaveText('Voting Ended');
});
