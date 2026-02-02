import React from 'react';
import { render, screen } from '@testing-library/react';
import App from './App';

test('renders AgriSpray Pro header', () => {
  render(<App />);
  const heading = screen.getByText(/AgriSpray Pro/i);
  expect(heading).toBeInTheDocument();
});
