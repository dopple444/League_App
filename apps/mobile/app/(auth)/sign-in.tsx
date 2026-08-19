import { Redirect } from 'expo-router';
import { useState } from 'react';
import { KeyboardAvoidingView, Platform, Text, TextInput, View } from 'react-native';

import { ActionButton, Heading, InlineError, Screen, uiStyles } from '../../src/components/ui';
import { useLeagueSession } from '../../src/providers/session-provider';

export default function SignInScreen() {
  const { signIn, status } = useLeagueSession();
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [emailError, setEmailError] = useState<string | null>(null);
  const [passwordError, setPasswordError] = useState<string | null>(null);
  const [requestError, setRequestError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  if (status === 'signed-in') return <Redirect href="/" />;

  const submit = async () => {
    const nextEmailError =
      !email.trim() || !email.includes('@') ? 'Enter a valid email address.' : null;
    const nextPasswordError = !password ? 'Enter your password.' : null;
    setEmailError(nextEmailError);
    setPasswordError(nextPasswordError);
    setRequestError(null);
    if (nextEmailError || nextPasswordError) return;
    setBusy(true);
    try {
      await signIn(email.trim(), password);
    } catch {
      setRequestError('The email or password was not recognized. Try again.');
    } finally {
      setBusy(false);
    }
  };

  return (
    <KeyboardAvoidingView
      behavior={Platform.OS === 'ios' ? 'padding' : undefined}
      style={{ flex: 1 }}
    >
      <Screen>
        <Heading
          eyebrow="League companion"
          title="Staff sign in"
          description="Use the account issued by your league."
        />
        {requestError ? <InlineError>{requestError}</InlineError> : null}
        <View style={uiStyles.field}>
          <Text nativeID="email-label" style={uiStyles.label}>
            Email address
          </Text>
          <TextInput
            accessibilityLabelledBy="email-label"
            autoCapitalize="none"
            autoComplete="email"
            editable={!busy}
            inputMode="email"
            onChangeText={setEmail}
            style={uiStyles.input}
            textContentType="emailAddress"
            value={email}
          />
          {emailError ? (
            <Text accessibilityLiveRegion="polite" style={uiStyles.fieldError}>
              {emailError}
            </Text>
          ) : null}
        </View>
        <View style={uiStyles.field}>
          <Text nativeID="password-label" style={uiStyles.label}>
            Password
          </Text>
          <TextInput
            accessibilityLabelledBy="password-label"
            autoComplete="current-password"
            editable={!busy}
            onChangeText={setPassword}
            secureTextEntry
            style={uiStyles.input}
            textContentType="password"
            value={password}
          />
          {passwordError ? (
            <Text accessibilityLiveRegion="polite" style={uiStyles.fieldError}>
              {passwordError}
            </Text>
          ) : null}
        </View>
        <ActionButton
          accessibilityHint="Signs in and loads your authorized organizations"
          disabled={busy}
          label={busy ? 'Signing in…' : 'Sign in'}
          onPress={() => {
            void submit();
          }}
        />
        <Text style={uiStyles.muted}>
          No child under 13 receives an independent account in this initial product.
        </Text>
      </Screen>
    </KeyboardAvoidingView>
  );
}
