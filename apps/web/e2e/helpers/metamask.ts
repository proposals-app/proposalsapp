import type { Page } from '@playwright/test';

async function getMetaMaskNotificationPage(dappPage: Page, timeout = 10000) {
  const context = dappPage.context();
  return (
    context
      .pages()
      .find((candidate) => candidate.url().includes('notification.html')) ??
    (await context.waitForEvent('page', {
      predicate: (candidate) => candidate.url().includes('notification.html'),
      timeout,
    }))
  );
}

export async function approveMetaMaskConnection(dappPage: Page) {
  const notificationPage = await getMetaMaskNotificationPage(dappPage);

  const connectButton = notificationPage.getByRole('button', {
    name: 'Connect',
    exact: true,
  });
  await connectButton.waitFor({ state: 'visible', timeout: 10000 });
  await connectButton.click();
}

export async function approveMetaMaskSignature(dappPage: Page) {
  const notificationPage = await getMetaMaskNotificationPage(dappPage);
  const confirmButton = notificationPage.getByRole('button', {
    name: 'Confirm',
    exact: true,
  });
  await confirmButton.waitFor({ state: 'visible', timeout: 10000 });
  await confirmButton.click();
}

export async function approveMetaMaskNetworkSetup(dappPage: Page) {
  for (let step = 0; step < 2; step += 1) {
    let notificationPage: Page;
    try {
      notificationPage = await getMetaMaskNotificationPage(
        dappPage,
        step === 0 ? 10000 : 3000
      );
    } catch (error) {
      if (step > 0) return;
      throw error;
    }

    const actionButton = notificationPage
      .getByRole('button', {
        name: /^(Approve|Confirm|Switch network|Switch to .*)$/i,
      })
      .last();
    await actionButton.waitFor({ state: 'visible', timeout: 10000 });
    await actionButton.click();
    await dappPage.waitForTimeout(500);
  }
}

export async function approveMetaMaskTransaction(dappPage: Page) {
  const notificationPage = await getMetaMaskNotificationPage(dappPage);
  const confirmButton = notificationPage.getByRole('button', {
    name: 'Confirm',
    exact: true,
  });
  await confirmButton.waitFor({ state: 'visible', timeout: 10000 });
  await confirmButton.click();
}
