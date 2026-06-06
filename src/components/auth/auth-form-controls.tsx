"use client";

import type { ButtonHTMLAttributes, FormHTMLAttributes, InputHTMLAttributes } from "react";

/** Password managers / autofill extensions inject attrs (e.g. fdprocessedid) before hydration. */
export function AuthForm(props: FormHTMLAttributes<HTMLFormElement>) {
  return <form {...props} suppressHydrationWarning />;
}

export function AuthInput(props: InputHTMLAttributes<HTMLInputElement>) {
  return <input {...props} suppressHydrationWarning />;
}

export function AuthButton(props: ButtonHTMLAttributes<HTMLButtonElement>) {
  return <button {...props} suppressHydrationWarning />;
}
