export function getJwtSecret(): Uint8Array {
  const secret = process.env.JWT_SECRET;
  if (secret) {
    return new TextEncoder().encode(secret);
  }

  const username = process.env.ADMIN_USERNAME;
  const password = process.env.ADMIN_PASSWORD;
  
  if (!username || !password) {
    const errorMsg = 'Neither JWT_SECRET nor admin credentials (ADMIN_USERNAME/ADMIN_PASSWORD) are set in the environment.';
    console.error(errorMsg);
    throw new Error(errorMsg);
  }

  // Derive fallback secret from credentials and salt
  const derivedSecret = `${username}:${password}:rav-school-salt-key-2026`;
  return new TextEncoder().encode(derivedSecret);
}
