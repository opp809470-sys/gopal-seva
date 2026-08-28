import React from "react";
import { Platform } from "react-native";
import { KeyboardAwareScrollView } from "react-native-keyboard-controller";

// Shared keyboard-aware scroll wrapper for forms.
export function KeyboardAwareScrollWrapper({
  children,
  contentContainerStyle,
  ...rest
}: React.ComponentProps<typeof KeyboardAwareScrollView>) {
  return (
    <KeyboardAwareScrollView
      bottomOffset={Platform.OS === "ios" ? 24 : 16}
      keyboardShouldPersistTaps="handled"
      showsVerticalScrollIndicator={false}
      contentContainerStyle={contentContainerStyle}
      {...rest}
    >
      {children}
    </KeyboardAwareScrollView>
  );
}
