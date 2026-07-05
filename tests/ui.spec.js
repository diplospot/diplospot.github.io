const { test, expect } = require('@playwright/test');
const path = require('path');

test.beforeEach(async ({ page }) => {
  await page.goto('file://' + path.resolve(__dirname, '../src/index.html'));
});

test('has instructions and correct placeholder', async ({ page }) => {
  const instructions = await page.locator('#instructions');
  await expect(instructions).toHaveText('Enter the 2-3 letter code from the diplomatic plate');

  const input = await page.locator('#plate-input');
  await expect(input).toHaveAttribute('placeholder', 'Code...');
});

test('successful lookup', async ({ page }) => {
  await page.fill('#plate-input', 'DDJ');
  const country = await page.locator('#result-country');
  await expect(country).toHaveText('FRANCE');

  const type = await page.locator('#result-type');
  await expect(type).toHaveText(/Diplomat/i);

  const container = await page.locator('#result-container');
  await expect(container).toHaveClass(/success/);
});

test('unrecognized lookup', async ({ page }) => {
  await page.fill('#plate-input', 'ZZ');
  const type = await page.locator('#result-type');
  await expect(type).toHaveText('NOT RECOGNIZED');

  const country = await page.locator('#result-country');
  await expect(country).toHaveText('Unknown plate');

  const container = await page.locator('#result-container');
  await expect(container).toHaveClass(/failure/);
});
