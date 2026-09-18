export function setRefreshTokenCookie(res, refreshToken) {
  if (!refreshToken) return;

  const isProduction = process.env.NODE_ENV === "production";

  res.cookie("refreshToken", refreshToken, {
    httpOnly: true, // Prevents client-side JS access (stops XSS token theft)
    secure: isProduction, // HTTPS only in production
    sameSite: "lax", // Protects against CSRF while allowing seamless navigation
    maxAge: 7 * 24 * 60 * 60 * 1000, // 7 days TTL
    path: "/",
  });
}

export function clearRefreshTokenCookie(res) {
  const isProduction = process.env.NODE_ENV === "production";

  res.clearCookie("refreshToken", {
    httpOnly: true,
    secure: isProduction,
    sameSite: "lax",
    path: "/",
  });
}
