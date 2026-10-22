import { test, expect } from '@playwright/test';

async function accountFixture(page, organizations = []) {
  await page.route('**/api/v1/**', async route => {
    const path = new URL(route.request().url()).pathname;
    let data = {};
    if (path.endsWith('/auth/me')) data = { user: { id: 'account-user', name: 'Account User', email: 'person@example.test' } };
    else if (path.endsWith('/organizations')) data = { organizations };
    else if (path.endsWith('/members')) data = { members: [] };
    else if (path.endsWith('/ai-settings')) data = { hostedAiEnabled: false };
    else if (path.endsWith('/notifications')) data = { notifications: [], unreadCount: 0 };
    await route.fulfill({ status: 200, contentType: 'application/json', body: JSON.stringify({ success: true, data }) });
  });
}

test('personal account deletion remains available without an organization and requires exact confirmation', async ({ page }) => {
  await accountFixture(page);
  await page.goto('/settings');
  const account = page.getByRole('region', { name: 'Delete personal account' });
  await expect(account).toBeVisible();
  await account.getByRole('button', { name: 'Delete my account', exact: true }).click();
  const submit = account.getByRole('button', { name: 'Permanently delete my account' });
  await expect(submit).toBeDisabled();
  await account.getByLabel('Confirm account email to delete').fill('wrong@example.test');
  await account.getByRole('checkbox').check();
  await expect(submit).toBeDisabled();
  await account.getByRole('button', { name: 'Cancel account deletion' }).click();
  await account.getByRole('button', { name: 'Delete my account', exact: true }).click();
  await expect(account.getByLabel('Confirm account email to delete')).toHaveValue('');
  await expect(account.getByRole('checkbox')).not.toBeChecked();
});

test('ownership refusal preserves the account; a later successful retry signs out and clears only app selections', async ({ page }) => {
  await accountFixture(page);
  let attempts = 0;
  await page.route('**/api/v1/auth/me', async route => {
    if (route.request().method() !== 'DELETE') return route.fallback();
    expect(route.request().postDataJSON()).toEqual({ confirmation: 'person@example.test' });
    attempts++;
    await route.fulfill({ status: attempts === 1 ? 409 : 200, contentType: 'application/json', body: JSON.stringify(attempts === 1
      ? { success: false, error: { message: 'Transfer ownership of every organization before deleting your account' } }
      : { success: true, data: { deleted: true } }) });
  });
  await page.goto('/settings');
  await page.evaluate(() => { sessionStorage.setItem('securepatch-org:account-user', 'org-1'); sessionStorage.setItem('unrelated-value', 'keep'); });
  const account = page.getByRole('region', { name: 'Delete personal account' });
  await account.getByRole('button', { name: 'Delete my account', exact: true }).click();
  await account.getByLabel('Confirm account email to delete').fill('person@example.test');
  await account.getByRole('checkbox').check();
  await account.getByRole('button', { name: 'Permanently delete my account' }).click();
  await expect(account.getByRole('alert')).toContainText('Transfer ownership');
  await expect(page).toHaveURL(/\/settings$/);
  await account.getByRole('button', { name: 'Permanently delete my account' }).click();
  await expect(page).toHaveURL(/\/login\?account=deleted$/);
  await expect(page.getByRole('status')).toContainText('Your account was deleted');
  expect(await page.evaluate(() => sessionStorage.getItem('securepatch-org:account-user'))).toBeNull();
  expect(await page.evaluate(() => sessionStorage.getItem('unrelated-value'))).toBe('keep');
});

test('organization deletion is restricted to owners, requires confirmation, and preserves retry after failure', async ({ page }) => {
  const organization = { id: 'org-1', name: 'Disposable Team', slug: 'disposable-team', role: 'owner' };
  await accountFixture(page, [organization]);
  let removed = false, attempts = 0;
  await page.route('**/api/v1/organizations', route => route.fulfill({ status: 200, contentType:'application/json', body:JSON.stringify({ success:true,data:{organizations: removed ? [] : [organization]} }) }));
  await page.route('**/api/v1/organizations/org-1', async route => {
    if (route.request().method() !== 'DELETE') return route.fallback();
    expect(route.request().postDataJSON()).toEqual({ confirmation: 'Disposable Team' });
    attempts++; removed = attempts > 1;
    await route.fulfill({status:removed ? 202 : 503,contentType:'application/json',body:JSON.stringify(removed ? {success:true,data:{status:'deleting'}} : {success:false,error:{message:'Deletion is temporarily unavailable'}})});
  });
  await page.goto('/settings');
  const section = page.getByRole('region',{name:'Delete organization',exact:true});
  await section.getByRole('button',{name:'Delete organization',exact:true}).click();
  const submit = section.getByRole('button',{name:'Permanently delete organization'});
  await expect(submit).toBeDisabled();
  await section.getByLabel('Confirm organization name to delete').fill('Disposable Team');
  await section.getByRole('checkbox').check();
  await submit.click();
  await expect(section.getByRole('alert')).toContainText('temporarily unavailable');
  await expect(page).toHaveURL(/\/settings$/);
  await submit.click();
  await expect(page).toHaveURL(/\/dashboard\?organizationDeleted=1$/);
  await expect(page.getByRole('status')).toContainText('Data erasure is queued');
  await expect(page.getByRole('combobox').first()).not.toContainText('Disposable Team');
});

test('organization administrators do not see the owner deletion action', async ({ page }) => {
  await accountFixture(page, [{id:'org-1',name:'Team',role:'admin'}]);
  await page.goto('/settings');
  await expect(page.getByRole('heading',{name:'Workspace settings'})).toBeVisible();
  await expect(page.getByRole('region',{name:'Delete organization',exact:true})).toHaveCount(0);
  await expect(page.getByRole('region',{name:'Delete personal account'})).toBeVisible();
});
