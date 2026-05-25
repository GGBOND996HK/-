import React from "react";
import { StyleSheet, Text, TextInput, TouchableOpacity, View } from "react-native";

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
  return (
    <TouchableOpacity
      onPress={onPress}
      disabled={disabled}
      style={[
        styles.button,
        primary ? styles.buttonPrimary : styles.buttonSecondary,
        disabled ? styles.buttonDisabled : null,
      ]}
      activeOpacity={0.88}
    >
      <Text
        style={[
          styles.buttonText,
          primary ? styles.buttonTextPrimary : styles.buttonTextSecondary,
          disabled ? styles.buttonTextDisabled : null,
        ]}
      >
        {title}
      </Text>
    </TouchableOpacity>
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
