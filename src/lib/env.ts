export function getEnv(name: string) {
  const value = process.env[name];

  if (!value) {
    return null;
  }

  return value;
}

export function getRequiredEnv(name: string) {
  const value = getEnv(name);

  if (!value) {
    throw new Error(`Missing environment variable: ${name}`);
  }

  return value;
}
