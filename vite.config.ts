// @lovable.dev/vite-tanstack-config already includes the following — do NOT add them manually
// or the app will break with duplicate plugins:
//   - TanStack devtools (dev-only, first), tanstackStart, viteReact, tailwindcss, tsConfigPaths,
//     nitro (build-only using cloudflare as a default target), VITE_* env injection, @ path alias,
//     React/TanStack dedupe, error logger plugins, and sandbox detection (port/host/strictPort).
// You can pass additional config via defineConfig({ vite: { ... }, etc... }) if needed.
import { defineConfig } from "@lovable.dev/vite-tanstack-config";
import { loadEnv, type Plugin } from "vite";

const serverEnvKeys = [
  "APP_BASE_URL",
  "LOVABLE_API_KEY",
  "LOVABLE_CRON_SECRET",
  "LOVABLE_CRON_SECRET_PREVIOUS",
  "LOVABLE_DB_MIGRATION_URL",
  "MPESA_CALLBACK_URL",
  "MPESA_CALLBACK_TOKEN",
  "MPESA_CONSUMER_KEY",
  "MPESA_CONSUMER_SECRET",
  "MPESA_ENV",
  "MPESA_ENVIRONMENT",
  "MPESA_PASSKEY",
  "MPESA_SHORTCODE",
  "MPESA_TRANSACTION_TYPE",
  "PAYSTACK_SECRET_KEY",
  "SUPABASE_PUBLISHABLE_KEY",
  "SUPABASE_SERVICE_ROLE_KEY",
  "SUPABASE_URL",
  "WHATSAPP_API_KEY",
];

function serverEnvPlugin(): Plugin {
  return {
    name: "load-server-env",
    config(_config, { mode }) {
      const fileEnv = loadEnv(mode, process.cwd(), "");
      for (const key of serverEnvKeys) {
        if (process.env[key] === undefined && fileEnv[key] !== undefined) {
          process.env[key] = fileEnv[key];
        }
      }
    },
  };
}

export default defineConfig({
  plugins: [serverEnvPlugin()],
  tanstackStart: {
    // Keep the SSR error wrapper as TanStack Start's bundled server entry.
    server: { entry: "server" },
  },
});
