jest.mock('expo-secure-store', () => ({
  deleteItemAsync: jest.fn(async () => undefined),
  getItemAsync: jest.fn(async () => null),
  setItemAsync: jest.fn(async () => undefined),
}));

jest.mock('@expo-google-fonts/roboto-flex', () => ({
  RobotoFlex_400Regular: 'RobotoFlex_400Regular',
  useFonts: jest.fn(() => [true, null]),
}));
