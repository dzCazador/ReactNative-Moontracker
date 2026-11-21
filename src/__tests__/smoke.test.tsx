import { render } from '@testing-library/react-native';
import { describe, it, expect } from '@jest/globals';
import SetlistsPlaceholder from '@/features/setlists/screens/setlists-placeholder';

describe('SetlistsPlaceholder', () => {
  it('renders the setlists placeholder title', async () => {
    const { findByText } = await render(<SetlistsPlaceholder />);
    const element = await findByText('Setlists');
    expect(element).toBeTruthy();
  });
});
