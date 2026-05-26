import React from "react";
import { Platform, Pressable, StyleSheet, Text, TextInput, View } from "react-native";

export function Field({ label, multiline = false, ...props }) {
  return (
    <View style={styles.field}>
      <Text style={styles.label}>{label}</Text>
      <TextInput
        {...props}
        multiline={multiline}
        style={[styles.input, multiline ? styles.multilineInput : null]}
        placeholderTextColor="#8b857b"
      />
    </View>
  );
}

export function ActionButton({ title, onPress, primary = false, disabled = false }) {
  const buttonStyle = [
    styles.button,
    primary ? styles.buttonPrimary : styles.buttonSecondary,
    disabled ? styles.buttonDisabled : null,
  ];
  const textStyle = [
    styles.buttonText,
    primary ? styles.buttonTextPrimary : styles.buttonTextSecondary,
    disabled ? styles.buttonTextDisabled : null,
  ];

  if (Platform.OS === "web") {
    return React.createElement(
      "button",
      {
        type: "button",
        disabled,
        onClick: disabled ? undefined : onPress,
        style: {
          ...StyleSheet.flatten(buttonStyle),
          borderWidth: 0,
          cursor: disabled ? "default" : "pointer",
          display: "flex",
          fontFamily: "inherit",
          minHeight: 48,
          paddingBottom: 14,
          paddingTop: 14,
        },
      },
      React.createElement("span", { style: StyleSheet.flatten(textStyle) }, title)
    );
  }

  return (
    <Pressable
      onPress={onPress}
      disabled={disabled}
      accessibilityRole="button"
      style={({ pressed }) => [...buttonStyle, pressed && !disabled ? styles.buttonPressed : null]}
    >
      <Text style={textStyle}>{title}</Text>
    </Pressable>
  );
}

const styles = StyleSheet.create({
  field: {
    marginBottom: 14,
  },
  label: {
    color: "#3d342a",
    fontSize: 14,
    fontWeight: "700",
    marginBottom: 8,
  },
  input: {
    backgroundColor: "#fffdfa",
    borderWidth: 1,
    borderColor: "rgba(146, 64, 14, 0.15)",
    borderRadius: 18,
    paddingHorizontal: 14,
    paddingVertical: 12,
    color: "#221d18",
    fontSize: 15,
  },
  multilineInput: {
    minHeight: 86,
    textAlignVertical: "top",
  },
  button: {
    flex: 1,
    borderRadius: 999,
    paddingVertical: 14,
    alignItems: "center",
    justifyContent: "center",
  },
  buttonPrimary: {
    backgroundColor: "#b45309",
  },
  buttonSecondary: {
    backgroundColor: "#f4e5cc",
  },
  buttonDisabled: {
    opacity: 0.45,
  },
  buttonPressed: {
    opacity: 0.82,
  },
  buttonText: {
    fontSize: 15,
    fontWeight: "800",
  },
  buttonTextPrimary: {
    color: "#fffefc",
  },
  buttonTextSecondary: {
    color: "#7c4708",
  },
  buttonTextDisabled: {
    color: "#a09890",
  },
});
