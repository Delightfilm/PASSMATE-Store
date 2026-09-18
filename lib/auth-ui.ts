export function getSafeNextPath(value: string | null): string {
  if (!value || !value.startsWith("/") || value.startsWith("//")) {
    return "/library/";
  }
  return value;
}

export function getAuthErrorMessage(message: string): string {
  const normalized = message.toLowerCase();

  if (normalized.includes("invalid login credentials")) return "이메일 또는 비밀번호를 확인해주세요.";
  if (normalized.includes("email not confirmed")) return "이메일 인증을 완료한 뒤 로그인해주세요.";
  if (normalized.includes("user already registered")) return "이미 가입된 이메일입니다.";
  if (normalized.includes("password")) return "비밀번호 조건을 확인해주세요.";
  if (normalized.includes("rate limit")) return "요청이 너무 많습니다. 잠시 후 다시 시도해주세요.";
  return "요청을 처리하지 못했습니다. 잠시 후 다시 시도해주세요.";
}
