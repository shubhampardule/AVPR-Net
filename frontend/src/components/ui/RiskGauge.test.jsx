import React from 'react';
import { cleanup, render, screen } from '@testing-library/react';
import { afterEach, expect, test } from 'vitest';
import { RiskGauge } from './RiskGauge';
afterEach(cleanup);
test('a zero risk score does not falsely mark a finding resolved', () => {
  render(<RiskGauge score={0} />);
  expect(screen.getByText('Low')).toBeTruthy();
  expect(screen.queryByText('Resolved')).toBeNull();
});
